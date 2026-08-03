-- ===============================================================
-- Game Cards — public Card List catalog (admin-managed)
-- Run once in the Supabase SQL editor.
-- Public can READ; only the admin email can INSERT/UPDATE/DELETE.
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.game_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  card_number text,
  type text,
  faction text,
  element text,
  rarity text default 'Common',
  cost int,
  hp int,
  atk int,
  def int,
  mag int,
  res int,
  spd int,
  effect text,
  flavor text,
  art_url text,
  set_name text,
  illustrator text,
  release_date date,
  status text default 'released',   -- 'released' | 'coming'
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS game_cards_status_idx ON public.game_cards(status);

ALTER TABLE public.game_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_cards_public_read"  ON public.game_cards;
DROP POLICY IF EXISTS "game_cards_admin_insert" ON public.game_cards;
DROP POLICY IF EXISTS "game_cards_admin_update" ON public.game_cards;
DROP POLICY IF EXISTS "game_cards_admin_delete" ON public.game_cards;

-- Anyone (even signed-out visitors) can read the card list.
CREATE POLICY "game_cards_public_read"
  ON public.game_cards FOR SELECT
  USING (true);

-- Only the admin email can write.
CREATE POLICY "game_cards_admin_insert"
  ON public.game_cards FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'richaegisop@gmail.com');

CREATE POLICY "game_cards_admin_update"
  ON public.game_cards FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'richaegisop@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'richaegisop@gmail.com');

CREATE POLICY "game_cards_admin_delete"
  ON public.game_cards FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'richaegisop@gmail.com');
