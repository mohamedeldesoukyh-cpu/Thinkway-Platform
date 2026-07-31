-- Vendor IO delivery tracking (separate from workflow status)
-- delivery_method: email | manual
-- delivery_status: sent | failed | completed

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.vendor_ios
    DROP CONSTRAINT IF EXISTS vendor_ios_delivery_method_check;
  ALTER TABLE public.vendor_ios
    ADD CONSTRAINT vendor_ios_delivery_method_check
    CHECK (
      delivery_method IS NULL
      OR delivery_method = ANY (ARRAY['email'::text, 'manual'::text])
    );
END $$;

DO $$ BEGIN
  ALTER TABLE public.vendor_ios
    DROP CONSTRAINT IF EXISTS vendor_ios_delivery_status_check;
  ALTER TABLE public.vendor_ios
    ADD CONSTRAINT vendor_ios_delivery_status_check
    CHECK (
      delivery_status IS NULL
      OR delivery_status = ANY (ARRAY['sent'::text, 'failed'::text, 'completed'::text])
    );
END $$;

COMMENT ON COLUMN public.vendor_ios.delivery_method IS
  'How the Vendor IO was delivered to the vendor: email or manual. Independent of workflow status.';
COMMENT ON COLUMN public.vendor_ios.delivery_status IS
  'Delivery outcome: sent/failed for email; completed for manual mark-as-sent.';
COMMENT ON COLUMN public.vendor_ios.delivery_error IS
  'Last email delivery error when delivery_status = failed.';
COMMENT ON COLUMN public.vendor_ios.delivered_at IS
  'Timestamp of last delivery attempt (email or manual).';
