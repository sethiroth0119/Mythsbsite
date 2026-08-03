-- ============================================================================
-- Emergency Broadcast — threaded comments (nested replies).
-- Adds a thread_root pointer so a whole conversation loads in one query.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc). Idempotent.
-- Safe to run after the app is already live: the client falls back to a flat
-- read until this column exists, so nothing breaks in between.
-- ============================================================================

-- The id of the TOP-LEVEL post a comment ultimately hangs under.
--   • top-level posts .............. thread_root IS NULL
--   • a reply to a post ............ thread_root = that post's id
--   • a reply to a comment ......... thread_root = the same top post's id
alter table public.eb_posts add column if not exists thread_root uuid;

-- Backfill: every existing reply today is exactly one level deep (reply_to is
-- always the top post), so its root is simply its reply_to.
update public.eb_posts
   set thread_root = reply_to
 where reply_to is not null
   and thread_root is null;

-- One query pulls an entire thread, oldest first.
create index if not exists eb_posts_thread_root_idx
  on public.eb_posts (thread_root, created_at);
