-- =============================================================================
-- Thinkway Creator + Client Portals (lightweight operational scope)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Portal uploads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_type text NOT NULL CHECK (portal_type IN ('creator', 'client')),
  entity_type text NOT NULL CHECK (
    entity_type IN ('deliverable', 'publication', 'purchase_order', 'report')
  ),
  entity_id uuid NOT NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size bigint,
  external_link text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS portal_uploads_portal_type_idx
  ON public.portal_uploads (portal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_uploads_entity_idx
  ON public.portal_uploads (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS portal_uploads_campaign_header_idx
  ON public.portal_uploads (campaign_header_id);
CREATE INDEX IF NOT EXISTS portal_uploads_client_idx
  ON public.portal_uploads (client_id);
CREATE INDEX IF NOT EXISTS portal_uploads_influencer_idx
  ON public.portal_uploads (influencer_id);

-- -----------------------------------------------------------------------------
-- Portal notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_type text NOT NULL CHECK (audience_type IN ('creator', 'client')),
  recipient_profile_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS portal_notifications_audience_idx
  ON public.portal_notifications (audience_type, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_notifications_profile_idx
  ON public.portal_notifications (recipient_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_notifications_client_idx
  ON public.portal_notifications (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_notifications_influencer_idx
  ON public.portal_notifications (influencer_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Helper approvals (portal-facing, no token workflow)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_client_io_portal(
  p_client_io_id uuid,
  p_approved_by_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.client_ios%ROWTYPE;
BEGIN
  IF NOT (public.has_permission('client_portal.approve') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_row
  FROM public.client_ios
  WHERE id = p_client_io_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT public.can_access_campaign_header(v_row.campaign_header_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.client_ios
  SET
    status = 'approved'::public.client_io_status,
    approved_at = timezone('utc', now()),
    approved_by_name = COALESCE(NULLIF(p_approved_by_name, ''), 'Client approver'),
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  WHERE id = p_client_io_id;

  INSERT INTO public.portal_notifications (
    audience_type,
    campaign_header_id,
    client_id,
    event_type,
    title,
    message,
    metadata
  )
  VALUES (
    'client',
    v_row.campaign_header_id,
    v_row.client_id,
    'client_io_approved',
    'Client IO approved',
    'Client IO approval was submitted from client portal.',
    jsonb_build_object('client_io_id', p_client_io_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_vendor_io_portal(
  p_vendor_io_id uuid,
  p_approved_by_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.vendor_ios%ROWTYPE;
  v_influencer_id uuid;
BEGIN
  IF NOT (public.has_permission('creator_portal.approve') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_row
  FROM public.vendor_ios
  WHERE id = p_vendor_io_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT i.id
  INTO v_influencer_id
  FROM public.influencers i
  WHERE i.id = v_row.influencer_id
    AND i.profile_id = auth.uid();

  IF v_influencer_id IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.vendor_ios
  SET
    status = 'approved'::public.vendor_io_status,
    approved_at = timezone('utc', now()),
    approved_by_name = COALESCE(NULLIF(p_approved_by_name, ''), 'Creator approver'),
    rejection_reason = NULL,
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  WHERE id = p_vendor_io_id;

  INSERT INTO public.portal_notifications (
    audience_type,
    campaign_header_id,
    influencer_id,
    event_type,
    title,
    message,
    metadata
  )
  VALUES (
    'creator',
    v_row.campaign_header_id,
    v_row.influencer_id,
    'vendor_io_approved',
    'Vendor IO approved',
    'Vendor IO was approved from creator portal.',
    jsonb_build_object('vendor_io_id', p_vendor_io_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_portal_submit_deliverable(
  p_deliverable_id uuid,
  p_content_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deliverable public.deliverables%ROWTYPE;
  v_influencer_id uuid;
BEGIN
  IF NOT (public.has_permission('creator_portal.write') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_deliverable
  FROM public.deliverables
  WHERE id = p_deliverable_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT i.id
  INTO v_influencer_id
  FROM public.influencers i
  WHERE i.id = v_deliverable.influencer_id
    AND i.profile_id = auth.uid();

  IF v_influencer_id IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.deliverables
  SET
    status = CASE
      WHEN status IN ('approved', 'published') THEN status
      ELSE 'submitted'
    END,
    submitted_at = timezone('utc', now()),
    content_url = COALESCE(NULLIF(p_content_url, ''), content_url),
    revision_notes = CASE
      WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN revision_notes
      ELSE p_notes
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_deliverable_id;

  INSERT INTO public.portal_notifications (
    audience_type,
    campaign_header_id,
    influencer_id,
    event_type,
    title,
    message,
    metadata
  )
  VALUES (
    'creator',
    v_deliverable.campaign_id,
    v_deliverable.influencer_id,
    'deliverable_submitted',
    'Deliverable submitted',
    'Creator submitted a deliverable update from creator portal.',
    jsonb_build_object('deliverable_id', p_deliverable_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_portal_set_deliverable_status(
  p_deliverable_id uuid,
  p_decision text,
  p_approved_by_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_header_id uuid;
  v_client_id uuid;
  v_target_status text;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  IF NOT (public.has_permission('client_portal.approve') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT ch.id, ch.client_id
  INTO v_campaign_header_id, v_client_id
  FROM public.deliverables d
  JOIN public.campaign_headers ch ON ch.id = d.campaign_id
  WHERE d.id = p_deliverable_id;

  IF v_campaign_header_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.can_access_campaign_header(v_campaign_header_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_target_status := CASE WHEN p_decision = 'approved' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.deliverables
  SET
    status = v_target_status,
    approved_at = CASE WHEN p_decision = 'approved' THEN timezone('utc', now()) ELSE approved_at END,
    revision_notes = CASE WHEN p_decision = 'rejected' THEN COALESCE(NULLIF(p_approved_by_name, ''), revision_notes) ELSE revision_notes END,
    updated_at = timezone('utc', now())
  WHERE id = p_deliverable_id;

  INSERT INTO public.portal_notifications (
    audience_type,
    campaign_header_id,
    client_id,
    event_type,
    title,
    message,
    metadata
  )
  VALUES (
    'client',
    v_campaign_header_id,
    v_client_id,
    'deliverable_' || p_decision,
    'Deliverable ' || p_decision,
    'Deliverable decision was recorded from client portal.',
    jsonb_build_object('deliverable_id', p_deliverable_id, 'decision', p_decision)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_portal_set_publication_status(
  p_publication_id uuid,
  p_decision text,
  p_approved_by_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_header_id uuid;
  v_client_id uuid;
  v_target_status text;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  IF NOT (public.has_permission('client_portal.approve') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT cp.campaign_header_id, ch.client_id
  INTO v_campaign_header_id, v_client_id
  FROM public.campaign_publications cp
  JOIN public.campaign_headers ch ON ch.id = cp.campaign_header_id
  WHERE cp.id = p_publication_id;

  IF v_campaign_header_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.can_access_campaign_header(v_campaign_header_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_target_status := CASE WHEN p_decision = 'approved' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.campaign_publications
  SET
    status = v_target_status,
    notes = CASE
      WHEN p_decision = 'rejected' THEN
        trim(BOTH FROM COALESCE(notes, '') || ' ' || COALESCE(NULLIF(p_approved_by_name, ''), 'Rejected by client portal'))
      ELSE notes
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_publication_id;

  INSERT INTO public.portal_notifications (
    audience_type,
    campaign_header_id,
    client_id,
    event_type,
    title,
    message,
    metadata
  )
  VALUES (
    'client',
    v_campaign_header_id,
    v_client_id,
    'publication_' || p_decision,
    'Publication ' || p_decision,
    'Publication decision was recorded from client portal.',
    jsonb_build_object('publication_id', p_publication_id, 'decision', p_decision)
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_portal_uploads_updated_at ON public.portal_uploads;
CREATE TRIGGER set_portal_uploads_updated_at
  BEFORE UPDATE ON public.portal_uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.portal_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_uploads FORCE ROW LEVEL SECURITY;

ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_uploads_select ON public.portal_uploads;
CREATE POLICY portal_uploads_select ON public.portal_uploads
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user()
    OR (
      portal_type = 'creator'
      AND public.has_permission('creator_portal.read')
      AND influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.influencers i
        WHERE i.id = influencer_id
          AND i.profile_id = auth.uid()
      )
    )
    OR (
      portal_type = 'client'
      AND public.has_permission('client_portal.read')
      AND client_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.client_users cu
        WHERE cu.client_id = client_id
          AND cu.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS portal_uploads_write ON public.portal_uploads;
CREATE POLICY portal_uploads_write ON public.portal_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user()
    OR (
      portal_type = 'creator'
      AND public.has_permission('creator_portal.write')
      AND influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.influencers i
        WHERE i.id = influencer_id
          AND i.profile_id = auth.uid()
      )
    )
    OR (
      portal_type = 'client'
      AND public.has_permission('client_portal.write')
      AND client_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.client_users cu
        WHERE cu.client_id = client_id
          AND cu.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS portal_notifications_select ON public.portal_notifications;
CREATE POLICY portal_notifications_select ON public.portal_notifications
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user()
    OR (
      audience_type = 'creator'
      AND public.has_permission('creator_portal.read')
      AND (
        recipient_profile_id = auth.uid()
        OR (
          influencer_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.influencers i
            WHERE i.id = influencer_id
              AND i.profile_id = auth.uid()
          )
        )
      )
    )
    OR (
      audience_type = 'client'
      AND public.has_permission('client_portal.read')
      AND (
        recipient_profile_id = auth.uid()
        OR (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_users cu
            WHERE cu.client_id = client_id
              AND cu.profile_id = auth.uid()
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS portal_notifications_write ON public.portal_notifications;
CREATE POLICY portal_notifications_write ON public.portal_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user()
    OR public.has_permission('client_portal.write')
    OR public.has_permission('creator_portal.write')
  );

DROP POLICY IF EXISTS portal_notifications_update ON public.portal_notifications;
CREATE POLICY portal_notifications_update ON public.portal_notifications
  FOR UPDATE TO authenticated
  USING (
    recipient_profile_id = auth.uid()
    OR (
      audience_type = 'creator'
      AND influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.influencers i
        WHERE i.id = influencer_id
          AND i.profile_id = auth.uid()
      )
    )
    OR (
      audience_type = 'client'
      AND client_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.client_users cu
        WHERE cu.client_id = client_id
          AND cu.profile_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    recipient_profile_id = auth.uid()
    OR (
      audience_type = 'creator'
      AND influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.influencers i
        WHERE i.id = influencer_id
          AND i.profile_id = auth.uid()
      )
    )
    OR (
      audience_type = 'client'
      AND client_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.client_users cu
        WHERE cu.client_id = client_id
          AND cu.profile_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.portal_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.portal_notifications TO authenticated;

GRANT EXECUTE ON FUNCTION public.approve_client_io_portal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_vendor_io_portal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_portal_submit_deliverable(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_portal_set_deliverable_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_portal_set_publication_status(uuid, text, text) TO authenticated;
