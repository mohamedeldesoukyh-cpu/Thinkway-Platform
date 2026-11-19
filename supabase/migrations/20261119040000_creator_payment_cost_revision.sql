BEGIN;

-- A revision hold is not an unpaid bank transfer. Keep every original payment
-- field and audit snapshot; only its inclusion in the payable balance changes.
ALTER TABLE public.creator_payment_entries DROP CONSTRAINT creator_payment_entries_status_check;
ALTER TABLE public.creator_payment_entries ADD CONSTRAINT creator_payment_entries_status_check
 CHECK (status IN ('exported','paid','failed','revision_pending'));

CREATE TABLE public.creator_payment_cost_holds (
 assignment_id uuid PRIMARY KEY REFERENCES public.campaign_influencers(id),
 campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE public.creator_payment_cost_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_hold_read ON public.creator_payment_cost_holds FOR SELECT TO authenticated
 USING (public.can_manage_creator_payments(campaign_id,false));
GRANT SELECT ON public.creator_payment_cost_holds TO authenticated;

CREATE FUNCTION public.guard_creator_payment_cost_hold() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM id FROM campaign_influencers WHERE id=NEW.assignment_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM creator_payment_cost_holds WHERE assignment_id=NEW.assignment_id) THEN
   RAISE EXCEPTION 'Payments are pending cost revision. Remove pending before recording, editing or exporting payments.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_creator_payment_cost_hold BEFORE INSERT OR UPDATE ON public.creator_payment_entries
 FOR EACH ROW EXECUTE FUNCTION public.guard_creator_payment_cost_hold();

-- Restoring the exact original amounts requires the original cost currency.
CREATE FUNCTION public.guard_pending_cost_currency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.currency IS DISTINCT FROM OLD.currency AND EXISTS(
   SELECT 1 FROM creator_payment_cost_holds WHERE assignment_id=OLD.id
 ) THEN RAISE EXCEPTION 'Keep the original cost currency while payments are pending revision.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_pending_cost_currency BEFORE UPDATE OF currency ON public.campaign_influencers
 FOR EACH ROW EXECUTE FUNCTION public.guard_pending_cost_currency();

CREATE FUNCTION public.set_creator_payment_cost_pending(p_assignments uuid[],p_pending boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a campaign_influencers%ROWTYPE; e creator_payment_entries%ROWTYPE; paid numeric; total numeric; last_paid timestamptz;
BEGIN
 IF auth.uid() IS NULL OR p_pending IS NULL OR coalesce(cardinality(p_assignments),0) NOT BETWEEN 1 AND 200 THEN
   RAISE EXCEPTION 'Select 1–200 creator lines.';
 END IF;
 IF (SELECT count(*) FROM campaign_influencers WHERE id=ANY(p_assignments))<>(SELECT count(DISTINCT x) FROM unnest(p_assignments) x) THEN
   RAISE EXCEPTION 'Creator line unavailable. Refresh payments.';
 END IF;
 -- Same lock order as cost corrections: parent line, then creator assignment.
 PERFORM id FROM campaign_lines WHERE id IN(SELECT campaign_line_id FROM campaign_influencers WHERE id=ANY(p_assignments)) ORDER BY id FOR UPDATE;
 FOR a IN SELECT * FROM campaign_influencers WHERE id=ANY(p_assignments) ORDER BY id FOR UPDATE LOOP
   IF NOT can_manage_creator_payments(a.campaign_header_id,true) OR NOT can_access_campaign_header(a.campaign_header_id) THEN
     RAISE EXCEPTION 'Finance access required';
   END IF;
   IF EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND status='exported' AND cleared_at IS NULL) THEN
     RAISE EXCEPTION 'Confirm outstanding bank export results before changing payment revision state.';
   END IF;
   IF p_pending THEN
     IF EXISTS(SELECT 1 FROM creator_payment_cost_holds WHERE assignment_id=a.id) THEN CONTINUE; END IF;
     IF NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND status='paid' AND cleared_at IS NULL AND original_amount>0) THEN
       RAISE EXCEPTION 'Only creator lines with recorded payments can be marked pending revision.';
     END IF;
   ELSE
     IF NOT EXISTS(SELECT 1 FROM creator_payment_cost_holds WHERE assignment_id=a.id) THEN CONTINUE; END IF;
     IF EXISTS(SELECT 1 FROM campaign_lines WHERE id=a.campaign_line_id AND metadata->>'pending_vendor_io_id' IS NOT NULL) THEN
       RAISE EXCEPTION 'Generate the revised Vendor IO before removing pending.';
     END IF;
     IF EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND status='revision_pending' AND original_currency IS DISTINCT FROM a.currency) THEN
       RAISE EXCEPTION 'Payment currency no longer matches the agreed cost currency.';
     END IF;
     -- Delete only the hold marker. Payment rows and original IO links stay intact.
     DELETE FROM creator_payment_cost_holds WHERE assignment_id=a.id;
   END IF;
   FOR e IN SELECT * FROM creator_payment_entries WHERE assignment_id=a.id AND cleared_at IS NULL
     AND status=CASE WHEN p_pending THEN 'paid' ELSE 'revision_pending' END ORDER BY id FOR UPDATE LOOP
     INSERT INTO creator_payment_revisions(entry_id,campaign_id,previous_values,reason,changed_by)
       VALUES(e.id,e.campaign_id,to_jsonb(e),CASE WHEN p_pending THEN 'Pending cost revision — payment retained' ELSE 'Cost revision completed — original payment restored' END,auth.uid());
     UPDATE creator_payment_entries SET status=CASE WHEN p_pending THEN 'revision_pending' ELSE 'paid' END,revision=revision+1 WHERE id=e.id;
   END LOOP;
   IF p_pending THEN
     INSERT INTO creator_payment_cost_holds(assignment_id,campaign_id,created_by) VALUES(a.id,a.campaign_header_id,auth.uid());
   END IF;
   SELECT coalesce(sum(original_amount),0),max(coalesce(confirmed_at,payment_date::timestamptz,created_at)) INTO paid,last_paid
     FROM creator_payment_entries WHERE assignment_id=a.id AND status='paid' AND cleared_at IS NULL;
   total:=round(coalesce(a.cost_before_vat,a.agreed_fee,0)*(1+coalesce(a.cost_vat_percent,0)/100),2);
   INSERT INTO creator_payment_terms(assignment_id,campaign_id,fee,vat,updated_by)
     VALUES(a.id,a.campaign_header_id,round(coalesce(a.cost_before_vat,a.agreed_fee,0),2),coalesce(a.cost_vat_percent,0),auth.uid())
     ON CONFLICT(assignment_id) DO UPDATE SET fee=excluded.fee,vat=excluded.vat,updated_by=excluded.updated_by,updated_at=now();
   UPDATE campaign_influencers SET vendor_payment_status=(CASE WHEN paid>0 AND paid>=total THEN 'paid' WHEN paid>0 THEN 'pending' ELSE 'unpaid' END)::vendor_payment_status,
     vendor_paid_at=CASE WHEN paid>0 AND paid>=total THEN last_paid ELSE NULL END WHERE id=a.id;
   DELETE FROM creator_payment_plans WHERE assignment_id=a.id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.set_creator_payment_cost_pending(uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_creator_payment_cost_pending(uuid[],boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_creator_payment_cost_hold(), public.guard_pending_cost_currency() FROM PUBLIC;
COMMIT;
