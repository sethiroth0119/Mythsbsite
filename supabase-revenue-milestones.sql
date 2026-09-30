-- ═══════════════════════════════════════════════════════════════════════
-- Revenue Milestones — the Kickstarter-style tracker on the Shop page.
--
-- Public (anon + signed in) can READ the milestones and the running total.
-- Only the site admins can add / edit / delete milestones, post manual
-- adjustments, or change settings. Safe to re-run.
--
-- The total is computed live by revenue_progress() from the real sales
-- tables, so nothing has to be "recorded" at checkout:
--   shop_orders (paid) · pledge_purchases (paid) · devpoint_purchases ·
--   licence_purchases · tw_ad_orders (paid)            → real USD, counted as-is
--   Vendor Market sales (card_market_listings sold,
--   boe_market_listings paid, both in Cinder)            → counted only once an
--                                                          admin sets a Cinder→USD rate
--   revenue_adjustments                                   → admin corrections (+/-)
-- revenue_progress() is SECURITY DEFINER and returns aggregates only — no
-- buyer, order or listing rows ever leave the database through it.
-- ═══════════════════════════════════════════════════════════════════════

-- Admins: the same two accounts as ADMIN_EMAILS in public/index.html.
create or replace function public.rm_is_admin()
returns boolean language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') in ('richaegisop@gmail.com', 'play@mythicsoa.com');
$$;

-- ── Milestones ─────────────────────────────────────────────────────────
create table if not exists public.revenue_milestones (
  id           uuid primary key default gen_random_uuid(),
  amount_cents bigint not null check (amount_cents > 0),
  title        text   not null,
  description  text,
  unlocks      jsonb  not null default '[]'::jsonb,   -- ["Cashout Vault opens", ...]
  icon         text,
  sort_order   integer not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.revenue_milestones enable row level security;
drop policy if exists rm_read   on public.revenue_milestones;
drop policy if exists rm_insert on public.revenue_milestones;
drop policy if exists rm_update on public.revenue_milestones;
drop policy if exists rm_delete on public.revenue_milestones;
create policy rm_read   on public.revenue_milestones for select to anon, authenticated using (true);
create policy rm_insert on public.revenue_milestones for insert to authenticated with check (rm_is_admin());
create policy rm_update on public.revenue_milestones for update to authenticated using (rm_is_admin()) with check (rm_is_admin());
create policy rm_delete on public.revenue_milestones for delete to authenticated using (rm_is_admin());

-- ── Manual adjustments (append-only ledger; admin reads/writes, public sees only the sum) ──
create table if not exists public.revenue_adjustments (
  id           uuid primary key default gen_random_uuid(),
  amount_cents bigint not null,          -- negative to exclude e.g. a test order
  note         text   not null,
  created_by   text   default (auth.jwt() ->> 'email'),
  created_at   timestamptz not null default now()
);
alter table public.revenue_adjustments enable row level security;
drop policy if exists ra_read   on public.revenue_adjustments;
drop policy if exists ra_insert on public.revenue_adjustments;
drop policy if exists ra_delete on public.revenue_adjustments;
create policy ra_read   on public.revenue_adjustments for select to authenticated using (rm_is_admin());
create policy ra_insert on public.revenue_adjustments for insert to authenticated with check (rm_is_admin());
create policy ra_delete on public.revenue_adjustments for delete to authenticated using (rm_is_admin());

-- ── Settings (one row) ─────────────────────────────────────────────────
create table if not exists public.revenue_settings (
  id                 boolean primary key default true check (id),
  cinder_usd_cents   numeric not null default 0,   -- US cents per 1 Cinder; 0 = Vendor Market not counted
  updated_at         timestamptz not null default now()
);
insert into public.revenue_settings (id) values (true) on conflict (id) do nothing;
alter table public.revenue_settings enable row level security;
drop policy if exists rs_read   on public.revenue_settings;
drop policy if exists rs_update on public.revenue_settings;
create policy rs_read   on public.revenue_settings for select to anon, authenticated using (true);
create policy rs_update on public.revenue_settings for update to authenticated using (rm_is_admin()) with check (rm_is_admin());

-- ── Live total ─────────────────────────────────────────────────────────
create or replace function public.revenue_progress()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  rate numeric := coalesce((select cinder_usd_cents from revenue_settings where id), 0);
  shop bigint := 0; pledges bigint := 0; devpts bigint := 0; lic bigint := 0; ads bigint := 0;
  vm_cinder numeric := 0; adj bigint := 0; buyers bigint := 0; orders bigint := 0;
begin
  begin select coalesce(sum(amount_cents),0), count(*) into shop, orders from shop_orders where status = 'paid'; exception when undefined_table then null; end;
  begin select coalesce(sum(amount_cents),0) into pledges from pledge_purchases where status = 'paid'; exception when undefined_table then null; end;
  begin select coalesce(sum(amount_cents),0) into devpts from devpoint_purchases; exception when undefined_table then null; end;
  begin select coalesce(sum(amount_cents),0) into lic from licence_purchases; exception when undefined_table then null; end;
  begin select coalesce(sum(amount_cents),0) into ads from tw_ad_orders where status = 'paid'; exception when undefined_table then null; end;
  if rate > 0 then
    begin select vm_cinder + coalesce(sum(price),0) into vm_cinder from card_market_listings where status = 'sold' and currency in ('cinder','cinders'); exception when undefined_table then null; end;
    begin select vm_cinder + coalesce(sum(price),0) into vm_cinder from boe_market_listings where status = 'paid' and currency in ('cinder','cinders'); exception when undefined_table then null; end;
  end if;
  select coalesce(sum(amount_cents),0) into adj from revenue_adjustments;
  begin
    select count(distinct user_id) into buyers from (
      select user_id from shop_orders where status = 'paid'
      union select user_id from pledge_purchases where status = 'paid'
      union select user_id from devpoint_purchases
      union select user_id from licence_purchases) b;
  exception when undefined_table then null; end;
  return jsonb_build_object(
    'total_cents', shop + pledges + devpts + lic + ads + round(vm_cinder * rate)::bigint + adj,
    'sources', jsonb_build_object(
      'shop', shop + pledges + devpts + lic, 'ads', ads,
      'vendor_market', round(vm_cinder * rate)::bigint, 'adjustments', adj),
    'vendor_market_counted', rate > 0,
    'backers', buyers,
    'as_of', now());
end $$;
revoke all on function public.revenue_progress() from public;
grant execute on function public.revenue_progress() to anon, authenticated;

-- ── Starting milestones (only when the table is empty) ─────────────────
insert into public.revenue_milestones (amount_cents, title, description, unlocks, icon, sort_order)
select * from (values
  (5000000::bigint, 'Payouts Begin',
   'The Cashout Vault opens and Mythic Token LP gets its first fuel. Game Testers are paid out first, then the queue runs from Eternal nodes down to Starter nodes, alphabetical within each tier, for players without an Express subscription.',
   '["Cashout Vault opens — payouts start","Mythic Token LP fuel","Game Testers paid first","Queue: Eternal → Starter nodes, alphabetical (non-Express)"]'::jsonb, '🏦', 10),
  (10000000::bigint, 'Airdrops & Expansion',
   'Bonus airdrops for VIP members, airdrops for every player, and funding for animations, merch, equipment and ads.',
   '["Bonus Airdrops for VIP members","Airdrops for all players","Animations","Merch","Equipment","Ads"]'::jsonb, '🎁', 20),
  (15000000::bigint, 'Games Con 2027',
   'A Mythic Spellbook booth at Games Con 2027.',
   '["Booth at Games Con 2027"]'::jsonb, '🎪', 30),
  (20000000::bigint, 'The Board Game',
   'Development of the Mythic Spellbook board game begins.',
   '["Board game development starts"]'::jsonb, '🎲', 40)
) v(amount_cents, title, description, unlocks, icon, sort_order)
where not exists (select 1 from public.revenue_milestones);
