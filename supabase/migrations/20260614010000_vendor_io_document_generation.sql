-- Vendor IO branded document generation (Thinkway_IO_Global.html)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'vendor_io_status' AND e.enumlabel = 'generated'
  ) THEN
    ALTER TYPE public.vendor_io_status ADD VALUE IF NOT EXISTS 'generated' AFTER 'draft';
  END IF;
END $$;

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS generated_html_url text,
  ADD COLUMN IF NOT EXISTS generated_pdf_url text,
  ADD COLUMN IF NOT EXISTS document_generated_at timestamptz;

COMMENT ON COLUMN public.vendor_ios.generated_html_url IS 'Supabase storage URL for rendered Thinkway_IO_Global.html';
COMMENT ON COLUMN public.vendor_ios.generated_pdf_url IS 'Supabase storage URL for PDF export matching HTML layout';
COMMENT ON COLUMN public.vendor_ios.document_generated_at IS 'Timestamp when branded IO document was last generated';

-- Extend io_notifications for email delivery tracking
ALTER TABLE public.io_notifications
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-io-documents',
  'vendor-io-documents',
  true,
  52428800,
  ARRAY['text/html', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: path layout {vendor_io_id}/{file}
DROP POLICY IF EXISTS "vendor_io_documents_storage_select" ON storage.objects;
CREATE POLICY "vendor_io_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-io-documents'
    AND public.has_permission('campaigns.read')
  );

DROP POLICY IF EXISTS "vendor_io_documents_storage_insert" ON storage.objects;
CREATE POLICY "vendor_io_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-io-documents'
    AND public.has_permission('campaigns.write')
    AND public.is_internal_user()
  );

DROP POLICY IF EXISTS "vendor_io_documents_storage_update" ON storage.objects;
CREATE POLICY "vendor_io_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-io-documents'
    AND public.has_permission('campaigns.write')
  );

DROP POLICY IF EXISTS "vendor_io_documents_storage_delete" ON storage.objects;
CREATE POLICY "vendor_io_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-io-documents'
    AND public.has_permission('campaigns.write')
  );
