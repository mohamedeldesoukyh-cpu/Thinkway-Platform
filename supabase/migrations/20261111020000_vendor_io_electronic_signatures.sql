CREATE TABLE public.vendor_io_signatures (
  vendor_io_id uuid PRIMARY KEY REFERENCES public.vendor_ios(id),
  revision_number integer NOT NULL,
  signer_name text NOT NULL CHECK(length(signer_name) BETWEEN 2 AND 160),
  signer_email text,
  signed_at timestamptz NOT NULL,
  signature_strokes jsonb NOT NULL CHECK(jsonb_typeof(signature_strokes)='array' AND jsonb_array_length(signature_strokes) BETWEEN 1 AND 30),
  consent_text text NOT NULL,
  document_hash text NOT NULL CHECK(document_hash ~ '^[a-f0-9]{64}$'),
  source_html text NOT NULL,
  signed_html text NOT NULL,
  signed_pdf_path text NOT NULL,
  ip_address inet,
  user_agent text,
  actor_id uuid REFERENCES auth.users(id)
);
ALTER TABLE public.vendor_io_signatures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_io_signatures FROM anon, authenticated, service_role;
GRANT SELECT ON public.vendor_io_signatures TO authenticated, service_role;
CREATE POLICY vendor_io_signatures_read ON public.vendor_io_signatures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.vendor_ios v WHERE v.id=vendor_io_id));

-- Legacy approval endpoints cannot bypass signature capture, including old open tabs.
CREATE OR REPLACE FUNCTION public.approve_vendor_io_by_token(p_token text,p_approved_by_name text,p_approval_ip inet DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'SIGNATURE_REQUIRED: Please review, sign and approve this IO.'; END $$;
CREATE OR REPLACE FUNCTION public.approve_vendor_io_portal(p_vendor_io_id uuid,p_approved_by_name text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'SIGNATURE_REQUIRED: Please review, sign and approve this IO.'; END $$;

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
  IF length(btrim(p_name)) NOT BETWEEN 2 AND 160 OR jsonb_typeof(p_strokes)<>'array' OR jsonb_array_length(p_strokes) NOT BETWEEN 1 AND 30
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

CREATE FUNCTION public.guard_signed_vendor_io_terms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT FROM public.vendor_io_signatures WHERE vendor_io_id=OLD.id) AND
    ROW(NEW.terms_text,NEW.usage_rights,NEW.exclusivity,NEW.special_payment_terms,NEW.compliance_country_code,NEW.amount,NEW.currency_code,NEW.revision_number,NEW.influencer_id,NEW.campaign_header_id)
    IS DISTINCT FROM ROW(OLD.terms_text,OLD.usage_rights,OLD.exclusivity,OLD.special_payment_terms,OLD.compliance_country_code,OLD.amount,OLD.currency_code,OLD.revision_number,OLD.influencer_id,OLD.campaign_header_id) THEN
    RAISE EXCEPTION 'This IO is signed. Create a revision to change its agreed terms.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_signed_vendor_io_terms BEFORE UPDATE ON public.vendor_ios FOR EACH ROW EXECUTE FUNCTION public.guard_signed_vendor_io_terms();
NOTIFY pgrst,'reload schema';
CREATE OR REPLACE FUNCTION public.get_vendor_io_signing_session(p_token text DEFAULT NULL,p_io_id uuid DEFAULT NULL,p_actor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.vendor_ios%ROWTYPE; h text; result jsonb;
BEGIN
 IF nullif(p_token,'') IS NOT NULL THEN
  IF length(p_token) NOT BETWEEN 16 AND 256 THEN RAISE EXCEPTION 'APPROVAL_INVALID'; END IF;
  h:=public.hash_io_approval_token(p_token);
  SELECT * INTO v FROM public.vendor_ios WHERE approval_token_hash=h OR approval_token_consumed_hash=h;
 ELSE
  SELECT * INTO v FROM public.vendor_ios WHERE id=p_io_id AND EXISTS(SELECT FROM public.influencers i WHERE i.id=influencer_id AND i.profile_id=p_actor_id);
 END IF;
 IF v.id IS NULL THEN RAISE EXCEPTION 'APPROVAL_INVALID'; END IF;
 IF v.is_superseded THEN RAISE EXCEPTION 'APPROVAL_SUPERSEDED'; END IF;
 IF v.status<>'approved' THEN
  IF h IS NOT NULL AND (v.approval_token_hash IS DISTINCT FROM h OR v.approval_token_expires_at<=now()) THEN RAISE EXCEPTION 'APPROVAL_EXPIRED'; END IF;
  IF v.status NOT IN ('generated','sent') THEN RAISE EXCEPTION 'APPROVAL_INVALID'; END IF;
 END IF;
 SELECT jsonb_build_object('id',v.id,'document_number',v.document_number,'campaign_header_id',v.campaign_header_id,
  'status',v.status,'terms_html',v.terms_html,'delivery_recipient',v.delivery_recipient,
  'influencers',(SELECT jsonb_build_object('display_name',i.display_name,'email',i.email) FROM public.influencers i WHERE i.id=v.influencer_id),
  'campaign',(SELECT jsonb_build_object('name',c.name) FROM public.campaign_headers c WHERE c.id=v.campaign_header_id)) INTO result;
 RETURN jsonb_build_object('io',result,'signature',(SELECT jsonb_build_object('signed_html',s.signed_html,'signed_pdf_path',s.signed_pdf_path,'signer_name',s.signer_name,'signed_at',s.signed_at) FROM public.vendor_io_signatures s WHERE s.vendor_io_id=v.id));
END $$;
REVOKE ALL ON FUNCTION public.get_vendor_io_signing_session(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_io_signing_session(text,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
-- Server-side delivery records for signed IO confirmations.
GRANT INSERT ON public.io_notifications TO service_role;
