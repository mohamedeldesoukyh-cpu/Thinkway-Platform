-- Payment-only confirmation of corrected commercial values. Never rewrites an IO.
BEGIN;
CREATE TABLE public.creator_payment_detail_confirmations (
 assignment_id uuid PRIMARY KEY REFERENCES public.campaign_influencers(id),
 campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
 io_id uuid NOT NULL REFERENCES public.vendor_ios(id),
 fee numeric NOT NULL, vat numeric NOT NULL, currency text NOT NULL,
 io_changed_at timestamptz,
 confirmed_by uuid NOT NULL REFERENCES auth.users(id),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_payment_detail_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_detail_confirmation_read ON public.creator_payment_detail_confirmations
 FOR SELECT TO authenticated USING(public.can_manage_creator_payments(campaign_id,false));
GRANT SELECT ON public.creator_payment_detail_confirmations TO authenticated;

CREATE FUNCTION public.creator_payment_details_updatable(p_io uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM vendor_ios v JOIN campaign_influencers a ON a.id=v.assignment_id
 JOIN campaign_lines l ON l.id=a.campaign_line_id
 WHERE v.id=p_io AND public.can_manage_creator_payments(v.campaign_header_id,false)
 AND v.is_superseded AND v.lifecycle_reason_code='pending_regeneration'
 AND v.status::text NOT IN ('cancelled','void','voided','rejected') AND l.status::text<>'cancelled'
 AND l.metadata->>'pending_vendor_io_id'=v.id::text
 AND public.vendor_io_has_issue_evidence(v.document_generated_at,v.sent_at,v.delivered_at,v.approved_at)
 AND NOT EXISTS(SELECT 1 FROM vendor_ios newer WHERE newer.assignment_id=a.id AND (newer.created_at,newer.id)>(v.created_at,v.id))
 AND NOT EXISTS(SELECT 1 FROM creator_payment_entries e WHERE e.assignment_id=a.id AND e.status IN ('revision_pending','exported')));
$$;
CREATE FUNCTION public.creator_payment_io_eligible(p_io uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM vendor_ios v JOIN campaign_influencers a ON a.id=v.assignment_id
 WHERE v.id=p_io AND public.can_manage_creator_payments(v.campaign_header_id,false)
 AND public.vendor_io_has_issue_evidence(v.document_generated_at,v.sent_at,v.delivered_at,v.approved_at)
 AND v.status::text NOT IN ('cancelled','void','voided','rejected')
 AND (NOT coalesce(v.is_superseded,false) OR (public.creator_payment_details_updatable(v.id)
 AND EXISTS(SELECT 1 FROM creator_payment_detail_confirmations c WHERE c.assignment_id=a.id AND c.io_id=v.id
 AND c.fee=round(coalesce(a.cost_before_vat,a.agreed_fee,v.amount,0),2)
 AND c.vat=coalesce(a.cost_vat_percent,0) AND c.currency=a.currency
 AND c.io_changed_at IS NOT DISTINCT FROM v.lifecycle_changed_at))));
$$;
CREATE FUNCTION public.creator_payment_io_states(p_ios uuid[])
RETURNS TABLE(io_id uuid,eligible boolean,can_update boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT v.id,public.creator_payment_io_eligible(v.id),public.creator_payment_details_updatable(v.id)
 FROM vendor_ios v WHERE v.id=ANY(p_ios) AND public.can_manage_creator_payments(v.campaign_header_id,false);
$$;
CREATE FUNCTION public.update_creator_payment_details(p_io uuid,p_fee numeric,p_vat numeric,p_currency text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v vendor_ios%ROWTYPE; a campaign_influencers%ROWTYPE;
BEGIN
 SELECT * INTO v FROM vendor_ios WHERE id=p_io;
 IF v.id IS NULL OR NOT public.can_manage_creator_payments(v.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance write access required'; END IF;
 SELECT * INTO a FROM campaign_influencers WHERE id=v.assignment_id FOR UPDATE;
 SELECT * INTO v FROM vendor_ios WHERE id=p_io FOR SHARE;
 IF NOT public.creator_payment_details_updatable(p_io) THEN RAISE EXCEPTION 'Payment details cannot be updated for this IO. Refresh payments.'; END IF;
 IF p_fee IS DISTINCT FROM round(coalesce(a.cost_before_vat,a.agreed_fee,v.amount,0),2)
 OR p_vat IS DISTINCT FROM coalesce(a.cost_vat_percent,0) OR p_currency IS DISTINCT FROM a.currency THEN
 RAISE EXCEPTION 'Cost, VAT or currency changed. Refresh and review payment details.'; END IF;
 INSERT INTO creator_payment_detail_confirmations(assignment_id,campaign_id,io_id,fee,vat,currency,io_changed_at,confirmed_by)
 VALUES(a.id,v.campaign_header_id,v.id,p_fee,p_vat,p_currency,v.lifecycle_changed_at,auth.uid())
 ON CONFLICT(assignment_id) DO UPDATE SET io_id=excluded.io_id,fee=excluded.fee,vat=excluded.vat,currency=excluded.currency,
 io_changed_at=excluded.io_changed_at,confirmed_by=auth.uid(),confirmed_at=now();
 INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('creator_payment_details_updated','payment_details_confirmed','Payment details updated; original creator IO preserved',v.campaign_header_id,'campaign_influencer',a.id,
 jsonb_build_object('io_id',v.id,'fee',p_fee,'vat',p_vat,'currency',p_currency),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.creator_payment_details_updatable(uuid),public.creator_payment_io_eligible(uuid),public.creator_payment_io_states(uuid[]),public.update_creator_payment_details(uuid,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_payment_details_updatable(uuid),public.creator_payment_io_eligible(uuid),public.creator_payment_io_states(uuid[]),public.update_creator_payment_details(uuid,numeric,numeric,text) TO authenticated;

-- Preserve all existing locks, balance, idempotency, bank and permission checks.
DO $$ DECLARE def text; patched text; BEGIN
 def:=pg_get_functiondef('public.record_creator_payments(uuid,jsonb)'::regprocedure);
 patched:=replace(def,'coalesce(v.is_superseded,false)','NOT public.creator_payment_io_eligible(v.id)');
 IF patched=def THEN RAISE EXCEPTION 'Record payment guard not found'; END IF; EXECUTE patched;
 def:=pg_get_functiondef('public.create_creator_payment_export(uuid,uuid,date,text,jsonb)'::regprocedure);
 patched:=replace(def,'NOT coalesce(is_superseded,false)','public.creator_payment_io_eligible(vendor_ios.id)');
 IF patched=def THEN RAISE EXCEPTION 'Export payment guard not found'; END IF; EXECUTE patched;
 def:=pg_get_functiondef('public.save_creator_payment_plans(jsonb)'::regprocedure);
 patched:=replace(def,'NOT coalesce(is_superseded,false)','public.creator_payment_io_eligible(vendor_ios.id)');
 IF patched=def THEN RAISE EXCEPTION 'Plan payment guard not found'; END IF; EXECUTE patched;
END $$;
COMMIT;
