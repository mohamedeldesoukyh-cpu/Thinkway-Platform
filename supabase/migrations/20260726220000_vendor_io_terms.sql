-- Vendor-level default Vendor IO terms (mirrors clients.client_io_terms_text).
-- NULL = use platform defaults from Thinkway_IO_Global.html / VENDOR_IO_DEFAULT_TERMS.
-- Existing vendor_ios.terms_text rows are left unchanged (legacy freeform or structured).

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS vendor_io_terms_text text;

COMMENT ON COLUMN public.influencers.vendor_io_terms_text IS
  'JSON array [{title, body}, ...] — default Section 8 terms for Vendor IOs on this influencer. NULL = platform default.';

-- Seed new Vendor IOs from influencer defaults instead of freeform prose.
CREATE OR REPLACE FUNCTION public.upsert_vendor_io_from_assignment(
  p_assignment_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row record;
  v_vendor_terms text;
BEGIN
  SELECT
    ci.id,
    ci.campaign_header_id,
    ci.influencer_id,
    ci.agreed_fee,
    ci.currency,
    ci.deliverable_count,
    ci.status AS assignment_status
  INTO v_row
  FROM public.campaign_influencers ci
  WHERE ci.id = p_assignment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found.';
  END IF;

  SELECT NULLIF(trim(i.vendor_io_terms_text), '')
  INTO v_vendor_terms
  FROM public.influencers i
  WHERE i.id = v_row.influencer_id;

  INSERT INTO public.vendor_ios (
    assignment_id,
    campaign_header_id,
    influencer_id,
    amount,
    currency_code,
    status,
    terms_text,
    created_by,
    updated_by
  )
  VALUES (
    v_row.id,
    v_row.campaign_header_id,
    v_row.influencer_id,
    COALESCE(v_row.agreed_fee, 0),
    COALESCE(v_row.currency, 'USD'),
    'draft'::public.vendor_io_status,
    v_vendor_terms,
    p_actor_id,
    p_actor_id
  )
  ON CONFLICT (assignment_id) DO UPDATE
    SET
      campaign_header_id = EXCLUDED.campaign_header_id,
      influencer_id = EXCLUDED.influencer_id,
      amount = EXCLUDED.amount,
      currency_code = EXCLUDED.currency_code,
      updated_by = COALESCE(p_actor_id, public.vendor_ios.updated_by),
      updated_at = timezone('utc', now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
