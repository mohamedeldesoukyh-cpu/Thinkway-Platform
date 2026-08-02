-- Release 2.2d.2 — Enterprise Document Lifecycle Engine (tables + reason columns)
-- Business State (campaign) remains separate from Document State.
-- Reason codes power Timeline · Audit · AI · Reporting.

-- ---------------------------------------------------------------------------
-- Reason / lifecycle metadata on IO tip documents
-- ---------------------------------------------------------------------------

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS lifecycle_reason_code text,
  ADD COLUMN IF NOT EXISTS lifecycle_reason_detail text,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_by uuid;

ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS lifecycle_reason_code text,
  ADD COLUMN IF NOT EXISTS lifecycle_reason_detail text,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_by uuid;

COMMENT ON COLUMN public.vendor_ios.lifecycle_reason_code IS
  'Document lifecycle reason code (e.g. creator_price_changed). Never blank when status = revision_required / cancelled.';
COMMENT ON COLUMN public.vendor_ios.lifecycle_reason_detail IS
  'Human-readable reason for the latest lifecycle transition.';
COMMENT ON COLUMN public.client_ios.lifecycle_reason_code IS
  'Document lifecycle reason code for Client IO tip transitions.';

-- ---------------------------------------------------------------------------
-- Business change events → multi-document reactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.business_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  reason_code text NOT NULL,
  reason_detail text,
  campaign_header_id uuid REFERENCES public.campaign_headers(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_change_events_campaign_idx
  ON public.business_change_events (campaign_header_id, created_at DESC);

CREATE INDEX IF NOT EXISTS business_change_events_type_idx
  ON public.business_change_events (event_type, created_at DESC);

COMMENT ON TABLE public.business_change_events IS
  'Enterprise Document Lifecycle: one business event can drive many document reactions. AI-ready payload.';

CREATE TABLE IF NOT EXISTS public.document_lifecycle_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_change_event_id uuid NOT NULL
    REFERENCES public.business_change_events(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason_code text NOT NULL,
  reason_detail text,
  recommended_actions text[] NOT NULL DEFAULT '{}'::text[],
  ai_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_lifecycle_reactions_event_idx
  ON public.document_lifecycle_reactions (business_change_event_id);

CREATE INDEX IF NOT EXISTS document_lifecycle_reactions_document_idx
  ON public.document_lifecycle_reactions (document_type, document_id, created_at DESC);

COMMENT ON TABLE public.document_lifecycle_reactions IS
  'Per-document outcomes of a business change event (Revision Required, Cancelled, etc.).';
COMMENT ON COLUMN public.document_lifecycle_reactions.ai_context IS
  'AI-ready context: estimated impact, detection notes, suggested bulk regenerate — no AI execution yet.';

-- ---------------------------------------------------------------------------
-- RLS (internal authenticated ops — align with IO tables)
-- ---------------------------------------------------------------------------

ALTER TABLE public.business_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_lifecycle_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_change_events_select_authenticated ON public.business_change_events;
CREATE POLICY business_change_events_select_authenticated
  ON public.business_change_events
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS business_change_events_insert_authenticated ON public.business_change_events;
CREATE POLICY business_change_events_insert_authenticated
  ON public.business_change_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS document_lifecycle_reactions_select_authenticated ON public.document_lifecycle_reactions;
CREATE POLICY document_lifecycle_reactions_select_authenticated
  ON public.document_lifecycle_reactions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS document_lifecycle_reactions_insert_authenticated ON public.document_lifecycle_reactions;
CREATE POLICY document_lifecycle_reactions_insert_authenticated
  ON public.document_lifecycle_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.business_change_events TO authenticated;
GRANT SELECT, INSERT ON public.document_lifecycle_reactions TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: campaign-cancel Vendor IOs that were stored as rejected
-- ---------------------------------------------------------------------------

UPDATE public.vendor_ios
SET
  status = 'cancelled'::public.vendor_io_status,
  lifecycle_reason_code = COALESCE(lifecycle_reason_code, 'campaign_cancelled'),
  lifecycle_reason_detail = COALESCE(
    lifecycle_reason_detail,
    NULLIF(rejection_reason, ''),
    'Campaign cancelled'
  ),
  lifecycle_changed_at = COALESCE(lifecycle_changed_at, updated_at, now())
WHERE status = 'rejected'::public.vendor_io_status
  AND rejection_reason ILIKE '%campaign cancell%';
