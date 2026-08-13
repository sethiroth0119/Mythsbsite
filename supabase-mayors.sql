-- ============================================================================
-- 🏛 MAYOR HALL — players offer to run a city, node owners hire them.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc). Idempotent.
--
--   mayor_listings     a player advertises that they can run a city
--   mayor_votes        the community endorses a candidate (per node, or general)
--   mayor_offers       ONE negotiation between a node owner and a candidate
--   mayor_offer_events every counter/accept/decline — the full paper trail
--   node_mayors        the ACTIVE contract for a node  ← the game reads THIS
--   mayor_shifts       clock in / clock out + what the shift earned
--
-- Terms that get negotiated: the revenue split (starts 30% player / 70% owner),
-- the payout currency (Cinder / Aza Coin / Mythic Token), hours per month, and
-- who keeps the CARDS and the RESOURCES found while on shift.
-- ============================================================================

-- ── 1) mayor_listings — "I can run your city" ───────────────────────────────
create table if not exists public.mayor_listings (
  user_id          uuid primary key,
  headline         text not null,
  pitch            text,
  experience       text,
  hours_per_month  int  not null default 20,
  min_player_pct   numeric not null default 30,        -- the split they're asking for
  currencies       text[] not null default array['CINDER'],  -- CINDER | AZA | MT
  card_policy      text not null default 'owner',      -- owner | mayor | split
  resource_policy  text not null default 'owner',      -- owner | mayor | split
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.mayor_listings enable row level security;
drop policy if exists mayor_listings_read on public.mayor_listings;
drop policy if exists mayor_listings_write on public.mayor_listings;
drop policy if exists mayor_listings_update on public.mayor_listings;
drop policy if exists mayor_listings_delete on public.mayor_listings;
-- Anyone may browse candidates; you may only write your own listing.
create policy mayor_listings_read   on public.mayor_listings for select using (true);
create policy mayor_listings_write  on public.mayor_listings for insert to authenticated with check (user_id = auth.uid());
create policy mayor_listings_update on public.mayor_listings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mayor_listings_delete on public.mayor_listings for delete to authenticated using (user_id = auth.uid());

-- ── 2) mayor_votes — community endorsements ─────────────────────────────────
-- node_id '' means "would make a good mayor anywhere". NOT NULL so the primary
-- key actually de-duplicates (in Postgres two NULLs are distinct).
create table if not exists public.mayor_votes (
  voter_id     uuid not null,
  candidate_id uuid not null,
  node_id      text not null default '',
  created_at   timestamptz not null default now(),
  primary key (voter_id, candidate_id, node_id)
);
create index if not exists mayor_votes_candidate_idx on public.mayor_votes (candidate_id);
alter table public.mayor_votes enable row level security;
drop policy if exists mayor_votes_read on public.mayor_votes;
drop policy if exists mayor_votes_insert on public.mayor_votes;
drop policy if exists mayor_votes_delete on public.mayor_votes;
create policy mayor_votes_read   on public.mayor_votes for select using (true);
create policy mayor_votes_insert on public.mayor_votes for insert to authenticated with check (voter_id = auth.uid() and candidate_id <> auth.uid());
create policy mayor_votes_delete on public.mayor_votes for delete to authenticated using (voter_id = auth.uid());

-- Public tally so the directory can rank candidates without exposing who voted.
create or replace view public.mayor_vote_counts as
  select candidate_id, count(*)::int as votes
    from public.mayor_votes group by candidate_id;
grant select on public.mayor_vote_counts to anon, authenticated;

-- ── 2b) mayor_node_listings — "this city is hiring a mayor" ─────────────────
-- The mirror image of mayor_listings: an OWNER advertises the job, with the
-- terms they are opening at, and players request the post.
create table if not exists public.mayor_node_listings (
  node_id          text primary key,
  owner_id         uuid not null,
  node_name        text,
  title            text,
  blurb            text,
  note             text,                                 -- the "Message" box on the opening terms
  player_pct       numeric not null default 30,
  currency         text not null default 'CINDER',
  hours_per_month  int  not null default 20,
  card_policy      text not null default 'owner',
  resource_policy  text not null default 'owner',
  open             boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Safe to re-run on a table created before `note` existed: without this the
-- Message box on the Advertise form fails the upsert (column does not exist).
alter table public.mayor_node_listings add column if not exists note text;
create index if not exists mayor_node_listings_open_idx on public.mayor_node_listings (open, updated_at desc);
alter table public.mayor_node_listings enable row level security;
drop policy if exists mayor_node_listings_read on public.mayor_node_listings;
drop policy if exists mayor_node_listings_write on public.mayor_node_listings;
drop policy if exists mayor_node_listings_update on public.mayor_node_listings;
drop policy if exists mayor_node_listings_delete on public.mayor_node_listings;
create policy mayor_node_listings_read on public.mayor_node_listings for select using (true);
-- You may only advertise a node you actually own on the war map.
create policy mayor_node_listings_write on public.mayor_node_listings for insert to authenticated
  with check (owner_id = auth.uid()
    and exists (select 1 from public.tw_node_owners w where w.node_id = mayor_node_listings.node_id and w.user_id = auth.uid()));
create policy mayor_node_listings_update on public.mayor_node_listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy mayor_node_listings_delete on public.mayor_node_listings for delete to authenticated
  using (owner_id = auth.uid());

-- ── 2c) Endorsements FOR A SPECIFIC CITY (mayor_votes.node_id = that node) ──
create or replace view public.mayor_node_vote_counts as
  select candidate_id, node_id, count(*)::int as votes
    from public.mayor_votes
   where node_id <> ''
   group by candidate_id, node_id;
grant select on public.mayor_node_vote_counts to anon, authenticated;
-- ⚠ The applicants view lives AFTER mayor_offers (section 3b) — it reads that
-- table, and a view cannot be created before the table it selects from.

-- ── 3) mayor_offers — one live negotiation ──────────────────────────────────
create table if not exists public.mayor_offers (
  id               uuid primary key default gen_random_uuid(),
  node_id          text not null,
  node_name        text,
  owner_id         uuid not null,
  candidate_id     uuid not null,
  created_by       uuid not null,
  -- pending | countered | accepted | declined | withdrawn | ended
  status           text not null default 'pending',
  player_pct       numeric not null default 30,       -- owner takes the remainder
  currency         text not null default 'CINDER',    -- CINDER | AZA | MT
  hours_per_month  int  not null default 20,
  card_policy      text not null default 'owner',     -- who keeps cards found on shift
  resource_policy  text not null default 'owner',     -- who keeps resources found on shift
  note             text,
  last_actor       uuid,
  turn             uuid,                              -- whose move it is
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists mayor_offers_node_idx      on public.mayor_offers (node_id, status);
create index if not exists mayor_offers_candidate_idx on public.mayor_offers (candidate_id, status);
create index if not exists mayor_offers_owner_idx     on public.mayor_offers (owner_id, status);
alter table public.mayor_offers enable row level security;
drop policy if exists mayor_offers_party_read on public.mayor_offers;
drop policy if exists mayor_offers_create on public.mayor_offers;
drop policy if exists mayor_offers_party_update on public.mayor_offers;
-- A negotiation is private to its two parties.
create policy mayor_offers_party_read on public.mayor_offers for select to authenticated
  using (owner_id = auth.uid() or candidate_id = auth.uid());
create policy mayor_offers_create on public.mayor_offers for insert to authenticated
  with check (created_by = auth.uid() and (owner_id = auth.uid() or candidate_id = auth.uid()));
create policy mayor_offers_party_update on public.mayor_offers for update to authenticated
  using (owner_id = auth.uid() or candidate_id = auth.uid())
  with check (owner_id = auth.uid() or candidate_id = auth.uid());

-- ── 3b) Who has applied to run a city — PUBLIC, so people can endorse them ──
-- mayor_offers is private to its two parties (it carries the money terms), but
-- the community has to be able to see WHO applied in order to back them. This
-- view exposes only the applicant + node + status — never the terms — and only
-- for offers the CANDIDATE started (a real application, not an owner's private
-- approach to someone).
-- ⚠ Must come AFTER mayor_offers is created (that was a 42P01 on first release).
create or replace view public.mayor_node_applicants as
  select o.node_id, o.candidate_id, o.status, o.created_at
    from public.mayor_offers o
   where o.created_by = o.candidate_id
     and o.status in ('pending', 'countered');
grant select on public.mayor_node_applicants to anon, authenticated;

-- ── 4) mayor_offer_events — every move in the negotiation ───────────────────
create table if not exists public.mayor_offer_events (
  id              bigint generated always as identity primary key,
  offer_id        uuid not null references public.mayor_offers(id) on delete cascade,
  actor_id        uuid,
  action          text not null,     -- proposed | countered | accepted | declined | withdrawn | message
  player_pct      numeric,
  currency        text,
  hours_per_month int,
  card_policy     text,
  resource_policy text,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists mayor_offer_events_offer_idx on public.mayor_offer_events (offer_id, created_at);
alter table public.mayor_offer_events enable row level security;
drop policy if exists mayor_offer_events_read on public.mayor_offer_events;
drop policy if exists mayor_offer_events_insert on public.mayor_offer_events;
create policy mayor_offer_events_read on public.mayor_offer_events for select to authenticated
  using (exists (select 1 from public.mayor_offers o where o.id = offer_id and (o.owner_id = auth.uid() or o.candidate_id = auth.uid())));
create policy mayor_offer_events_insert on public.mayor_offer_events for insert to authenticated
  with check (actor_id = auth.uid() and exists (select 1 from public.mayor_offers o where o.id = offer_id and (o.owner_id = auth.uid() or o.candidate_id = auth.uid())));

-- ── 5) node_mayors — the ACTIVE contract. 🎮 THE GAME READS THIS. ───────────
-- One mayor per node. Public read so the city screen can show who runs it.
-- Written only through the accept/end RPCs below.
create table if not exists public.node_mayors (
  node_id          text primary key,
  mayor_id         uuid not null,
  owner_id         uuid not null,
  offer_id         uuid,
  player_pct       numeric not null default 30,
  currency         text not null default 'CINDER',
  hours_per_month  int not null default 20,
  card_policy      text not null default 'owner',
  resource_policy  text not null default 'owner',
  active           boolean not null default true,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz
);
create index if not exists node_mayors_mayor_idx on public.node_mayors (mayor_id, active);
alter table public.node_mayors enable row level security;
drop policy if exists node_mayors_read on public.node_mayors;
create policy node_mayors_read on public.node_mayors for select using (true);
-- No direct write policies on purpose — go through mayor_accept_offer / mayor_end_contract.

-- ── 6) mayor_shifts — clock in / clock out. 🎮 THE GAME WRITES THIS. ────────
-- While a shift is open the game routes cards + resources to the OWNER; at
-- clock-out the mayor is paid their agreed cut. Stored here so both sides (and
-- the website) can audit the same history.
create table if not exists public.mayor_shifts (
  id            uuid primary key default gen_random_uuid(),
  node_id       text not null,
  mayor_id      uuid not null,
  owner_id      uuid not null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  minutes       int,
  cards_found   int  not null default 0,
  resources     jsonb not null default '{}'::jsonb,
  payout_amount numeric not null default 0,
  payout_currency text,
  paid          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists mayor_shifts_node_idx  on public.mayor_shifts (node_id, started_at desc);
create index if not exists mayor_shifts_mayor_idx on public.mayor_shifts (mayor_id, started_at desc);
alter table public.mayor_shifts enable row level security;
drop policy if exists mayor_shifts_read on public.mayor_shifts;
drop policy if exists mayor_shifts_insert on public.mayor_shifts;
drop policy if exists mayor_shifts_update on public.mayor_shifts;
-- Both parties can see the shift log; the mayor records their own shifts.
create policy mayor_shifts_read on public.mayor_shifts for select to authenticated
  using (mayor_id = auth.uid() or owner_id = auth.uid());
create policy mayor_shifts_insert on public.mayor_shifts for insert to authenticated
  with check (mayor_id = auth.uid());
create policy mayor_shifts_update on public.mayor_shifts for update to authenticated
  using (mayor_id = auth.uid() or owner_id = auth.uid())
  with check (mayor_id = auth.uid() or owner_id = auth.uid());

-- ── 7) Accept an offer — atomic, and only by the side whose turn it is ──────
create or replace function public.mayor_accept_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.mayor_offers%rowtype;
begin
  select * into o from public.mayor_offers where id = p_offer_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if auth.uid() is null or auth.uid() not in (o.owner_id, o.candidate_id) then
    return jsonb_build_object('ok', false, 'error', 'not_a_party');
  end if;
  if o.status not in ('pending', 'countered') then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  -- You cannot accept your own proposal; the other side must respond.
  if o.turn is not null and o.turn <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_turn');
  end if;
  -- The owner side must ACTUALLY own the node on the war map. Without this,
  -- anyone could open an offer claiming to own a city and then "hire" a mayor
  -- for it — and node_mayors is exactly what the game trusts to place a mayor.
  if not exists (select 1 from public.tw_node_owners w
                  where w.node_id = o.node_id and w.user_id = o.owner_id) then
    return jsonb_build_object('ok', false, 'error', 'not_the_node_owner');
  end if;

  update public.mayor_offers
     set status = 'accepted', turn = null, last_actor = auth.uid(), updated_at = now()
   where id = o.id;

  insert into public.node_mayors (node_id, mayor_id, owner_id, offer_id, player_pct, currency,
                                  hours_per_month, card_policy, resource_policy, active, started_at, ended_at)
  values (o.node_id, o.candidate_id, o.owner_id, o.id, o.player_pct, o.currency,
          o.hours_per_month, o.card_policy, o.resource_policy, true, now(), null)
  on conflict (node_id) do update
    set mayor_id = excluded.mayor_id, owner_id = excluded.owner_id, offer_id = excluded.offer_id,
        player_pct = excluded.player_pct, currency = excluded.currency,
        hours_per_month = excluded.hours_per_month, card_policy = excluded.card_policy,
        resource_policy = excluded.resource_policy, active = true, started_at = now(), ended_at = null;

  -- Hiring one mayor closes the other conversations for that node.
  update public.mayor_offers
     set status = 'declined', turn = null, updated_at = now()
   where node_id = o.node_id and id <> o.id and status in ('pending', 'countered');

  insert into public.mayor_offer_events (offer_id, actor_id, action, player_pct, currency,
                                         hours_per_month, card_policy, resource_policy)
  values (o.id, auth.uid(), 'accepted', o.player_pct, o.currency, o.hours_per_month, o.card_policy, o.resource_policy);

  return jsonb_build_object('ok', true, 'node_id', o.node_id, 'mayor_id', o.candidate_id);
end $$;
grant execute on function public.mayor_accept_offer(uuid) to authenticated;

-- ── 8) End a contract — either party may walk away ──────────────────────────
create or replace function public.mayor_end_contract(p_node_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.node_mayors%rowtype;
begin
  select * into m from public.node_mayors where node_id = p_node_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if auth.uid() is null or auth.uid() not in (m.owner_id, m.mayor_id) then
    return jsonb_build_object('ok', false, 'error', 'not_a_party');
  end if;
  update public.node_mayors set active = false, ended_at = now() where node_id = p_node_id;
  if m.offer_id is not null then
    update public.mayor_offers set status = 'ended', turn = null, updated_at = now() where id = m.offer_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.mayor_end_contract(text) to authenticated;
