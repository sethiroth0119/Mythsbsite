-- ============================================================================
-- Real backer counts + one-backing-per-player.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc).
-- Idempotent and NON-DESTRUCTIVE — it never touches anyone's locked funds.
--
--  1) cinder_backer_counts — a public AGGREGATE of active locks. A profile has
--     backers ONLY if real Cinder / Mythic Token is locked in it. Counts
--     DISTINCT people, so one player is one backer no matter how many rows.
--  2) A partial unique index so a player can hold only ONE active backing per
--     profile. (Released locks don't count, so they can back again later.)
-- ============================================================================

-- ── 1) The public count view ────────────────────────────────────────────────
-- Individual cinder_backings rows stay private (RLS); only these totals are
-- readable, which is what the Discover cards and profile pages display.
create or replace view public.cinder_backer_counts as
  select profile_id,
         count(distinct user_id)::int                                            as backers,
         coalesce(sum(case when currency = 'MT'  then amount else 0 end), 0)::numeric as locked_mt,
         coalesce(sum(case when currency <> 'MT' then amount else 0 end), 0)::numeric as locked_cinder
    from public.cinder_backings
   where released = false
   group by profile_id;

grant select on public.cinder_backer_counts to anon, authenticated;

-- ── 2) One ACTIVE backing per player per profile ────────────────────────────
-- Existing duplicates are REAL locked value, so we never delete or release
-- them automatically. If any exist the index is skipped with a notice instead
-- of failing the script; clear them in-app, then re-run this file.
do $$
declare dupes int;
begin
  select count(*) into dupes
    from (select user_id, profile_id
            from public.cinder_backings
           where released = false
           group by user_id, profile_id
          having count(*) > 1) d;

  if dupes > 0 then
    raise notice '⚠ Skipped the one-backing-per-profile index: % player/profile pair(s) already hold multiple ACTIVE backings. Nothing was changed — those are real locked funds. Release the extras in-app, then re-run this script.', dupes;
  else
    create unique index if not exists cinder_backings_one_active_per_profile
      on public.cinder_backings (user_id, profile_id)
      where released = false;
    raise notice '✅ One-backing-per-profile rule is now enforced in the database.';
  end if;
end $$;

-- Handy: list any duplicate active backings to review.
--   select user_id, profile_id, count(*), sum(amount)
--     from public.cinder_backings where released = false
--    group by user_id, profile_id having count(*) > 1;
