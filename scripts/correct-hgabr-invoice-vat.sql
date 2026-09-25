BEGIN;
DO $$
DECLARE s public.creator_supplier_invoices; a public.campaign_influencers;
BEGIN
 SELECT si.* INTO STRICT s FROM creator_supplier_invoices si JOIN campaign_influencers ci ON ci.id=si.assignment_id JOIN influencers i ON i.id=ci.influencer_id JOIN campaign_headers h ON h.id=ci.campaign_header_id
 WHERE lower(i.display_name)='hgabr' AND si.invoice_number='207' AND h.document_number='TW-2026-0004' FOR UPDATE OF si;
 SELECT * INTO a FROM campaign_influencers WHERE id=s.assignment_id;
 IF s.vat_amount=16800 AND s.from_payment_register THEN RETURN; END IF;
 IF s.vat_amount<>0 OR s.subtotal<>120000 OR s.currency<>'EGP' OR a.cost_vat_amount<>16800 OR a.cost_vat_percent<>14 OR s.status<>'received' OR NOT s.confirmed THEN RAISE EXCEPTION 'Hgabr invoice changed: manual review required'; END IF;
 IF (SELECT count(*) FROM creator_supplier_invoices WHERE assignment_id=a.id)<>1 THEN RAISE EXCEPTION 'Multiple invoices require review'; END IF;
 UPDATE creator_supplier_invoices SET vat_amount=16800,from_payment_register=true,revision=revision+1 WHERE id=s.id;
 INSERT INTO finance_override_logs(entity_type,entity_id,override_type,reason,granted_until,metadata)
 VALUES('creator_supplier_invoice',s.id,'creator_invoice_vat_correction','User-authorized correction: invoice 207 must reflect the existing 14% assignment VAT; original invoice and payment records retained.',clock_timestamp(),jsonb_build_object('assignment_id',a.id,'old_vat_amount',0,'new_vat_amount',16800,'performed_by','deployment maintenance','authorization','User requested correction after reviewing Hgabr VAT mismatch'));
END $$;
COMMIT;
