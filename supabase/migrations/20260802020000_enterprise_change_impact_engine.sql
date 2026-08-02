-- Release 2.2d.2b — Enterprise Change Impact Engine
-- Target: Development (hsxrewjcbvmbkqdlzjhs). Production requires explicit approval.
--
-- Sits ABOVE Document Lifecycle:
--   Business Change → Impact Assessment → Document transitions + Decision Center /
--   Timeline / Notification intents / AI-ready recommendations.
-- Document Lifecycle remains responsible only for document state transitions.

CREATE TABLE IF NOT EXISTS public.change_impact_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_change_event_id uuid NOT NULL
    REFERENCES public.business_change_events(id) ON DELETE CASCADE,
  campaign_header_id uuid REFERENCES public.campaign_headers(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  reason_code text NOT NULL,
  reason_detail text,
  severity text NOT NULL,
  business_impact_summary text NOT NULL,
  business_impact_detail text,
  recommended_actions text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'open',
  ai_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT change_impact_assessments_severity_check
    CHECK (severity = ANY (ARRAY[
      'critical'::text,
      'high'::text,
      'medium'::text,
      'low'::text,
      'info'::text
    ])),
  CONSTRAINT change_impact_assessments_status_check
    CHECK (status = ANY (ARRAY[
      'open'::text,
      'acknowledged'::text,
      'resolved'::text,
      'dismissed'::text
    ]))
);

CREATE INDEX IF NOT EXISTS change_impact_assessments_campaign_open_idx
  ON public.change_impact_assessments (campaign_header_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS change_impact_assessments_event_idx
  ON public.change_impact_assessments (business_change_event_id);

COMMENT ON TABLE public.change_impact_assessments IS
  'Enterprise Change Impact Engine — why a business change matters and what to do next.';

CREATE TABLE IF NOT EXISTS public.change_impact_affected_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL
    REFERENCES public.change_impact_assessments(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id uuid,
  object_label text,
  role text NOT NULL DEFAULT 'affected',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT change_impact_affected_objects_role_check
    CHECK (role = ANY (ARRAY['source'::text, 'affected'::text, 'related'::text]))
);

CREATE INDEX IF NOT EXISTS change_impact_affected_objects_assessment_idx
  ON public.change_impact_affected_objects (assessment_id);

CREATE TABLE IF NOT EXISTS public.change_impact_document_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL
    REFERENCES public.change_impact_assessments(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  document_label text,
  from_status text,
  planned_to_status text,
  severity text NOT NULL,
  impact_explanation text NOT NULL,
  recommended_actions text[] NOT NULL DEFAULT '{}'::text[],
  lifecycle_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_impact_document_impacts_assessment_idx
  ON public.change_impact_document_impacts (assessment_id);

CREATE INDEX IF NOT EXISTS change_impact_document_impacts_document_idx
  ON public.change_impact_document_impacts (document_type, document_id);

CREATE TABLE IF NOT EXISTS public.change_impact_notification_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL
    REFERENCES public.change_impact_assessments(id) ON DELETE CASCADE,
  audience text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT change_impact_notification_intents_status_check
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'delivered'::text,
      'skipped'::text,
      'failed'::text
    ]))
);

CREATE INDEX IF NOT EXISTS change_impact_notification_intents_pending_idx
  ON public.change_impact_notification_intents (status, created_at DESC)
  WHERE status = 'pending';

COMMENT ON TABLE public.change_impact_notification_intents IS
  'Notification feed from Change Impact Engine — delivery adapters consume pending intents.';

ALTER TABLE public.change_impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_impact_affected_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_impact_document_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_impact_notification_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_impact_assessments_select ON public.change_impact_assessments;
CREATE POLICY change_impact_assessments_select
  ON public.change_impact_assessments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS change_impact_assessments_insert ON public.change_impact_assessments;
CREATE POLICY change_impact_assessments_insert
  ON public.change_impact_assessments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS change_impact_assessments_update ON public.change_impact_assessments;
CREATE POLICY change_impact_assessments_update
  ON public.change_impact_assessments FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS change_impact_affected_objects_select ON public.change_impact_affected_objects;
CREATE POLICY change_impact_affected_objects_select
  ON public.change_impact_affected_objects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS change_impact_affected_objects_insert ON public.change_impact_affected_objects;
CREATE POLICY change_impact_affected_objects_insert
  ON public.change_impact_affected_objects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS change_impact_document_impacts_select ON public.change_impact_document_impacts;
CREATE POLICY change_impact_document_impacts_select
  ON public.change_impact_document_impacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS change_impact_document_impacts_insert ON public.change_impact_document_impacts;
CREATE POLICY change_impact_document_impacts_insert
  ON public.change_impact_document_impacts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS change_impact_notification_intents_select ON public.change_impact_notification_intents;
CREATE POLICY change_impact_notification_intents_select
  ON public.change_impact_notification_intents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS change_impact_notification_intents_insert ON public.change_impact_notification_intents;
CREATE POLICY change_impact_notification_intents_insert
  ON public.change_impact_notification_intents FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.change_impact_assessments TO authenticated;
GRANT SELECT, INSERT ON public.change_impact_affected_objects TO authenticated;
GRANT SELECT, INSERT ON public.change_impact_document_impacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.change_impact_notification_intents TO authenticated;
