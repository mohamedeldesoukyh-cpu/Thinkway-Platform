-- Client IO branded document generation (Thinkway_Client_IO_Global.html)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'client_io_status' AND e.enumlabel = 'generated'
  ) THEN
    ALTER TYPE public.client_io_status ADD VALUE IF NOT EXISTS 'generated' AFTER 'draft';
  END IF;
END $$;

ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS generated_html_url text,
  ADD COLUMN IF NOT EXISTS generated_pdf_url text,
  ADD COLUMN IF NOT EXISTS document_generated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS client_ios_document_number_unique
  ON public.client_ios (document_number)
  WHERE document_number IS NOT NULL;

COMMENT ON COLUMN public.client_ios.document_number IS 'CIO-YYYY-NNNN client-facing insertion order number';
COMMENT ON COLUMN public.client_ios.generated_html_url IS 'Supabase storage URL for rendered Thinkway_Client_IO_Global.html';
COMMENT ON COLUMN public.client_ios.generated_pdf_url IS 'Supabase storage URL for PDF export matching HTML layout';
COMMENT ON COLUMN public.client_ios.document_generated_at IS 'Timestamp when branded Client IO document was last generated';

-- CIO-YYYY-NNNN (4-digit serial, yearly reset via prefix)
CREATE OR REPLACE FUNCTION public.assign_client_io_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'CIO-' || v_year;
  v_next bigint;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = ds.last_value + 1
    RETURNING last_value INTO v_next;

    NEW.document_number := v_prefix || '-' || lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_client_ios_document_number ON public.client_ios;
CREATE TRIGGER assign_client_ios_document_number
  BEFORE INSERT OR UPDATE ON public.client_ios
  FOR EACH ROW EXECUTE FUNCTION public.assign_client_io_document_number();

-- Backfill document numbers for existing client IOs without one
UPDATE public.client_ios cio
SET document_number = sub.assigned_number
FROM (
  SELECT
    id,
    'CIO-' || to_char(timezone('utc', created_at), 'YYYY') || '-' ||
      lpad(
        row_number() OVER (
          PARTITION BY to_char(timezone('utc', created_at), 'YYYY')
          ORDER BY created_at, id
        )::text,
        4,
        '0'
      ) AS assigned_number
  FROM public.client_ios
  WHERE document_number IS NULL OR btrim(document_number) = ''
) sub
WHERE cio.id = sub.id;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-io-documents',
  'client-io-documents',
  true,
  52428800,
  ARRAY['text/html', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: path layout {client_io_id}/{file}
DROP POLICY IF EXISTS "client_io_documents_storage_select" ON storage.objects;
CREATE POLICY "client_io_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-io-documents'
    AND public.has_permission('campaigns.read')
  );

DROP POLICY IF EXISTS "client_io_documents_storage_insert" ON storage.objects;
CREATE POLICY "client_io_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-io-documents'
    AND public.has_permission('campaigns.write')
    AND public.is_internal_user()
  );

DROP POLICY IF EXISTS "client_io_documents_storage_update" ON storage.objects;
CREATE POLICY "client_io_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-io-documents'
    AND public.has_permission('campaigns.write')
  );

DROP POLICY IF EXISTS "client_io_documents_storage_delete" ON storage.objects;
CREATE POLICY "client_io_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-io-documents'
    AND public.has_permission('campaigns.write')
  );
