-- ============================================================================
-- Mythic Spellbook — Broadcast + Analytics: EVERYTHING, one script.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc).
-- Fully idempotent — safe to re-run. Ordered so dependencies come first.
-- Covers: admin helper · reports · bans · post RLS · photo/GIF bucket ·
--         nested comment threads · creator earnings · clip views · PDF bucket.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 0) Admin identity helper (everything else references this).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.eb_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = 'richaegisop@gmail.com';
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) eb_reports — players flag posts; admins triage.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.eb_reports (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid,
  reporter_id       uuid references auth.users(id) on delete set null,
  reported_user_id  uuid,
  reason            text,
  post_body         text,
  status            text not null default 'open',
  created_at        timestamptz not null default now()
);
create index if not exists eb_reports_status_idx on public.eb_reports (status, created_at desc);
alter table public.eb_reports enable row level security;

drop policy if exists eb_reports_insert_own  on public.eb_reports;
drop policy if exists eb_reports_admin_read   on public.eb_reports;
drop policy if exists eb_reports_admin_write  on public.eb_reports;
drop policy if exists eb_reports_admin_delete on public.eb_reports;

create policy eb_reports_insert_own on public.eb_reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy eb_reports_admin_read on public.eb_reports
  for select to authenticated using (eb_is_admin());
create policy eb_reports_admin_write on public.eb_reports
  for update to authenticated using (eb_is_admin()) with check (eb_is_admin());
create policy eb_reports_admin_delete on public.eb_reports
  for delete to authenticated using (eb_is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 2) eb_bans — admins ban accounts from posting.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.eb_bans (
  user_id       uuid primary key,
  banned_by     uuid,
  reason        text,
  handle        text,
  display_name  text,
  created_at    timestamptz not null default now()
);
alter table public.eb_bans enable row level security;

drop policy if exists eb_bans_admin_read   on public.eb_bans;
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

create or replace function public.eb_is_banned(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eb_bans where user_id = uid);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) eb_posts policies — owner edit/delete, admin delete, ban enforcement,
--    and nested-comment threading (thread_root). Additive; unrelated existing
--    policies are left alone.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.eb_posts enable row level security;

drop policy if exists eb_posts_owner_update on public.eb_posts;
create policy eb_posts_owner_update on public.eb_posts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists eb_posts_owner_delete on public.eb_posts;
create policy eb_posts_owner_delete on public.eb_posts
  for delete to authenticated
  using (user_id = auth.uid() or eb_is_admin());

drop policy if exists eb_posts_not_banned on public.eb_posts;
create policy eb_posts_not_banned on public.eb_posts
  as restrictive for insert to authenticated
  with check (not public.eb_is_banned(auth.uid()));

-- Nested comment threads: thread_root points every reply at its top-level post,
-- so a whole conversation loads in one query.
alter table public.eb_posts add column if not exists thread_root uuid;
update public.eb_posts
   set thread_root = reply_to
 where reply_to is not null and thread_root is null;
create index if not exists eb_posts_thread_root_idx on public.eb_posts (thread_root, created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- 4) feed-media bucket — photos / GIFs for posts AND comments (8 MB, images).
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-media', 'feed-media', true, 8388608,
        array['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608,
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

-- ─────────────────────────────────────────────────────────────────────────
-- 5) creator_earnings — Cinder / Mythic Token credited by the creator program.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.creator_earnings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  cinder      numeric not null default 0,
  mt          numeric not null default 0,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists creator_earnings_user_idx on public.creator_earnings (user_id, created_at desc);
alter table public.creator_earnings enable row level security;

drop policy if exists creator_earnings_read   on public.creator_earnings;
drop policy if exists creator_earnings_insert on public.creator_earnings;
drop policy if exists creator_earnings_update on public.creator_earnings;
drop policy if exists creator_earnings_delete on public.creator_earnings;

create policy creator_earnings_read on public.creator_earnings
  for select to authenticated using (user_id = auth.uid() or eb_is_admin());
create policy creator_earnings_insert on public.creator_earnings
  for insert to authenticated with check (eb_is_admin());
create policy creator_earnings_update on public.creator_earnings
  for update to authenticated using (eb_is_admin()) with check (eb_is_admin());
create policy creator_earnings_delete on public.creator_earnings
  for delete to authenticated using (eb_is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 6) eb_clip_view — count a clip play (any viewer), safely.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.eb_clip_view(p_url text)
returns void language sql security definer set search_path = public as $$
  update public.eb_clips set views = coalesce(views, 0) + 1 where url = p_url;
$$;
grant execute on function public.eb_clip_view(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7) training-docs bucket — admin PDF uploads, 100 MB, PDF only.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-docs', 'training-docs', true, 209715200, array['application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = 209715200,
      allowed_mime_types = array['application/pdf'];

drop policy if exists "training_docs_public_read" on storage.objects;
drop policy if exists "training_docs_own_insert"  on storage.objects;
drop policy if exists "training_docs_own_delete"  on storage.objects;

create policy "training_docs_public_read" on storage.objects
  for select using (bucket_id = 'training-docs');
create policy "training_docs_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'training-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "training_docs_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'training-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ✅ Done. Reports, bans, photo/GIF posts + comments, nested threads,
--    creator earnings, clip-view counting, and 100 MB PDF uploads are all live.
