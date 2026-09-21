-- Explicitly saved preparation only. Never creates paid/reserved ledger entries.
CREATE TABLE public.creator_payment_plans (
  assignment_id uuid PRIMARY KEY REFERENCES public.campaign_influencers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
  draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_payment_plans_read ON public.creator_payment_plans FOR SELECT TO authenticated
  USING(public.can_manage_creator_payments(campaign_id,false));
GRANT SELECT ON public.creator_payment_plans TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.creator_payment_plans FROM authenticated;

CREATE FUNCTION public.save_creator_payment_plans(p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; a record; d jsonb;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Finance access required'; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Save 1 to 200 payment plans'; END IF;
  PERFORM id FROM campaign_influencers WHERE id IN (SELECT (value->>'assignmentId')::uuid FROM jsonb_array_elements(p_rows)) ORDER BY id FOR UPDATE;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT * INTO a FROM campaign_influencers WHERE id=(r->>'assignmentId')::uuid;
    IF a.id IS NULL OR NOT public.can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM vendor_ios WHERE assignment_id=a.id AND document_generated_at IS NOT NULL AND NOT coalesce(is_superseded,false) AND status::text NOT IN ('cancelled','void','voided','rejected')) THEN RAISE EXCEPTION 'A current generated IO is required'; END IF;
    d:=r->'draft';
    IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(d::text)>4000
       OR coalesce(d->>'mode','') NOT IN ('full','percent','manual')
       OR coalesce(d->>'currency','') !~ '^[A-Z]{3}$'
       OR coalesce((d->>'vat')::numeric,-1) NOT BETWEEN 0 AND 100
       OR coalesce((d->>'percent')::numeric,-1) NOT BETWEEN 0 AND 100
       OR coalesce((d->>'rate')::numeric,0) NOT BETWEEN 0.00000001 AND 999999999
       OR coalesce((d->>'amount')::numeric,-1) NOT BETWEEN 0 AND 9999999999999
       THEN RAISE EXCEPTION 'Invalid payment plan'; END IF;
    INSERT INTO creator_payment_plans(assignment_id,campaign_id,draft,updated_by)
      VALUES(a.id,a.campaign_header_id,d,auth.uid())
      ON CONFLICT(assignment_id) DO UPDATE SET draft=excluded.draft,updated_by=auth.uid(),updated_at=now();
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_creator_payment_plans(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_creator_payment_plans(jsonb) TO authenticated;

-- Consumed plans must not reappear as a second installment after export.
CREATE FUNCTION public.consume_creator_payment_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM creator_payment_plans WHERE assignment_id=NEW.assignment_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consume_creator_payment_plan() FROM PUBLIC;
CREATE TRIGGER consume_creator_payment_plan AFTER INSERT ON public.creator_payment_entries
  FOR EACH ROW EXECUTE FUNCTION public.consume_creator_payment_plan();
NOTIFY pgrst,'reload schema';
