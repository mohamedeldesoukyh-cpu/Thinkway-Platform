\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE io_before AS SELECT id,to_jsonb(v) AS data FROM public.vendor_ios v;
CREATE TEMP TABLE creator_before AS
  SELECT id, payment_terms, country_code, vendor_io_terms_text FROM public.influencers;
DO $$
DECLARE v_id uuid; v_campaign uuid; v_status text; v_attachment text; v_sent timestamptz; v_country text;
BEGIN
  SELECT id,campaign_header_id,status::text,attachment_url,sent_at
  INTO v_id,v_campaign,v_status,v_attachment,v_sent
  FROM public.vendor_ios WHERE NOT is_superseded LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Test needs a Development IO'; END IF;
  UPDATE public.vendor_ios SET terms_html='cached html', generated_pdf_url='fixture.pdf',
    generated_html_url='fixture.html',document_generated_at=now() WHERE id=v_id;
  UPDATE public.vendor_ios SET usage_rights='30 days from first publication',
    special_payment_terms='50% advance, 50% on completion', compliance_country_code='AE'
  WHERE id=v_id AND campaign_header_id=v_campaign AND NOT is_superseded;
  IF NOT EXISTS(SELECT 1 FROM public.vendor_ios WHERE id=v_id AND usage_rights='30 days from first publication'
      AND special_payment_terms='50% advance, 50% on completion' AND compliance_country_code='AE'
      AND status::text=v_status AND attachment_url IS NOT DISTINCT FROM v_attachment
      AND sent_at IS NOT DISTINCT FROM v_sent
      AND terms_html IS NULL AND generated_pdf_url IS NULL AND generated_html_url IS NULL AND document_generated_at IS NULL) THEN
    RAISE EXCEPTION 'Term edit failed, stale document retained, or workflow/signed attachment changed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.vendor_ios v JOIN io_before b USING(id) WHERE v.id<>v_id AND to_jsonb(v)<>b.data) THEN
    RAISE EXCEPTION 'Another IO changed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.influencers i JOIN creator_before b USING(id)
    WHERE ROW(i.payment_terms,i.country_code,i.vendor_io_terms_text) IS DISTINCT FROM ROW(b.payment_terms,b.country_code,b.vendor_io_terms_text)) THEN
    RAISE EXCEPTION 'CRM defaults changed';
  END IF;
  UPDATE public.vendor_ios SET compliance_country_code='EG' WHERE id=v_id AND campaign_header_id=gen_random_uuid();
  SELECT compliance_country_code INTO v_country FROM public.vendor_ios WHERE id=v_id;
  IF v_country <> 'AE' THEN RAISE EXCEPTION 'Campaign scope was not enforced'; END IF;
  BEGIN
    UPDATE public.vendor_ios SET compliance_country_code='US' WHERE id=v_id;
    RAISE EXCEPTION 'Unsupported country accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.vendor_ios SET usage_rights=NULL,special_payment_terms=NULL,compliance_country_code=NULL WHERE id=v_id;
  IF EXISTS(SELECT 1 FROM public.vendor_ios WHERE id=v_id AND (usage_rights IS NOT NULL OR special_payment_terms IS NOT NULL OR compliance_country_code IS NOT NULL)) THEN
    RAISE EXCEPTION 'Reset to inherited values failed';
  END IF;
END;
$$;
ROLLBACK;
\echo 'PASS: campaign scope, CRM isolation, document invalidation, workflow preservation and resets'
