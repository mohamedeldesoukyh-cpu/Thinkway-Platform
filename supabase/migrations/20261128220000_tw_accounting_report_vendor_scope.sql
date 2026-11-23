BEGIN;
-- Compute the same commercial/worked-vendor eligibility as a set, once per
-- report, rather than running two assignment probes for every directory row.
CREATE FUNCTION public.tw_accounting_report_vendor_ids() RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.id FROM influencers i WHERE i.has_commercial_profile
 AND coalesce((tw_module_access()->>'accounting')::boolean,false)
 UNION
 SELECT ci.influencer_id FROM campaign_influencers ci
 JOIN campaign_lines l ON l.id=ci.campaign_line_id
 WHERE l.status<>'cancelled' AND coalesce((tw_module_access()->>'accounting')::boolean,false)
 UNION
 SELECT i.id FROM campaign_lines l JOIN influencers i
 ON i.id::text=l.metadata->'influencer_assignment'->>'influencer_id'
 WHERE l.status<>'cancelled' AND coalesce((tw_module_access()->>'accounting')::boolean,false)
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_report_vendor_ids() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_report_vendor_ids() TO authenticated;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO d;
 IF position('AND tw_accounting_eligible_vendor(i.id)' IN d)=0 THEN RAISE EXCEPTION 'Unexpected report vendor eligibility';END IF;
 d:=replace(d,'WITH RECURSIVE scope AS(', 'WITH RECURSIVE eligible_vendors AS MATERIALIZED (SELECT id FROM tw_accounting_report_vendor_ids()), scope AS(');
 d:=replace(d,'AND tw_accounting_eligible_vendor(i.id)','AND i.id IN (SELECT id FROM eligible_vendors)');
 EXECUTE d;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
