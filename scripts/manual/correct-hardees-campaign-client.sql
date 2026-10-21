-- User-requested correction: campaign uses duplicate BRD-10 instead of BRD-19.
-- Scoped to this campaign; does not merge brands or change financial amounts.
BEGIN;
DO $$
DECLARE campaign uuid := '3bbf65cf-4a83-42cf-be8d-85f7f7f17628';
 old_client uuid := 'a961219f-9167-499a-b59d-a71a8a2ca268';
 new_client uuid := 'fe2db5ac-868b-4bf8-a285-d7eca6163a0e';
 new_brand uuid := '8c15ef6f-13a0-4144-8aea-3040b1288ba8';
 new_row public.clients%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.campaign_headers WHERE id=campaign
 AND client_id=old_client AND brand_id='e78ce4c8-33fc-479f-ad72-1e875042cb7d' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign scope changed; review before correcting.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.brands WHERE id=new_brand AND client_id=new_client) THEN
 RAISE EXCEPTION 'Destination brand/client does not match.'; END IF;
 IF EXISTS(SELECT 1 FROM public.invoices WHERE campaign_header_id=campaign)
 OR EXISTS(SELECT 1 FROM public.invoice_line_items WHERE campaign_header_id=campaign)
 OR EXISTS(SELECT 1 FROM public.invoice_line_items_operational WHERE campaign_header_id=campaign)
 OR EXISTS(SELECT 1 FROM public.invoice_lines WHERE campaign_header_id=campaign) THEN
 RAISE EXCEPTION 'Invoices now exist; review before changing the client.'; END IF;
 SELECT * INTO STRICT new_row FROM public.clients WHERE id=new_client;
 UPDATE public.campaign_headers SET client_id=new_client,brand_id=new_brand,group_id=new_row.group_id,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('client_correction',jsonb_build_object(
 'previous_client_id',old_client,'previous_brand_id',brand_id,'reason','User requested Mind Share Egypt LTD / BRD-19; duplicate Hardees brand was selected','corrected_at',now()))
 WHERE id=campaign;
END $$;
COMMIT;
SELECT h.name,b.document_number brand_number,c.name client FROM public.campaign_headers h
JOIN public.brands b ON b.id=h.brand_id JOIN public.clients c ON c.id=h.client_id
WHERE h.id='3bbf65cf-4a83-42cf-be8d-85f7f7f17628';
