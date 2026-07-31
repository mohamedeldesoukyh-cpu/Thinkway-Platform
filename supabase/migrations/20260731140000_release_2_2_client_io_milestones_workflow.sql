-- =============================================================================
-- Release 2.2.C — Billing milestone fields + send → under_client_review workflow
-- Development-first. No invoice eligibility execution (Release 2.3).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Milestone schedule fields (configuration only)
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_io_billing_milestones
  ADD COLUMN IF NOT EXISTS due_trigger text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS due_offset_days integer,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$ BEGIN
  ALTER TABLE public.client_io_billing_milestones
    DROP CONSTRAINT IF EXISTS client_io_billing_milestones_due_trigger_check;
  ALTER TABLE public.client_io_billing_milestones
    ADD CONSTRAINT client_io_billing_milestones_due_trigger_check
    CHECK (
      due_trigger IN (
        'on_approval',
        'on_kickoff',
        'on_completion',
        'on_send',
        'calendar_date',
        'custom'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.client_io_billing_milestones
    DROP CONSTRAINT IF EXISTS client_io_billing_milestones_due_offset_check;
  ALTER TABLE public.client_io_billing_milestones
    ADD CONSTRAINT client_io_billing_milestones_due_offset_check
    CHECK (due_offset_days IS NULL OR due_offset_days >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.client_io_billing_milestones.due_trigger IS
  'Release 2.2: schedule trigger for milestone (not invoice execution).';
COMMENT ON COLUMN public.client_io_billing_milestones.due_offset_days IS
  'Release 2.2: optional days after due_trigger before amount is due.';
COMMENT ON COLUMN public.client_io_billing_milestones.notes IS
  'Release 2.2: free-text notes shown on Client IO schedule.';

-- -----------------------------------------------------------------------------
-- Optional rejected status (client decision path)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'client_io_status'
      AND e.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE public.client_io_status ADD VALUE IF NOT EXISTS 'rejected';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- send_client_io → under_client_review (sent_at still recorded)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_client_io(
  p_client_io_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := public.generate_io_approval_token();

  UPDATE public.client_ios
  SET
    status = 'under_client_review',
    sent_at = COALESCE(sent_at, timezone('utc', now())),
    approval_token_hash = public.hash_io_approval_token(v_token),
    approval_token_expires_at = timezone('utc', now()) + interval '14 days',
    updated_by = p_actor_id,
    updated_at = timezone('utc', now())
  WHERE id = p_client_io_id
    AND is_superseded = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client IO not found or superseded.';
  END IF;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'client',
    p_client_io_id,
    'client_io_sent',
    jsonb_build_object('by', p_actor_id, 'sent_at', timezone('utc', now()))
  );

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'client',
    p_client_io_id,
    'io_pending_approval',
    jsonb_build_object(
      'by', p_actor_id,
      'sent_at', timezone('utc', now()),
      'status', 'under_client_review'
    )
  );

  RETURN v_token;
END;
$$;

-- -----------------------------------------------------------------------------
-- Approve token/portal accept under_client_review (+ legacy sent)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_client_io_by_token(
  p_token text,
  p_approved_by_name text,
  p_approval_ip inet DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_io_id uuid;
BEGIN
  v_hash := public.hash_io_approval_token(p_token);

  UPDATE public.client_ios
  SET
    status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    approval_accessed_at = timezone('utc', now()),
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND is_superseded = false
    AND status IN ('draft', 'generated', 'sent', 'under_client_review')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired approval link.';
  END IF;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'client',
    v_io_id,
    'client_io_approved',
    jsonb_build_object('approved_by', p_approved_by_name, 'approved_at', timezone('utc', now()))
  );

  RETURN v_io_id;
END;
$$;

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

  IF v_row.is_superseded THEN
    RAISE EXCEPTION 'Cannot approve a superseded Client IO version.';
  END IF;

  IF v_row.status NOT IN (
    'draft'::public.client_io_status,
    'generated'::public.client_io_status,
    'sent'::public.client_io_status,
    'under_client_review'::public.client_io_status
  ) THEN
    RAISE EXCEPTION 'Client IO is not awaiting client review.';
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
  WHERE id = p_client_io_id
    AND is_superseded = false;

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
    'Client IO was approved from the client portal.',
    jsonb_build_object(
      'client_io_id', p_client_io_id,
      'approved_by', COALESCE(NULLIF(p_approved_by_name, ''), 'Client approver')
    )
  );

  RETURN true;
END;
$$;
