-- Serialize long-running conversions across workers without holding a transaction open.
CREATE OR REPLACE FUNCTION public.acquire_quotation_conversion(p_quotation_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_metadata jsonb;
BEGIN
  SELECT metadata INTO v_metadata FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (v_metadata #>> '{assignment_conversion_lease,expires_at}')::timestamptz > clock_timestamp() THEN
    RETURN false;
  END IF;
  UPDATE public.quotations SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb),
    '{assignment_conversion_lease}', jsonb_build_object('token', p_token,
    'expires_at', clock_timestamp() + interval '15 minutes')) WHERE id = p_quotation_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.release_quotation_conversion(p_quotation_id uuid, p_token uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.quotations SET metadata = metadata - 'assignment_conversion_lease'
  WHERE id = p_quotation_id AND metadata #>> '{assignment_conversion_lease,token}' = p_token::text;
$$;

REVOKE ALL ON FUNCTION public.acquire_quotation_conversion(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_quotation_conversion(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_quotation_conversion(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_quotation_conversion(uuid, uuid) TO authenticated, service_role;
