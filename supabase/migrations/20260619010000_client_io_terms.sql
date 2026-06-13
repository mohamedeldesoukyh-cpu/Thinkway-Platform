-- Client-level fixed IO terms + seed CIO terms from client default on create

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_io_terms_text text;

COMMENT ON COLUMN public.clients.client_io_terms_text IS
  'JSON array [{title, body}, ...] — default Section 8 terms for all Client IOs on this legal entity';

CREATE OR REPLACE FUNCTION public.ensure_client_io_for_campaign(
  p_campaign_header_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_client_id uuid;
  v_client_terms text;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.client_ios
  WHERE campaign_header_id = p_campaign_header_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT ch.client_id, c.client_io_terms_text
  INTO v_client_id, v_client_terms
  FROM public.campaign_headers ch
  JOIN public.clients c ON c.id = ch.client_id
  WHERE ch.id = p_campaign_header_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Campaign header not found for IO creation.';
  END IF;

  INSERT INTO public.client_ios (
    campaign_header_id,
    client_id,
    status,
    terms_text,
    created_by,
    updated_by
  )
  VALUES (
    p_campaign_header_id,
    v_client_id,
    'draft',
    NULLIF(trim(v_client_terms), ''),
    p_actor_id,
    p_actor_id
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;
