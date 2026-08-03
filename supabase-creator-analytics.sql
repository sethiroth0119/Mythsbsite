-- ============================================================================
-- Creator Analytics — earnings ledger + clip view counter.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc). Idempotent.
-- Depends on eb_is_admin() from supabase-broadcast-moderation.sql (run that first).
-- ============================================================================

-- ── 1) creator_earnings — the Cinder / Mythic Token a creator has earned. ──
-- The creator program (or an admin) inserts a row per payout; the dashboard
-- sums them. Players can read only their OWN earnings.
create table if not exists public.creator_earnings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  cinder      numeric not null default 0,   -- 🔥 Cinder credited
  mt          numeric not null default 0,   -- Mythic Token credited
  reason      text,                          -- e.g. "July creator payout", "10k clip views"
  created_at  timestamptz not null default now()
);
create index if not exists creator_earnings_user_idx on public.creator_earnings (user_id, created_at desc);

alter table public.creator_earnings enable row level security;

drop policy if exists creator_earnings_read   on public.creator_earnings;
drop policy if exists creator_earnings_insert  on public.creator_earnings;
drop policy if exists creator_earnings_update  on public.creator_earnings;
drop policy if exists creator_earnings_delete  on public.creator_earnings;

-- Owner sees their own earnings; admins see everyone's.
create policy creator_earnings_read on public.creator_earnings
  for select to authenticated using (user_id = auth.uid() or eb_is_admin());
-- Only admins (the creator program) credit / adjust earnings.
create policy creator_earnings_insert on public.creator_earnings
  for insert to authenticated with check (eb_is_admin());
create policy creator_earnings_update on public.creator_earnings
  for update to authenticated using (eb_is_admin()) with check (eb_is_admin());
create policy creator_earnings_delete on public.creator_earnings
  for delete to authenticated using (eb_is_admin());

-- ── 2) eb_clip_view — count a play without exposing eb_clips to public writes. ──
-- SECURITY DEFINER so any viewer (even signed-out) can bump the counter, but
-- nothing else about the row can be changed.
create or replace function public.eb_clip_view(p_url text)
returns void language sql security definer set search_path = public as $$
  update public.eb_clips set views = coalesce(views, 0) + 1 where url = p_url;
$$;
grant execute on function public.eb_clip_view(text) to anon, authenticated;
