-- Idempotent one-click IO approval + diagnosable token outcomes.
-- Retains a consumed token hash so repeat clicks return "already approved"
-- without duplicate notifications / side effects.

ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS approval_token_consumed_hash text;

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS approval_token_consumed_hash text;

CREATE INDEX IF NOT EXISTS client_ios_approval_token_consumed_hash_idx
  ON public.client_ios (approval_token_consumed_hash)
  WHERE approval_token_consumed_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendor_ios_approval_token_consumed_hash_idx
  ON public.vendor_ios (approval_token_consumed_hash)
  WHERE approval_token_consumed_hash IS NOT NULL;

COMMENT ON COLUMN public.client_ios.approval_token_consumed_hash IS
  'Hash of the last approval token after use or supersession — enables idempotent approve + friendly outcomes.';
COMMENT ON COLUMN public.vendor_ios.approval_token_consumed_hash IS
  'Hash of the last approval token after use or supersession — enables idempotent approve + friendly outcomes.';

-- On supersede: keep hash for diagnosis, clear active token.
CREATE OR REPLACE FUNCTION public.clear_io_approval_token_on_supersede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_superseded IS TRUE AND COALESCE(OLD.is_superseded, false) IS DISTINCT FROM TRUE THEN
    IF NEW.approval_token_hash IS NOT NULL THEN
      NEW.approval_token_consumed_hash := COALESCE(
        NEW.approval_token_consumed_hash,
        NEW.approval_token_hash
      );
    END IF;
    NEW.approval_token_hash := NULL;
    NEW.approval_token_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.approve_client_io_by_token(text, text, inet);
CREATE FUNCTION public.approve_client_io_by_token(
  p_token text,
  p_approved_by_name text,
  p_approval_ip inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_io_id uuid;
  v_row public.client_ios%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;

  v_hash := public.hash_io_approval_token(p_token);

  UPDATE public.client_ios
  SET
    status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    approval_accessed_at = timezone('utc', now()),
    approval_token_consumed_hash = v_hash,
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    approved_revision_number = revision_number,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND is_superseded = false
    AND status IN ('draft', 'generated', 'sent', 'under_client_review')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NOT NULL THEN
    INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
    VALUES (
      'client',
      v_io_id,
      'client_io_approved',
      jsonb_build_object('approved_by', p_approved_by_name, 'approved_at', timezone('utc', now()))
    );

    RETURN jsonb_build_object(
      'io_id', v_io_id,
      'already_approved', false
    );
  END IF;

  -- Idempotent path: token already consumed and document approved.
  SELECT * INTO v_row
  FROM public.client_ios
  WHERE approval_token_consumed_hash = v_hash
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    IF v_row.is_superseded THEN
      RAISE EXCEPTION 'APPROVAL_SUPERSEDED';
    END IF;
    IF v_row.status = 'approved' THEN
      RETURN jsonb_build_object(
        'io_id', v_row.id,
        'already_approved', true
      );
    END IF;
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;

  -- Active token still present but not approvable — diagnose.
  SELECT * INTO v_row
  FROM public.client_ios
  WHERE approval_token_hash = v_hash
  LIMIT 1;

  IF FOUND THEN
    IF v_row.is_superseded THEN
      RAISE EXCEPTION 'APPROVAL_SUPERSEDED';
    END IF;
    IF v_row.approval_token_expires_at IS NOT NULL
       AND v_row.approval_token_expires_at <= timezone('utc', now()) THEN
      RAISE EXCEPTION 'APPROVAL_EXPIRED';
    END IF;
    IF v_row.status = 'approved' THEN
      RETURN jsonb_build_object(
        'io_id', v_row.id,
        'already_approved', true
      );
    END IF;
  END IF;

  RAISE EXCEPTION 'APPROVAL_INVALID';
END;
$$;

DROP FUNCTION IF EXISTS public.approve_vendor_io_by_token(text, text, inet);
CREATE FUNCTION public.approve_vendor_io_by_token(
  p_token text,
  p_approved_by_name text,
  p_approval_ip inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_io_id uuid;
  v_row public.vendor_ios%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;

  v_hash := public.hash_io_approval_token(p_token);

  UPDATE public.vendor_ios
  SET
    status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    approval_accessed_at = timezone('utc', now()),
    approval_token_consumed_hash = v_hash,
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    approved_revision_number = revision_number,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND is_superseded = false
    AND status IN ('draft', 'generated', 'sent', 'rejected')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NOT NULL THEN
    INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
    VALUES (
      'vendor',
      v_io_id,
      'vendor_io_approved',
      jsonb_build_object('approved_by', p_approved_by_name, 'approved_at', timezone('utc', now()))
    );

    RETURN jsonb_build_object(
      'io_id', v_io_id,
      'already_approved', false
    );
  END IF;

  SELECT * INTO v_row
  FROM public.vendor_ios
  WHERE approval_token_consumed_hash = v_hash
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    IF v_row.is_superseded THEN
      RAISE EXCEPTION 'APPROVAL_SUPERSEDED';
    END IF;
    IF v_row.status = 'approved' THEN
      RETURN jsonb_build_object(
        'io_id', v_row.id,
        'already_approved', true
      );
    END IF;
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;

  SELECT * INTO v_row
  FROM public.vendor_ios
  WHERE approval_token_hash = v_hash
  LIMIT 1;

  IF FOUND THEN
    IF v_row.is_superseded THEN
      RAISE EXCEPTION 'APPROVAL_SUPERSEDED';
    END IF;
    IF v_row.approval_token_expires_at IS NOT NULL
       AND v_row.approval_token_expires_at <= timezone('utc', now()) THEN
      RAISE EXCEPTION 'APPROVAL_EXPIRED';
    END IF;
    IF v_row.status = 'approved' THEN
      RETURN jsonb_build_object(
        'io_id', v_row.id,
        'already_approved', true
      );
    END IF;
  END IF;

  RAISE EXCEPTION 'APPROVAL_INVALID';
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_client_io_by_token(text, text, inet) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_vendor_io_by_token(text, text, inet) TO anon, authenticated;
