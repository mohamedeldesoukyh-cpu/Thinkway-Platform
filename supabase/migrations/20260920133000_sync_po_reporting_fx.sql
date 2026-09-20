BEGIN;
-- A small foreign PO against a large campaign can exceed the old four-digit
-- percentage range; report the true percentage rather than aborting FX saves.
ALTER TABLE public.campaign_headers ALTER COLUMN po_remaining_percent TYPE numeric;
-- Billing checks use persisted header totals. Keep those in the same currency
-- and at the same effective rate as the live PO projection.
CREATE OR REPLACE FUNCTION public.sync_campaign_header_po_consumption(p_header_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v record; v_remaining numeric; v_pct numeric;
BEGIN
  SELECT p.*,h.po_expiry_date,h.po_status,h.po_amount_original INTO v FROM public.campaign_fx_po_totals p
    JOIN public.campaign_headers h ON h.id=p.campaign_header_id WHERE h.id=p_header_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_remaining := round(v.po_amount-v.po_consumed,2);
  v_pct := CASE WHEN v.po_amount>0 THEN round(v_remaining/v.po_amount*100,4) END;
  UPDATE public.campaign_headers SET po_consumed_amount=v.po_consumed,
    po_remaining_amount=v_remaining,po_remaining_percent=v_pct,
    po_amount_campaign_currency=CASE WHEN v.po_amount_original>0 THEN v.po_amount ELSE po_amount_campaign_currency END,
    po_exchange_rate=CASE WHEN v.po_amount_original>0 THEN v.po_rate ELSE po_exchange_rate END,
    fx_snapshot_at=CASE WHEN v.po_amount_original>0 AND po_exchange_rate IS DISTINCT FROM v.po_rate THEN now() ELSE fx_snapshot_at END,
    po_status=public.compute_po_status(v.po_amount,v.po_consumed,v_pct,v.po_expiry_date,v.po_status)
    WHERE id=p_header_id AND (
      (po_consumed_amount,po_remaining_amount,po_remaining_percent,po_status)
        IS DISTINCT FROM (v.po_consumed,v_remaining,v_pct,
          public.compute_po_status(v.po_amount,v.po_consumed,v_pct,v.po_expiry_date,v.po_status))
      OR (v.po_amount_original>0 AND (po_amount_campaign_currency,po_exchange_rate) IS DISTINCT FROM (v.po_amount,v.po_rate))
    );
END;
$$;
DO $$ DECLARE v_id uuid; BEGIN
  FOR v_id IN SELECT id FROM public.campaign_headers LOOP
    PERFORM public.sync_campaign_header_po_consumption(v_id);
  END LOOP;
END; $$;
COMMIT;
