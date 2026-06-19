-- Campaign documents (Client BO / booking order attachments)
-- Idempotent

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'campaign_document_type'
  ) THEN
    CREATE TYPE public.campaign_document_type AS ENUM ('client_bo');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campaign_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  document_type public.campaign_document_type NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  notes text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS campaign_documents_campaign_header_id_idx
  ON public.campaign_documents (campaign_header_id);

CREATE INDEX IF NOT EXISTS campaign_documents_document_type_idx
  ON public.campaign_documents (document_type);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_documents_header_type_unique_idx
  ON public.campaign_documents (campaign_header_id, document_type);

DROP TRIGGER IF EXISTS set_campaign_documents_updated_at ON public.campaign_documents;
CREATE TRIGGER set_campaign_documents_updated_at
  BEFORE UPDATE ON public.campaign_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaign_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_documents_select ON public.campaign_documents;
CREATE POLICY campaign_documents_select ON public.campaign_documents
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_documents_write ON public.campaign_documents;
CREATE POLICY campaign_documents_write ON public.campaign_documents
  FOR ALL TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-documents',
  'campaign-documents',
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

DROP POLICY IF EXISTS "campaign_documents_storage_select" ON storage.objects;
CREATE POLICY "campaign_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.read')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "campaign_documents_storage_insert" ON storage.objects;
CREATE POLICY "campaign_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.write')
    AND public.is_internal_user()
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "campaign_documents_storage_update" ON storage.objects;
CREATE POLICY "campaign_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.write')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "campaign_documents_storage_delete" ON storage.objects;
CREATE POLICY "campaign_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.write')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );
