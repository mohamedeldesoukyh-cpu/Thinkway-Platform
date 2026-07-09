-- =============================================================================
-- Release 1 — Campaign Brief Intelligence (CIP)
-- Single SSOT for campaign understanding (evolves CampaignFacts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_intelligence_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid,
  storage_bucket text NOT NULL DEFAULT 'campaign-intelligence-documents',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes integer,
  parse_status text NOT NULL DEFAULT 'pending'
    CHECK (parse_status IN ('pending', 'parsing', 'parsed', 'failed')),
  parsed_text text,
  parse_error text,
  uploaded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.campaign_intelligence_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.ai_conversations (id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'saved')),
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_document_id uuid REFERENCES public.campaign_intelligence_documents (id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.campaign_intelligence_documents
  DROP CONSTRAINT IF EXISTS campaign_intelligence_documents_profile_id_fkey;

ALTER TABLE public.campaign_intelligence_documents
  ADD CONSTRAINT campaign_intelligence_documents_profile_id_fkey
  FOREIGN KEY (profile_id)
  REFERENCES public.campaign_intelligence_profiles (id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS campaign_intelligence_profiles_created_by_idx
  ON public.campaign_intelligence_profiles (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS campaign_intelligence_profiles_conversation_idx
  ON public.campaign_intelligence_profiles (conversation_id)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_intelligence_profiles_status_idx
  ON public.campaign_intelligence_profiles (status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_campaign_intelligence_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_intelligence_profiles_updated_at_trg
  ON public.campaign_intelligence_profiles;
CREATE TRIGGER campaign_intelligence_profiles_updated_at_trg
  BEFORE UPDATE ON public.campaign_intelligence_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_campaign_intelligence_profiles_updated_at();

ALTER TABLE public.campaign_intelligence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_intelligence_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_intelligence_profiles_select ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_select ON public.campaign_intelligence_profiles
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_read_ai_conversations()
  );

DROP POLICY IF EXISTS campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS campaign_intelligence_profiles_update ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_update ON public.campaign_intelligence_profiles
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS campaign_intelligence_profiles_delete ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_delete ON public.campaign_intelligence_profiles
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS campaign_intelligence_documents_select ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_select ON public.campaign_intelligence_documents
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.can_read_ai_conversations()
  );

DROP POLICY IF EXISTS campaign_intelligence_documents_insert ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_insert ON public.campaign_intelligence_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS campaign_intelligence_documents_update ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_update ON public.campaign_intelligence_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_intelligence_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.campaign_intelligence_documents TO authenticated;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-intelligence-documents',
  'campaign-intelligence-documents',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/msword'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS campaign_intelligence_docs_storage_select ON storage.objects;
CREATE POLICY campaign_intelligence_docs_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-intelligence-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS campaign_intelligence_docs_storage_insert ON storage.objects;
CREATE POLICY campaign_intelligence_docs_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-intelligence-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS campaign_intelligence_docs_storage_delete ON storage.objects;
CREATE POLICY campaign_intelligence_docs_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-intelligence-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON TABLE public.campaign_intelligence_profiles IS
  'Campaign Brief Intelligence — SSOT for structured campaign understanding (Release 1).';
