BEGIN;
ALTER TABLE tw_accounting_accounts ADD COLUMN auto_party_account boolean NOT NULL DEFAULT false;
CREATE TABLE tw_accounting_party_sequences(company_id uuid REFERENCES tw_accounting_companies(id),kind text CHECK(kind IN('client','vendor')),last_number integer NOT NULL,PRIMARY KEY(company_id,kind));
ALTER TABLE tw_accounting_party_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_party_sequences FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS tw_accounting_assignment_creator_idx ON campaign_lines ((metadata->'influencer_assignment'->>'influencer_id'));
CREATE FUNCTION tw_accounting_worked_vendor(p_vendor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM campaign_influencers ci JOIN campaign_lines l ON l.id=ci.campaign_line_id WHERE ci.influencer_id=p_vendor AND l.status<>'cancelled') OR EXISTS(SELECT 1 FROM campaign_lines l WHERE l.status<>'cancelled' AND l.metadata->'influencer_assignment'->>'influencer_id'=p_vendor::text);
$$;
REVOKE ALL ON FUNCTION tw_accounting_worked_vendor(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION search_worked_vendors(p_search text DEFAULT NULL) RETURNS SETOF influencers LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.* FROM search_vendor_identities(p_search)i WHERE tw_accounting_worked_vendor(i.id);
$$;
CREATE FUNCTION worked_vendor_total_count(p_search text DEFAULT NULL,p_status text DEFAULT NULL,p_platform text DEFAULT NULL,p_crm_only boolean DEFAULT true) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*) FROM search_worked_vendors(p_search)i WHERE (nullif(trim(p_status),'') IS NULL OR i.status::text=trim(p_status)) AND (nullif(trim(p_platform),'') IS NULL OR EXISTS(SELECT 1 FROM influencer_platform_accounts a WHERE a.influencer_id=i.id AND a.platform=trim(p_platform)));
$$;
REVOKE ALL ON FUNCTION search_worked_vendors(text),worked_vendor_total_count(text,text,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION search_worked_vendors(text),worked_vendor_total_count(text,text,text,boolean) TO authenticated;
CREATE FUNCTION tw_accounting_sync_party(p_company uuid,p_kind text,p_party uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE code text;label text;parent text;candidate integer;BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF p_kind='client' THEN
  SELECT a.code INTO code FROM tw_accounting_accounts a WHERE a.company_id=p_company AND a.client_id=p_party AND a.kind='Control' AND a.account_type='Asset' AND a.normal_balance='Debit' ORDER BY a.code LIMIT 1;
  SELECT coalesce(nullif(legal_name,''),name) INTO label FROM clients WHERE id=p_party;
  parent:='120000';
 ELSIF p_kind='vendor' THEN
  IF NOT tw_accounting_worked_vendor(p_party) THEN RETURN NULL;END IF;
  SELECT a.code INTO code FROM tw_accounting_accounts a WHERE a.company_id=p_company AND a.vendor_id=p_party AND a.kind='Control' AND a.account_type='Liability' AND a.normal_balance='Credit' ORDER BY a.code LIMIT 1;
  SELECT coalesce(nullif(legal_name,''),display_name,document_number) INTO label FROM influencers WHERE id=p_party;
  parent:='210000';
 ELSE RAISE EXCEPTION 'Choose client or vendor';END IF;
 IF label IS NULL THEN RAISE EXCEPTION 'Shared client/vendor record not found';END IF;
 IF length(trim(label))<2 THEN label:=label||' account';END IF;
 IF code IS NOT NULL THEN
  UPDATE tw_accounting_accounts a SET name=left(label,150) WHERE a.company_id=p_company AND a.code=code AND a.auto_party_account AND a.name IS DISTINCT FROM left(label,150);RETURN code;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_accounts a WHERE a.company_id=p_company AND a.code=parent AND a.kind='Group' AND a.active) THEN RETURN NULL;END IF;
 LOOP
  INSERT INTO tw_accounting_party_sequences AS s VALUES(p_company,p_kind,CASE WHEN p_kind='client' THEN 121002 ELSE 211002 END) ON CONFLICT(company_id,kind) DO UPDATE SET last_number=s.last_number+1 RETURNING last_number INTO candidate;
  IF candidate>(CASE WHEN p_kind='client' THEN 129999 ELSE 219999 END) THEN RAISE EXCEPTION 'Account number range exhausted; extend the chart before syncing';END IF;
  EXIT WHEN NOT EXISTS(SELECT 1 FROM tw_accounting_accounts a WHERE a.company_id=p_company AND a.code=candidate::text);
 END LOOP;
 code:=candidate::text;
 INSERT INTO tw_accounting_accounts(company_id,code,name,parent_code,account_type,normal_balance,kind,subledger,client_id,vendor_id,has_auxiliary,auto_party_account)
 VALUES(p_company,code,left(label,150),parent,CASE WHEN p_kind='client' THEN 'Asset' ELSE 'Liability' END,CASE WHEN p_kind='client' THEN 'Debit' ELSE 'Credit' END,'Control',CASE WHEN p_kind='client' THEN 'Customer' ELSE 'Supplier / creator' END,CASE WHEN p_kind='client' THEN p_party END,CASE WHEN p_kind='vendor' THEN p_party END,false,true);
 RETURN code;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_sync_party(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION tw_accounting_sync_directory(p_company uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;clients_count integer:=0;vendors_count integer:=0;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 FOR r IN SELECT id FROM clients ORDER BY id LOOP IF tw_accounting_sync_party(p_company,'client',r.id) IS NOT NULL THEN clients_count:=clients_count+1;END IF;END LOOP;
 FOR r IN SELECT id FROM influencers WHERE tw_accounting_worked_vendor(id) ORDER BY id LOOP IF tw_accounting_sync_party(p_company,'vendor',r.id) IS NOT NULL THEN vendors_count:=vendors_count+1;END IF;END LOOP;
 RETURN jsonb_build_object('clients',clients_count,'vendors',vendors_count);
END $$;
CREATE FUNCTION tw_accounting_shared_party_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record;party uuid;kind text;BEGIN
 IF TG_TABLE_NAME='clients' THEN party:=NEW.id;kind:='client';
 ELSIF TG_TABLE_NAME='influencers' THEN party:=NEW.id;kind:='vendor';
 ELSIF TG_TABLE_NAME='campaign_influencers' THEN party:=NEW.influencer_id;kind:='vendor';
 ELSE kind:='vendor';BEGIN party:=nullif(NEW.metadata->'influencer_assignment'->>'influencer_id','')::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN NEW;END;END IF;
 IF party IS NULL THEN RETURN NEW;END IF;
 FOR c IN SELECT id FROM tw_accounting_companies ORDER BY id LOOP PERFORM tw_accounting_sync_party(c.id,kind,party);END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_shared_party_changed() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tw_accounting_shared_client AFTER INSERT OR UPDATE OF name,legal_name ON clients FOR EACH ROW EXECUTE FUNCTION tw_accounting_shared_party_changed();
CREATE TRIGGER tw_accounting_shared_vendor AFTER UPDATE OF display_name,legal_name ON influencers FOR EACH ROW EXECUTE FUNCTION tw_accounting_shared_party_changed();
CREATE TRIGGER tw_accounting_assignment_vendor AFTER INSERT OR UPDATE OF influencer_id,campaign_line_id ON campaign_influencers FOR EACH ROW EXECUTE FUNCTION tw_accounting_shared_party_changed();
CREATE TRIGGER tw_accounting_line_vendor AFTER INSERT OR UPDATE OF metadata,status ON campaign_lines FOR EACH ROW EXECUTE FUNCTION tw_accounting_shared_party_changed();
CREATE FUNCTION tw_accounting_create_client(p_company uuid,p_name text,p_legal_name text,p_type text,p_currency text,p_country text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r clients%ROWTYPE;account text;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 IF length(trim(p_name)) NOT BETWEEN 2 AND 150 OR length(trim(p_legal_name)) NOT BETWEEN 2 AND 150 OR p_type NOT IN('agency','direct','hybrid') OR p_currency !~ '^[A-Z]{3}$' OR p_country !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Enter the client name, legal name, type, currency and country';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_companies WHERE id=p_company) THEN RAISE EXCEPTION 'Accounting company not found';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(trim(p_name)),0));
 IF EXISTS(SELECT 1 FROM clients WHERE lower(trim(name))=lower(trim(p_name))) THEN RAISE EXCEPTION 'This client already exists in the shared directory. Select the existing client.';END IF;
 INSERT INTO clients(name,legal_name,agency_or_direct,currency,country,status,created_by) VALUES(trim(p_name),trim(p_legal_name),p_type::agency_or_direct,p_currency,p_country,'prospect',auth.uid()) RETURNING * INTO r;
 account:=tw_accounting_sync_party(p_company,'client',r.id);
 RETURN jsonb_build_object('id',r.id,'code',r.document_number,'name',r.name,'account',account);
END $$;
CREATE FUNCTION tw_accounting_party_accounts(p_company uuid,p_kind text,p_search text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;total bigint;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_page<0 OR p_page>10000 OR length(p_search)>120 OR p_kind NOT IN('client','vendor') THEN RAISE EXCEPTION 'Invalid directory filters';END IF;
 WITH parties AS(SELECT id,document_number code,name,currency::text FROM clients WHERE p_kind='client' UNION ALL SELECT id,document_number,coalesce(legal_name,display_name,document_number),NULL::text FROM influencers WHERE p_kind='vendor' AND tw_accounting_worked_vendor(id)),filtered AS(SELECT * FROM parties WHERE concat_ws(' ',code,name) ILIKE '%'||p_search||'%')
 SELECT jsonb_build_object('count',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(x) FROM(SELECT p.*,(SELECT a.code FROM tw_accounting_accounts a WHERE a.company_id=p_company AND ((p_kind='client' AND a.client_id=p.id AND a.account_type='Asset') OR(p_kind='vendor' AND a.vendor_id=p.id AND a.account_type='Liability')) ORDER BY a.code LIMIT 1) account FROM filtered p ORDER BY name,id LIMIT 50 OFFSET p_page*50)x),'[]')) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_sync_directory(uuid),tw_accounting_create_client(uuid,text,text,text,text,text),tw_accounting_party_accounts(uuid,text,text,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_sync_directory(uuid),tw_accounting_create_client(uuid,text,text,text,text,text),tw_accounting_party_accounts(uuid,text,text,integer) TO authenticated;
CREATE OR REPLACE FUNCTION tw_accounting_parties(p_kind text,p_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE result jsonb; BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF length(p_search)>120 THEN RAISE EXCEPTION 'Search is too long'; END IF;
 IF p_kind='client' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,document_number code,name FROM clients WHERE document_number IS NOT NULL AND concat_ws(' ',document_number,name) ILIKE '%'||p_search||'%' ORDER BY name,id LIMIT 100)x;
 ELSIF p_kind='vendor' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,document_number code,coalesce(legal_name,display_name,document_number) name FROM influencers WHERE tw_accounting_worked_vendor(id) AND document_number IS NOT NULL AND concat_ws(' ',document_number,legal_name,display_name) ILIKE '%'||p_search||'%' ORDER BY coalesce(legal_name,display_name),id LIMIT 100)x;
 ELSE RAISE EXCEPTION 'Choose client or vendor'; END IF; RETURN result;
END $$;


COMMIT;
