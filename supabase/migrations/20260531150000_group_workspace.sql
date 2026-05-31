-- Group workspace: region, account director, documents
-- Idempotent

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS account_director_id uuid
  REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS groups_account_director_id_idx ON public.groups (account_director_id);
CREATE INDEX IF NOT EXISTS groups_region_idx ON public.groups (region);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'group_document_type') THEN
    CREATE TYPE public.group_document_type AS ENUM (
      'nda', 'agreement', 'tax_document', 'group_contract'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  document_type public.group_document_type NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  expires_at date,
  notes text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS group_documents_group_id_idx ON public.group_documents (group_id);
CREATE INDEX IF NOT EXISTS group_documents_document_type_idx ON public.group_documents (document_type);

DROP TRIGGER IF EXISTS set_group_documents_updated_at ON public.group_documents;
CREATE TRIGGER set_group_documents_updated_at
  BEFORE UPDATE ON public.group_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.group_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_documents FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission('clients.read')
    AND (
      EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.group_id = p_group_id AND public.can_access_client(c.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = p_group_id AND g.created_by = auth.uid()
      )
      OR public.is_internal_user()
    );
$$;

DROP POLICY IF EXISTS group_documents_select ON public.group_documents;
CREATE POLICY group_documents_select ON public.group_documents
  FOR SELECT TO authenticated
  USING (public.has_permission('clients.read') AND public.can_access_group(group_id));

DROP POLICY IF EXISTS group_documents_write ON public.group_documents;
CREATE POLICY group_documents_write ON public.group_documents
  FOR ALL TO authenticated
  USING (public.has_permission('clients.write') AND public.can_access_group(group_id))
  WITH CHECK (public.has_permission('clients.write') AND public.can_access_group(group_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-documents',
  'group-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "group_documents_storage_select" ON storage.objects;
CREATE POLICY "group_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'group-documents'
    AND public.has_permission('clients.read')
    AND public.can_access_group((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "group_documents_storage_insert" ON storage.objects;
CREATE POLICY "group_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'group-documents'
    AND public.has_permission('clients.write')
    AND public.can_access_group((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "group_documents_storage_delete" ON storage.objects;
CREATE POLICY "group_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'group-documents'
    AND public.has_permission('clients.write')
    AND public.can_access_group((storage.foldername(name))[1]::uuid)
  );
