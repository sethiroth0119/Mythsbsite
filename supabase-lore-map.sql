-- ============================================================================
-- 🗺 NEW AMERICA (lore map) — real saving + comic page hosting.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc). Idempotent.
--
-- Before this the map editor had no server side at all: edits lived in ONE
-- browser's localStorage and only reached players if the JSON was exported by
-- hand into data/content.js and redeployed, and comic pages could only be
-- entered as URLs that were already hosted somewhere else.
--
--   lore_map     the whole published map (pins, art, theme) — public read
--   lore-comics  a public bucket for the comic pages themselves
-- ============================================================================

-- Admin identity helper (same one the rest of the site uses). Safe to re-run.
create or replace function public.eb_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = 'richaegisop@gmail.com';
$$;

-- ── 1) The published map ────────────────────────────────────────────────────
-- One row. `doc` is { art:[...], locs:[...], theme:{...} } exactly as the
-- editor holds it, so publishing is a single upsert and loading is a single read.
create table if not exists public.lore_map (
  id         text primary key default 'singleton',
  doc        jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.lore_map enable row level security;

drop policy if exists lore_map_read   on public.lore_map;
drop policy if exists lore_map_insert on public.lore_map;
drop policy if exists lore_map_update on public.lore_map;

-- Everyone reads the map (including signed-out visitors); only the admin writes.
create policy lore_map_read   on public.lore_map for select using (true);
create policy lore_map_insert on public.lore_map for insert to authenticated with check (eb_is_admin());
create policy lore_map_update on public.lore_map for update to authenticated using (eb_is_admin()) with check (eb_is_admin());

-- ── 2) Comic pages bucket ───────────────────────────────────────────────────
-- Public so readers can see the pages; 15 MB a page, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lore-comics', 'lore-comics', true, 15728640,
        array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 15728640,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/avif'];

drop policy if exists "lore_comics_public_read" on storage.objects;
drop policy if exists "lore_comics_admin_write" on storage.objects;
drop policy if exists "lore_comics_admin_update" on storage.objects;
drop policy if exists "lore_comics_admin_delete" on storage.objects;

create policy "lore_comics_public_read" on storage.objects
  for select using (bucket_id = 'lore-comics');
create policy "lore_comics_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'lore-comics' and eb_is_admin());
create policy "lore_comics_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'lore-comics' and eb_is_admin());
create policy "lore_comics_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'lore-comics' and eb_is_admin());
