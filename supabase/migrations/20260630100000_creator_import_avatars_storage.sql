-- Public storage for creator profile photos extracted during Discovery Import (PDF/ZIP).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-avatars',
  'creator-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS creator_avatars_service ON storage.objects;
CREATE POLICY creator_avatars_service
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'creator-avatars')
  WITH CHECK (bucket_id = 'creator-avatars');
