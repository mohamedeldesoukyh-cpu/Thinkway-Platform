-- Group / brand logo URLs + public storage for Client Workspace identity marks.
-- Clients already have logo_url. Development first.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.groups.logo_url IS
  'Public URL of the uploaded group logo. Preferred identity mark on Client Workspace.';
COMMENT ON COLUMN public.brands.logo_url IS
  'Public URL of the uploaded brand logo.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entity-logos',
  'entity-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS entity_logos_service ON storage.objects;
CREATE POLICY entity_logos_service
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'entity-logos')
  WITH CHECK (bucket_id = 'entity-logos');

DROP POLICY IF EXISTS entity_logos_authenticated_select ON storage.objects;
CREATE POLICY entity_logos_authenticated_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'entity-logos');

DROP POLICY IF EXISTS entity_logos_public_select ON storage.objects;
CREATE POLICY entity_logos_public_select
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'entity-logos');

DROP POLICY IF EXISTS entity_logos_authenticated_insert ON storage.objects;
CREATE POLICY entity_logos_authenticated_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'entity-logos');

DROP POLICY IF EXISTS entity_logos_authenticated_update ON storage.objects;
CREATE POLICY entity_logos_authenticated_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'entity-logos')
  WITH CHECK (bucket_id = 'entity-logos');

DROP POLICY IF EXISTS entity_logos_authenticated_delete ON storage.objects;
CREATE POLICY entity_logos_authenticated_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'entity-logos');
