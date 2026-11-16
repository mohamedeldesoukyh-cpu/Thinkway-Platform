BEGIN;

-- Preserve drawn arrays; typed evidence records the exact adopted name.
CREATE OR REPLACE FUNCTION public.valid_vendor_signature_evidence(evidence jsonb, signer text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT coalesce(CASE jsonb_typeof(evidence)
    WHEN 'array' THEN jsonb_array_length(evidence) BETWEEN 1 AND 30
    WHEN 'object' THEN evidence->>'method'='type' AND evidence->>'text'=signer
      AND length(btrim(signer)) BETWEEN 2 AND 160
    ELSE false END,false);
$$;
ALTER TABLE public.vendor_io_signatures DROP CONSTRAINT vendor_io_signatures_signature_strokes_check;
ALTER TABLE public.vendor_io_signatures ADD CONSTRAINT vendor_io_signatures_signature_strokes_check
  CHECK(public.valid_vendor_signature_evidence(signature_strokes,signer_name));

CREATE OR REPLACE FUNCTION public.sign_vendor_io(
  p_io_id uuid,p_token text,p_actor_id uuid,p_name text,p_strokes jsonb,
  p_document_hash text,p_signed_html text,p_pdf_path text,p_signed_at timestamptz,
  p_ip inet DEFAULT NULL,p_user_agent text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.vendor_ios%ROWTYPE; recipient text; token_hash text;
BEGIN
  SELECT * INTO v FROM public.vendor_ios WHERE id=p_io_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_INVALID'; END IF;
  token_hash:=CASE WHEN nullif(p_token,'') IS NOT NULL THEN public.hash_io_approval_token(p_token) ELSE NULL END;
  IF token_hash IS NOT NULL THEN
    IF token_hash IS DISTINCT FROM v.approval_token_hash AND token_hash IS DISTINCT FROM v.approval_token_consumed_hash THEN
      RAISE EXCEPTION 'APPROVAL_INVALID'; END IF;
  ELSIF p_actor_id IS NULL OR NOT EXISTS(SELECT FROM public.influencers i WHERE i.id=v.influencer_id AND i.profile_id=p_actor_id) THEN
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;
  IF v.is_superseded THEN RAISE EXCEPTION 'APPROVAL_SUPERSEDED'; END IF;
  IF v.status='approved' AND EXISTS(SELECT FROM public.vendor_io_signatures WHERE vendor_io_id=v.id) THEN
    RETURN jsonb_build_object('io_id',v.id,'already_approved',true); END IF;
  IF token_hash IS NOT NULL AND (v.approval_token_hash IS DISTINCT FROM token_hash OR
    (v.approval_token_expires_at IS NOT NULL AND v.approval_token_expires_at<=now())) THEN RAISE EXCEPTION 'APPROVAL_EXPIRED'; END IF;
  IF v.status NOT IN ('generated','sent') THEN RAISE EXCEPTION 'APPROVAL_INVALID'; END IF;
  IF v.terms_html IS NULL OR encode(sha256(convert_to(v.terms_html,'UTF8')),'hex') IS DISTINCT FROM p_document_hash THEN
    RAISE EXCEPTION 'DOCUMENT_CHANGED: The IO changed. Reload and review it before signing.'; END IF;
  IF length(btrim(p_name)) NOT BETWEEN 2 AND 160 OR NOT public.valid_vendor_signature_evidence(p_strokes,btrim(p_name))
    OR length(p_signed_html)<length(v.terms_html) OR p_signed_html NOT LIKE '%data-io-signature="signed"%'
    OR p_pdf_path NOT LIKE v.id::text||'/signed/%.pdf' OR abs(extract(epoch FROM now()-p_signed_at))>300 THEN
    RAISE EXCEPTION 'SIGNATURE_REQUIRED'; END IF;
  SELECT COALESCE(NULLIF(v.delivery_recipient,'Manual'),i.email) INTO recipient FROM public.influencers i WHERE i.id=v.influencer_id;
  INSERT INTO public.vendor_io_signatures VALUES(v.id,v.revision_number,btrim(p_name),recipient,p_signed_at,p_strokes,
    'By signing, I agree to this IO and its terms.',p_document_hash,v.terms_html,p_signed_html,p_pdf_path,p_ip,left(p_user_agent,1000),p_actor_id);
  UPDATE public.vendor_ios SET status='approved',approved_at=p_signed_at,approved_by_name=btrim(p_name),approved_by_email=recipient,
    approved_revision_number=revision_number,approval_ip=p_ip,approval_accessed_at=now(),
    approval_token_consumed_hash=COALESCE(token_hash,approval_token_hash),approval_token_hash=NULL,approval_token_expires_at=NULL,
    generated_pdf_url=p_pdf_path,rejection_reason=NULL,updated_at=now() WHERE id=v.id;
  INSERT INTO public.io_notifications(io_type,io_id,event_type,payload)
    VALUES('vendor',v.id,'vendor_io_approved',jsonb_build_object('signed',true,'signer_name',btrim(p_name),'signed_at',p_signed_at,'document_hash',p_document_hash,'revision',v.revision_number));
  RETURN jsonb_build_object('io_id',v.id,'already_approved',false);
END $$;
REVOKE ALL ON FUNCTION public.sign_vendor_io(uuid,text,uuid,text,jsonb,text,text,text,timestamptz,inet,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sign_vendor_io(uuid,text,uuid,text,jsonb,text,text,text,timestamptz,inet,text) TO service_role;


NOTIFY pgrst, 'reload schema';
COMMIT;
