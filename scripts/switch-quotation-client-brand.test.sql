\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  actor uuid;
  quote public.quotations%ROWTYPE;
  target public.brands%ROWTYPE;
  review_id uuid;
  journey_id uuid;
  item_count integer;
  old_token text := 'client-switch-test-token';
BEGIN
  SELECT id INTO actor FROM public.profiles WHERE role = 'admin' LIMIT 1;
  SELECT q.* INTO quote FROM public.quotations q WHERE q.status = 'draft' AND NOT q.is_archived
    AND q.campaign_header_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.campaign_headers WHERE quotation_id = q.id OR accepted_quotation_id = q.id)
    AND NOT EXISTS (SELECT 1 FROM public.campaign_lines WHERE source_quotation_id = q.id)
    AND NOT EXISTS (SELECT 1 FROM public.quotations WHERE parent_quotation_id = q.id)
    LIMIT 1;
  SELECT * INTO target FROM public.brands WHERE client_id IS NOT NULL AND client_id IS DISTINCT FROM quote.client_id LIMIT 1;
  IF actor IS NULL OR quote.id IS NULL OR target.id IS NULL THEN RAISE EXCEPTION 'Missing test prerequisites'; END IF;
  SELECT count(*) INTO item_count FROM public.quotation_items WHERE quotation_id = quote.id;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.switch_quotation_client_brand(quote.id, target.client_id, target.id);
    RAISE EXCEPTION 'Expected permission rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'You do not have permission%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  BEGIN
    PERFORM public.switch_quotation_client_brand(quote.id, quote.client_id, target.id);
    RAISE EXCEPTION 'Expected mismatched brand rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Select a brand belonging%' THEN RAISE; END IF;
  END;
  INSERT INTO public.campaign_client_journeys(token_hash, share_token, quotation_id)
    VALUES (old_token, old_token, quote.id) RETURNING id INTO journey_id;
  INSERT INTO public.campaign_client_reviews(review_number, token_hash, share_token, created_by, source, quotation_id, journey_id)
    VALUES (999999, old_token || '-review', old_token, actor, 'quotation', quote.id, journey_id) RETURNING id INTO review_id;
  PERFORM public.switch_quotation_client_brand(quote.id, target.client_id, target.id);
  IF NOT EXISTS (SELECT 1 FROM public.quotations WHERE id = quote.id AND client_id = target.client_id AND brand_id = target.id
    AND shortlist_id IS NULL AND NOT client_visible AND status = 'draft') THEN RAISE EXCEPTION 'Identity update failed'; END IF;
  IF (SELECT count(*) FROM public.quotation_items WHERE quotation_id = quote.id) <> item_count THEN RAISE EXCEPTION 'Items changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaign_client_reviews WHERE id = review_id AND quotation_id IS NULL AND status = 'revoked' AND share_token IS NULL) THEN RAISE EXCEPTION 'Old review remains active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaign_client_journeys WHERE id = journey_id AND quotation_id IS NULL AND token_hash <> old_token AND share_token IS NULL) THEN RAISE EXCEPTION 'Old journey remains active'; END IF;
  UPDATE public.quotations SET status = 'approved' WHERE id = quote.id;
  BEGIN
    PERFORM public.switch_quotation_client_brand(quote.id, target.client_id, target.id);
    RAISE EXCEPTION 'Expected approved quotation rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Create a new draft%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: permissions, brand ownership, atomic switch, line preservation, link invalidation, approved lock';
END;
$$;
ROLLBACK;
