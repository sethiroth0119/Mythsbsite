-- ============================================================================
-- training-docs — public Storage bucket for admin-uploaded PDF guides.
-- Run once in the Supabase SQL editor (project ktsiasyjusesawtrwrjc). Idempotent.
-- Admins upload PDFs from their device; every player can read them.
-- ============================================================================

-- 1) Create (or update) the bucket — public, 200 MB cap, PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-docs', 'training-docs', true, 209715200, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 209715200,
      allowed_mime_types = array['application/pdf'];

-- 2) Policies on storage.objects (RLS already enabled on that table).
drop policy if exists "training_docs_public_read" on storage.objects;
drop policy if exists "training_docs_own_insert"  on storage.objects;
drop policy if exists "training_docs_own_delete"  on storage.objects;

-- Anyone can read a published guide.
create policy "training_docs_public_read"
  on storage.objects for select
  using (bucket_id = 'training-docs');

-- A signed-in admin uploads into their own uid folder (the app only exposes the
-- upload button to admins; RLS on eb_docs is the real gate on what gets listed).
create policy "training_docs_own_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'training-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Uploader can delete their own files.
create policy "training_docs_own_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'training-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
