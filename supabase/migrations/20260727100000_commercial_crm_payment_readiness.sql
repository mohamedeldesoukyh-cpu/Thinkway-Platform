-- Commercial CRM Payment Readiness: bank account payment fields,
-- signed IO artifacts (upload or external link), IO communication log,
-- payment timeline events. Additive only — no duplicate payment system.

-- 1) Bank account payment fields
ALTER TABLE public.influencer_bank_accounts
  ADD COLUMN IF NOT EXISTS beneficiary_name text,
  ADD COLUMN IF NOT EXISTS relationship_type text,
  ADD COLUMN IF NOT EXISTS relationship_description text,
  ADD COLUMN IF NOT EXISTS branch_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS routing_number text,
  ADD COLUMN IF NOT EXISTS sort_code text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS tax_number text;

-- Backfill beneficiary from account_holder when empty
UPDATE public.influencer_bank_accounts
SET beneficiary_name = account_holder
WHERE beneficiary_name IS NULL
  AND account_holder IS NOT NULL
  AND trim(account_holder) <> '';

COMMENT ON COLUMN public.influencer_bank_accounts.relationship_type IS
  'account_owner | parent | spouse | agency | management_company | business_partner | other';

-- 2) Signed IO artifacts (prefer links; optional file upload path)
CREATE TABLE IF NOT EXISTS public.vendor_io_signed_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_io_id uuid NOT NULL REFERENCES public.vendor_ios (id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  artifact_kind text NOT NULL CHECK (artifact_kind IN ('upload', 'external_link')),
  provider text,
  file_name text,
  url text,
  storage_path text,
  version_label text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS vendor_io_signed_artifacts_io_idx
  ON public.vendor_io_signed_artifacts (vendor_io_id);

CREATE INDEX IF NOT EXISTS vendor_io_signed_artifacts_influencer_idx
  ON public.vendor_io_signed_artifacts (influencer_id);

ALTER TABLE public.vendor_io_signed_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_io_signed_artifacts_all ON public.vendor_io_signed_artifacts;
CREATE POLICY vendor_io_signed_artifacts_all
  ON public.vendor_io_signed_artifacts FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_io_signed_artifacts TO authenticated, service_role;

-- 3) IO / payment communication log (manual now; auto later)
CREATE TABLE IF NOT EXISTS public.vendor_io_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.campaign_influencers (id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (
    channel IN ('email', 'whatsapp', 'instagram_dm', 'tiktok', 'phone', 'manual')
  ),
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound', 'internal')),
  subject text,
  body text,
  external_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  logged_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS vendor_io_communications_io_idx
  ON public.vendor_io_communications (vendor_io_id);

CREATE INDEX IF NOT EXISTS vendor_io_communications_influencer_idx
  ON public.vendor_io_communications (influencer_id);

ALTER TABLE public.vendor_io_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_io_communications_all ON public.vendor_io_communications;
CREATE POLICY vendor_io_communications_all
  ON public.vendor_io_communications FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_io_communications TO authenticated, service_role;

-- 4) Payment / IO operational timeline events (chronological, reusable)
CREATE TABLE IF NOT EXISTS public.vendor_payment_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.campaign_influencers (id) ON DELETE SET NULL,
  vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS vendor_payment_timeline_events_influencer_idx
  ON public.vendor_payment_timeline_events (influencer_id, created_at DESC);

ALTER TABLE public.vendor_payment_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_payment_timeline_events_all ON public.vendor_payment_timeline_events;
CREATE POLICY vendor_payment_timeline_events_all
  ON public.vendor_payment_timeline_events FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payment_timeline_events TO authenticated, service_role;
