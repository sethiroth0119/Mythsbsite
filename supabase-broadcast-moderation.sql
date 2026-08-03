-- ============================================================================
-- Emergency Broadcast — social & moderation layer
--   • eb_reports   — players flag posts; admins triage
--   • eb_bans      — admins ban accounts from posting
--   • feed-media   — public Storage bucket for post photos / GIFs
--   • RLS          — owner edit/delete, admin delete, ban-enforcement on posting
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc). Idempotent.
-- ============================================================================

-- ── Admin identity helper (SECURITY DEFINER so RLS subqueries can call it) ──
create or replace function public.eb_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = 'richaegisop@gmail.com';
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- 1) eb_reports — one row per player report of a post.
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists public.eb_reports (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid,
  reporter_id       uuid references auth.users(id) on delete set null,
  reported_user_id  uuid,
  reason            text,
  post_body         text,
  status            text not null default 'open',   -- 'open' | 'resolved'
  created_at        timestamptz not null default now()
);
create index if not exists eb_reports_status_idx on public.eb_reports (status, created_at desc);

alter table public.eb_reports enable row level security;

drop policy if exists eb_reports_insert_own on public.eb_reports;
drop policy if exists eb_reports_admin_read on public.eb_reports;
drop policy if exists eb_reports_admin_write on public.eb_reports;

-- A signed-in player may file a report as themselves.
create policy eb_reports_insert_own on public.eb_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- Only admins can read the report queue.
create policy eb_reports_admin_read on public.eb_reports
  for select to authenticated
  using (eb_is_admin());

-- Only admins can resolve / update / delete reports.
create policy eb_reports_admin_write on public.eb_reports
  for update to authenticated
  using (eb_is_admin()) with check (eb_is_admin());
create policy eb_reports_admin_delete on public.eb_reports
  for delete to authenticated
  using (eb_is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- 2) eb_bans — one row per banned account.
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists public.eb_bans (
  user_id       uuid primary key,
  banned_by     uuid,
  reason        text,
  handle        text,
  display_name  text,
  created_at    timestamptz not null default now()
);

alter table public.eb_bans enable row level security;

drop policy if exists eb_bans_admin_read on public.eb_bans;
drop policy if exists eb_bans_admin_insert on public.eb_bans;
drop policy if exists eb_bans_admin_update on public.eb_bans;
drop policy if exists eb_bans_admin_delete on public.eb_bans;

create policy eb_bans_admin_read on public.eb_bans
  for select to authenticated using (eb_is_admin());
create policy eb_bans_admin_insert on public.eb_bans
  for insert to authenticated with check (eb_is_admin());
create policy eb_bans_admin_update on public.eb_bans
  for update to authenticated using (eb_is_admin()) with check (eb_is_admin());
create policy eb_bans_admin_delete on public.eb_bans
  for delete to authenticated using (eb_is_admin());

-- Ban check helper (SECURITY DEFINER: readable from the eb_posts insert policy,
-- which otherwise cannot see admin-only eb_bans).
create or replace function public.eb_is_banned(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eb_bans where user_id = uid);
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- 3) eb_posts policies — owner edit/delete, admin delete, ban enforcement.
--    These are ADDITIVE. Named policies are dropped-then-recreated so re-running
--    is safe; existing unrelated policies on eb_posts are left untouched.
-- ══════════════════════════════════════════════════════════════════════════
alter table public.eb_posts enable row level security;

-- Owner may edit their own post body.
drop policy if exists eb_posts_owner_update on public.eb_posts;
create policy eb_posts_owner_update on public.eb_posts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Owner may delete their own post; admins may delete any post.
drop policy if exists eb_posts_owner_delete on public.eb_posts;
create policy eb_posts_owner_delete on public.eb_posts
  for delete to authenticated
  using (user_id = auth.uid() or eb_is_admin());

-- RESTRICTIVE: a banned account cannot insert posts (ANDs with existing
-- permissive insert policies rather than replacing them).
drop policy if exists eb_posts_not_banned on public.eb_posts;
create policy eb_posts_not_banned on public.eb_posts
  as restrictive for insert to authenticated
  with check (not public.eb_is_banned(auth.uid()));

-- ══════════════════════════════════════════════════════════════════════════
-- 4) feed-media — public bucket for post photos / GIFs (8 MB, images only).
-- ══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-media', 'feed-media', true, 8388608,
        array['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp'];

drop policy if exists "feed_media_public_read" on storage.objects;
drop policy if exists "feed_media_own_insert"  on storage.objects;
drop policy if exists "feed_media_own_delete"  on storage.objects;

create policy "feed_media_public_read" on storage.objects
  for select using (bucket_id = 'feed-media');

create policy "feed_media_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feed-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "feed_media_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'feed-media' and (storage.foldername(name))[1] = auth.uid()::text);
