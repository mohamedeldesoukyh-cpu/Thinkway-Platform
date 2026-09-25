BEGIN;
CREATE OR REPLACE FUNCTION public.restore_collection_payment(p_id uuid,p_revision integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; inv invoices%ROWTYPE; invoice_key uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.has_permission('collections.write')) THEN RAISE EXCEPTION 'Collections write access required'; END IF;
 SELECT invoice_id INTO invoice_key FROM payments WHERE id=p_id;
 SELECT * INTO inv FROM invoices WHERE id=invoice_key FOR UPDATE;
 SELECT * INTO p FROM payments WHERE id=p_id FOR UPDATE;
 IF p.id IS NULL OR inv.id IS NULL OR p.status<>'cancelled' OR p_revision IS NULL OR p.revision<>p_revision THEN RAISE EXCEPTION 'Payment changed or unavailable. Reload before editing'; END IF;
 IF inv.status='void' OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter a restoration reason for an active invoice'; END IF;
 IF NOT EXISTS(SELECT 1 FROM collection_audit_logs WHERE entity_type='payment' AND entity_id=p_id AND action='payment_deleted') THEN RAISE EXCEPTION 'Only receipts deleted from Collections can be restored'; END IF;
 IF p.amount>inv.total-inv.amount_paid THEN RAISE EXCEPTION 'Restoring this payment would overpay the invoice'; END IF;
 IF EXISTS(SELECT 1 FROM payment_allocations WHERE payment_id=p_id) THEN RAISE EXCEPTION 'Payment allocation requires reconciliation before restoring'; END IF;
 UPDATE payments SET status='completed',revision=revision+1 WHERE id=p_id;
 INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(p_id,inv.id,p.amount,p.currency);
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('payment',p_id,'payment_restored',auth.uid(),jsonb_build_object('before',to_jsonb(p),'after',jsonb_build_object('status','completed'),'reason',p_reason));
 -- Payment triggers recompute invoice totals; mirror the final ratio into deliverables atomically.
 UPDATE assignment_deliverables d SET collected_amount=round(coalesce(i.revenue_before_vat,i.unit_price)*least(1,(SELECT amount_paid/nullif(total,0) FROM invoices WHERE id=inv.id)),2),billing_status=CASE WHEN (SELECT amount_paid>=total FROM invoices WHERE id=inv.id) THEN 'collected' WHEN (SELECT amount_paid>0 FROM invoices WHERE id=inv.id) THEN 'partially_collected' ELSE 'invoiced' END::public.assignment_deliverable_billing_status
 FROM invoice_line_items_operational i WHERE i.invoice_id=inv.id AND d.id=i.assignment_deliverable_id;
 UPDATE campaign_lines SET billing_status=(CASE WHEN (SELECT amount_paid>=total FROM invoices WHERE id=inv.id) THEN 'paid' WHEN (SELECT amount_paid>0 FROM invoices WHERE id=inv.id) THEN 'partially_paid' ELSE 'invoiced' END)::public.campaign_line_billing_status WHERE invoice_id=inv.id AND billing_status IN ('invoiced','partially_paid','paid');
END $$;
REVOKE ALL ON FUNCTION public.restore_collection_payment(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_collection_payment(uuid,integer,text) TO authenticated;
COMMIT;
