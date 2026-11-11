-- Storage bucket for PDF slides (run via Supabase dashboard or CLI)
-- The bucket is created via the dashboard, but the policies can be applied here.

insert into storage.buckets (id, name, public)
values ('slides', 'slides', false)
on conflict do nothing;

-- Users can only access their own files (stored under user_id/ prefix)
create policy "slides: upload own files"
  on storage.objects for insert
  with check (
    bucket_id = 'slides'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "slides: read own files"
  on storage.objects for select
  using (
    bucket_id = 'slides'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "slides: delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'slides'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
