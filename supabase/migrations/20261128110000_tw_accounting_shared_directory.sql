BEGIN;
-- Commercial vendors and assignment vendors share their original Media identities.
CREATE FUNCTION tw_accounting_eligible_vendor(p_vendor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((tw_module_access()->>'accounting')::boolean,false) AND (EXISTS(SELECT 1 FROM influencers WHERE id=p_vendor AND has_commercial_profile) OR tw_accounting_worked_vendor(p_vendor));
$$;
REVOKE ALL ON FUNCTION tw_accounting_eligible_vendor(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_eligible_vendor(uuid) TO authenticated;
DO $$ DECLARE signature text;definition text;BEGIN
 FOREACH signature IN ARRAY ARRAY['tw_accounting_sync_party(uuid,text,uuid)','tw_accounting_sync_directory(uuid)','tw_accounting_party_accounts(uuid,text,text,integer)','tw_accounting_party_lookup(uuid,text,text,uuid)','tw_accounting_parties(text,text)','tw_accounting_save_entry(uuid,uuid,date,text,text,integer,text,jsonb)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
  IF position('tw_accounting_worked_vendor(' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected directory function: %',signature;END IF;
  EXECUTE replace(replace(definition,'tw_accounting_worked_vendor(','tw_accounting_eligible_vendor('),'Choose a vendor used in Media assignments','Choose a saved commercial vendor or assignment vendor');
 END LOOP;
 -- Display names always come from the shared record, including client legal-name edits.
 SELECT pg_get_functiondef('tw_accounting_party_accounts(uuid,text,text,integer)'::regprocedure) INTO definition;
 IF position('document_number code,name,currency' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected client directory definition';END IF;
 definition:=replace(definition,'document_number code,name,currency',$name$document_number code,coalesce(nullif(legal_name,''),name) name,currency$name$);
 definition:=replace(definition,'SELECT p.*,(SELECT a.code','SELECT p.*,(SELECT agency_or_direct::text FROM clients WHERE id=p.id AND p_kind=''client'') classification,(SELECT a.code');
 definition:=replace(definition,'ORDER BY name,id LIMIT 50',$order$ORDER BY substring(p.code from '[0-9]+$')::numeric NULLS LAST,p.code,p.id LIMIT 50$order$);
 EXECUTE definition;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
