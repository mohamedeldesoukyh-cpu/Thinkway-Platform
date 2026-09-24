BEGIN;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.revise_collection_payment(p_id uuid,p_revision integer,p_amount numeric,p_date date,p_method text,p_reference text,p_notes text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; inv invoices%ROWTYPE; invoice_key uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.has_permission('collections.write')) THEN RAISE EXCEPTION 'Collections write access required'; END IF;
 SELECT invoice_id INTO invoice_key FROM payments WHERE id=p_id;
 SELECT * INTO inv FROM invoices WHERE id=invoice_key FOR UPDATE;
 SELECT * INTO p FROM payments WHERE id=p_id FOR UPDATE;
 IF p.id IS NULL OR inv.id IS NULL OR p.status<>'completed' OR p.revision<>p_revision THEN RAISE EXCEPTION 'Payment changed or unavailable. Reload before editing'; END IF;
 IF inv.status='void' OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>inv.total-inv.amount_paid+p.amount THEN RAISE EXCEPTION 'Amount exceeds invoice balance or is invalid'; END IF;
 IF p_date IS NULL OR p_date>CURRENT_DATE OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500 OR length(coalesce(p_notes,''))>2000 OR length(coalesce(p_reference,''))>120 THEN RAISE EXCEPTION 'Enter a valid payment date and correction reason'; END IF;
 IF EXISTS(SELECT 1 FROM payment_allocations WHERE payment_id=p_id AND invoice_id<>inv.id) THEN RAISE EXCEPTION 'Multi-invoice allocation requires reconciliation before editing'; END IF;
 UPDATE payments SET amount=p_amount,paid_at=p_date::timestamp AT TIME ZONE 'UTC',payment_method=p_method::public.payment_method,reference_number=nullif(trim(p_reference),''),notes=nullif(trim(p_notes),''),revision=revision+1 WHERE id=p_id;
 UPDATE payment_allocations SET allocated_amount=p_amount WHERE payment_id=p_id AND invoice_id=inv.id;
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('payment',p_id,'payment_revised',auth.uid(),jsonb_build_object('before',to_jsonb(p),'after',jsonb_build_object('amount',p_amount,'paid_at',p_date,'payment_method',p_method,'reference_number',p_reference,'notes',p_notes),'reason',p_reason));
 -- Payment triggers recompute invoice totals; mirror the final ratio into deliverables atomically.
 UPDATE assignment_deliverables d SET collected_amount=round(coalesce(i.revenue_before_vat,i.unit_price)*least(1,(SELECT amount_paid/nullif(total,0) FROM invoices WHERE id=inv.id)),2),billing_status=CASE WHEN (SELECT amount_paid>=total FROM invoices WHERE id=inv.id) THEN 'collected' WHEN (SELECT amount_paid>0 FROM invoices WHERE id=inv.id) THEN 'partially_collected' ELSE 'invoiced' END::public.assignment_deliverable_billing_status
 FROM invoice_line_items_operational i WHERE i.invoice_id=inv.id AND d.id=i.assignment_deliverable_id;
 UPDATE campaign_lines SET billing_status=(CASE WHEN (SELECT amount_paid>=total FROM invoices WHERE id=inv.id) THEN 'paid' WHEN (SELECT amount_paid>0 FROM invoices WHERE id=inv.id) THEN 'partially_paid' ELSE 'invoiced' END)::public.campaign_line_billing_status WHERE invoice_id=inv.id AND billing_status IN ('invoiced','partially_paid','paid');
END $$;
REVOKE ALL ON FUNCTION public.revise_collection_payment(uuid,integer,numeric,date,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_collection_payment(uuid,integer,numeric,date,text,text,text,text) TO authenticated;
COMMIT;
