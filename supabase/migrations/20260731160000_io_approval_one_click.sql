-- One-click IO approval audit fields + vendor supersession guard on token approve.

ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS approved_by_email text,
  ADD COLUMN IF NOT EXISTS approved_revision_number integer;

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS approved_by_email text,
  ADD COLUMN IF NOT EXISTS approved_revision_number integer;

COMMENT ON COLUMN public.client_ios.approved_by_email IS
  'Email address of the external approver when Client IO is approved via secure link.';
COMMENT ON COLUMN public.client_ios.approved_revision_number IS
  'Document revision_number that was approved (audit).';
COMMENT ON COLUMN public.vendor_ios.approved_by_email IS
  'Email address of the external approver when Vendor IO is approved via secure link.';
COMMENT ON COLUMN public.vendor_ios.approved_revision_number IS
  'Document revision_number that was approved (audit).';

-- Invalidate approval links when a document version is superseded.
CREATE OR REPLACE FUNCTION public.clear_io_approval_token_on_supersede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_superseded IS TRUE AND COALESCE(OLD.is_superseded, false) IS DISTINCT FROM TRUE THEN
    NEW.approval_token_hash := NULL;
    NEW.approval_token_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_ios_clear_approval_token_on_supersede ON public.client_ios;
CREATE TRIGGER client_ios_clear_approval_token_on_supersede
  BEFORE UPDATE OF is_superseded ON public.client_ios
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_io_approval_token_on_supersede();

DROP TRIGGER IF EXISTS vendor_ios_clear_approval_token_on_supersede ON public.vendor_ios;
CREATE TRIGGER vendor_ios_clear_approval_token_on_supersede
  BEFORE UPDATE OF is_superseded ON public.vendor_ios
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_io_approval_token_on_supersede();

-- Vendor token approve must reject superseded versions (align with Client IO).
CREATE OR REPLACE FUNCTION public.approve_vendor_io_by_token(
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

  UPDATE public.vendor_ios
  SET
    status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    approval_accessed_at = timezone('utc', now()),
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    approved_revision_number = revision_number,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND is_superseded = false
    AND status IN ('draft', 'generated', 'sent', 'rejected')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired approval link.';
  END IF;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'vendor',
    v_io_id,
    'vendor_io_approved',
    jsonb_build_object('approved_by', p_approved_by_name, 'approved_at', timezone('utc', now()))
  );

  RETURN v_io_id;
END;
$$;

-- Client token approve also stamps approved revision for audit.
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
    approved_revision_number = revision_number,
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

GRANT EXECUTE ON FUNCTION public.approve_client_io_by_token(text, text, inet) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_vendor_io_by_token(text, text, inet) TO anon, authenticated;
