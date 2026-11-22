BEGIN;
-- Preserve Accounting access and worked-vendor eligibility; enrich the existing lookup only.
CREATE OR REPLACE FUNCTION tw_accounting_parties(p_kind text,p_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF length(p_search)>120 THEN RAISE EXCEPTION 'Search is too long';END IF;
 IF p_kind='client' THEN
 SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,document_number code,name FROM clients WHERE document_number IS NOT NULL AND concat_ws(' ',document_number,name,legal_name) ILIKE '%'||p_search||'%' ORDER BY name,id LIMIT 100)x;
 ELSIF p_kind='vendor' THEN
 WITH eligible AS(SELECT i.id,i.document_number code,coalesce(nullif(trim(i.legal_name),''),nullif(trim(i.display_name),''),i.document_number) name,nullif(trim(i.legal_name),'') legal_name,i.display_name,
 (SELECT string_agg(DISTINCT coalesce(nullif(trim(a.username::text),''),nullif(trim(a.handle::text),'')),', ' ORDER BY coalesce(nullif(trim(a.username::text),''),nullif(trim(a.handle::text),''))) FROM influencer_platform_accounts a WHERE a.influencer_id=i.id) username
 FROM influencers i WHERE tw_accounting_worked_vendor(i.id) AND i.document_number IS NOT NULL)
 SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT * FROM eligible WHERE concat_ws(' ',code,name,display_name,username) ILIKE '%'||p_search||'%' ORDER BY name,id LIMIT 100)x;
 ELSE RAISE EXCEPTION 'Choose client or vendor';END IF;RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_parties(text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_parties(text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
