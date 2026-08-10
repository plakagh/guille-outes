-- ============================================================================
-- Harden public gallery uploads
--
-- The media bucket allows SVG because administrators may upload trusted product
-- artwork. Public gallery uploads must stay raster-only: extension checks alone
-- can be bypassed by naming an SVG `something.png`, so the storage policy also
-- checks the MIME metadata Supabase stores for the object.
-- ============================================================================

drop policy if exists "media: gallery insert own folder" on storage.objects;

create policy "media: gallery insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'gallery'
    and (storage.foldername(name))[2] = auth.uid()::text
    and name ~* '\.(jpe?g|png|webp|avif)$'
    and lower(coalesce(metadata ->> 'mimetype', '')) in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif'
    )
  );
