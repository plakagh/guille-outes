-- ============================================================================
-- Storage: product and author media
--
-- One public-read bucket. Uploads, overwrites and deletions require
-- public.is_admin(), enforced by RLS on storage.objects — the browser never
-- holds a key that can bypass it.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  8 * 1024 * 1024,                                   -- 8 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read the bucket (it backs <img> tags on the storefront).
create policy "media: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

-- Admins may write, but only inside the folders the app uses.
create policy "media: admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('products', 'authors')
  );

create policy "media: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (
    bucket_id = 'media'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('products', 'authors')
  );

create policy "media: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_admin());
