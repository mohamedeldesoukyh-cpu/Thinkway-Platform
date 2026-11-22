BEGIN;
-- The existing client-invoice submission and cost-invoice ledgers remain the
-- source of truth. This bridge supplies the missing supplier/CN/DN identities.
CREATE TABLE tw_accounting_media_postings(
 source_type text NOT NULL CHECK(source_type IN('supplier_invoice','client_credit_note','vendor_credit_note','client_debit_note','vendor_debit_note')),
 source_id uuid NOT NULL,company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 journal_id uuid UNIQUE REFERENCES tw_accounting_journals(id),cost_id uuid UNIQUE REFERENCES tw_accounting_cost_invoices(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','posted')),version integer NOT NULL DEFAULT 1,
 snapshot jsonb NOT NULL DEFAULT '{}',created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_type,source_id)
);
ALTER TABLE tw_accounting_media_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_media_postings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_media_postings TO authenticated;
CREATE POLICY accounting_read ON tw_accounting_media_postings FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE INDEX tw_media_postings_company ON tw_accounting_media_postings(company_id,status);
CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON tw_accounting_media_postings FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
ALTER TABLE tw_accounting_journals DROP CONSTRAINT tw_pending_source;
ALTER TABLE tw_accounting_journals ADD CONSTRAINT tw_pending_source CHECK(status<>'pending' OR source_invoice_id IS NOT NULL AND reversal_of IS NULL OR resume_status IS NOT NULL OR automatic_source IN('cost_invoice','cost_adjustment','media_client_credit_note','media_vendor_credit_note','media_client_debit_note','media_vendor_debit_note'));

CREATE FUNCTION tw_accounting_media_table(p_type text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE p_type WHEN 'client_invoice' THEN 'invoices' WHEN 'supplier_invoice' THEN 'creator_supplier_invoices' WHEN 'internal_cost' THEN 'tw_accounting_cost_invoices'
 WHEN 'client_credit_note' THEN 'client_credit_notes' WHEN 'vendor_credit_note' THEN 'vendor_credit_notes' WHEN 'client_debit_note' THEN 'client_debit_notes' WHEN 'vendor_debit_note' THEN 'vendor_debit_notes' END
$$;

CREATE FUNCTION tw_accounting_media_source(p_company uuid,p_type text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE raw jsonb;s jsonb;party uuid;name text;code text;base text;rate numeric;t text;eligible boolean:=true;reason text:='';j uuid;state text;ver integer;accrual jsonb:='[]';
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF NOT coalesce((tw_module_access()->>'media')::boolean,false) OR NOT (is_admin() OR has_permission('finance.read') OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Media Finance access required' USING ERRCODE='42501';END IF;
 t:=tw_accounting_media_table(p_type);IF t IS NULL THEN RAISE EXCEPTION 'Unknown document type';END IF;
 EXECUTE format('SELECT to_jsonb(s) FROM %I s WHERE id=$1',t) INTO raw USING p_id;
 IF raw IS NULL THEN RAISE EXCEPTION 'Source document unavailable';END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 IF base IS NULL THEN RAISE EXCEPTION 'Accounting company unavailable';END IF;
 IF p_type='client_invoice' THEN
  IF NOT tw_accounting_media_invoice_access(p_id,false) THEN RAISE EXCEPTION 'Invoice access required' USING ERRCODE='42501';END IF;
  party:=(raw->>'client_id')::uuid;
  eligible:=raw->>'status'<>'void' AND raw->>'regeneration_status'='active' AND (raw->>'amounts_finalized_at' IS NOT NULL OR raw->>'status'<>'draft');
  reason:='Finalize the active invoice in Media before posting';
  s:=jsonb_build_object('number',raw->>'document_number','date',raw->>'issue_date','currency',trim(raw->>'currency'),'net',raw->>'subtotal','tax',raw->>'tax_amount','total',raw->>'total','client',party);
  SELECT journal_id,status,version INTO j,state,ver FROM tw_accounting_invoice_submissions WHERE invoice_id=p_id AND company_id=p_company;
  IF EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=p_id AND company_id<>p_company AND status<>'withdrawn') THEN eligible:=false;reason:='Already assigned to another accounting company';END IF;
  IF eligible AND state IS DISTINCT FROM 'posted' THEN BEGIN accrual:=tw_accounting_invoice_accrual_plan(p_id,p_company);EXCEPTION WHEN OTHERS THEN eligible:=false;reason:=SQLERRM;END;END IF;
 ELSIF p_type='supplier_invoice' THEN
  SELECT influencer_id INTO party FROM campaign_influencers WHERE id=(raw->>'assignment_id')::uuid;
  eligible:=raw->>'status'='received' AND (raw->>'confirmed')::boolean;
  reason:='Receive and confirm the supplier invoice in Media before posting';
  s:=jsonb_build_object('number',raw->>'invoice_number','date',raw->>'invoice_date','currency',raw->>'currency','net',raw->>'subtotal','tax',raw->>'vat_amount','total',((raw->>'subtotal')::numeric+(raw->>'vat_amount')::numeric)::text,'vendor',party,'assignment',(SELECT campaign_line_id FROM campaign_influencers WHERE id=(raw->>'assignment_id')::uuid));
 ELSIF p_type='internal_cost' THEN
  IF (raw->>'company_id')::uuid<>p_company THEN RAISE EXCEPTION 'Cost invoice belongs to another company';END IF;
  party:=(raw->>'vendor_id')::uuid;eligible:=raw->>'status'<>'reversed';reason:='Reversed cost invoices cannot be posted';
  s:=jsonb_build_object('number',coalesce(raw->>'number',raw->>'supplier_number','Draft cost'),'date',raw->>'document_date','currency',raw->>'currency','net',raw->>'net','tax',raw->>'tax','total',((raw->>'net')::numeric+(raw->>'tax')::numeric)::text,'vendor',party,'assignment',raw->>'assignment_line_id');
  j:=nullif(raw->>'journal_id','')::uuid;state:=CASE WHEN raw->>'status' IN('internal','supplier') THEN 'posted' ELSE 'pending' END;ver:=(raw->>'version')::integer;
 ELSE
  party:=coalesce(nullif(raw->>'client_id',''),nullif(raw->>'vendor_id',''))::uuid;
  eligible:=raw->>'status' IN('approved','posted','pending_repost') AND raw->>'posting_batch_id' IS NULL;
  reason:='Approve the note and resolve any external ERP posting before posting to TW Accounting';
  s:=jsonb_build_object('number',raw->>'document_number','date',raw->>'issue_date','currency',trim(raw->>'currency'),'net',raw->>'amount_before_vat','tax',raw->>'vat_amount','total',raw->>'amount_after_vat','client',raw->>'client_id','vendor',raw->>'vendor_id','invoice',raw->>'invoice_id');
 END IF;
 IF p_type NOT IN('client_invoice','internal_cost') THEN
  SELECT journal_id,status,version INTO j,state,ver FROM tw_accounting_media_postings WHERE source_type=p_type AND source_id=p_id AND company_id=p_company;
  IF EXISTS(SELECT 1 FROM tw_accounting_media_postings WHERE source_type=p_type AND source_id=p_id AND company_id<>p_company) THEN eligible:=false;reason:='Already assigned to another accounting company';END IF;
 END IF;
 IF s->>'client' IS NOT NULL THEN SELECT x.name,x.document_number INTO name,code FROM clients x WHERE x.id=party;
 ELSE SELECT coalesce(legal_name,display_name),document_number INTO name,code FROM influencers WHERE id=party;END IF;
 IF party IS NULL OR code IS NULL THEN eligible:=false;reason:='A Third Party with a valid shared code is required';END IF;
 BEGIN rate:=resolve_effective_exchange_rate(s->>'currency',base,(s->>'date')::date);EXCEPTION WHEN OTHERS THEN eligible:=false;reason:=SQLERRM;END;
 s:=s||jsonb_build_object('id',p_id,'type',p_type,'party',name,'code',code,'rate',rate::text,'base',base,'eligible',coalesce(eligible,false),'reason',CASE WHEN eligible THEN '' ELSE reason END,'status',coalesce(state,'unposted'),'version',coalesce(ver,0),'journal',j,'accruals',accrual);
 RETURN s||jsonb_build_object('token',md5((raw||jsonb_build_object('_state',state,'_version',ver,'_rate',rate,'_mappings',tw_accounting_mappings_read(p_company),'_accruals',accrual))::text));
END $$;

CREATE FUNCTION tw_accounting_media_queue(p_company uuid,p_type text,p_from date,p_to date,p_posted boolean DEFAULT false,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t text;date_column text;predicate text;state_sql text;r record;item jsonb;result jsonb:='[]';total integer:=0;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Check queue filters';END IF;
 IF NOT coalesce((tw_module_access()->>'media')::boolean,false) OR NOT (is_admin() OR has_permission('finance.read') OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Media Finance access required' USING ERRCODE='42501';END IF;
 t:=tw_accounting_media_table(p_type);IF t IS NULL THEN RAISE EXCEPTION 'Unknown document type';END IF;
 date_column:=CASE p_type WHEN 'supplier_invoice' THEN 'invoice_date' WHEN 'internal_cost' THEN 'document_date' ELSE 'issue_date' END;
 predicate:=CASE WHEN p_type='internal_cost' THEN ' AND s.company_id=$3 AND NOT EXISTS(SELECT 1 FROM tw_accounting_media_postings b WHERE b.cost_id=s.id)' ELSE '' END;
 state_sql:=CASE WHEN p_type='client_invoice' THEN 'EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions b WHERE b.invoice_id=s.id AND b.company_id=$3 AND b.status=''posted'')'
 WHEN p_type='internal_cost' THEN 's.status IN(''internal'',''supplier'')'
 ELSE 'EXISTS(SELECT 1 FROM tw_accounting_media_postings b WHERE b.source_type=$4 AND b.source_id=s.id AND b.company_id=$3 AND b.status=''posted'')' END;
 FOR r IN EXECUTE format('SELECT s.id,count(*) OVER() total FROM %I s WHERE s.%I BETWEEN $1 AND $2 %s AND (%s)=$5 ORDER BY s.%I,s.id LIMIT 50 OFFSET $6',t,date_column,predicate,state_sql,date_column) USING p_from,p_to,p_company,p_type,p_posted,p_offset LOOP
  total:=r.total;
  BEGIN item:=tw_accounting_media_source(p_company,p_type,r.id);EXCEPTION WHEN insufficient_privilege THEN CONTINUE;END;
  result:=result||jsonb_build_array(item);
 END LOOP;
 RETURN jsonb_build_object('rows',result,'count',total);
END $$;

CREATE FUNCTION tw_accounting_media_mapping(p_company uuid,p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE m jsonb;BEGIN
 SELECT x INTO m FROM jsonb_array_elements(tw_accounting_mappings_read(p_company))x WHERE x->>'key'=p_key AND (x->>'active')::boolean;
 IF m->>'account' IS NULL THEN RAISE EXCEPTION 'Configure % in System Mapping',p_key;END IF;RETURN m;
END $$;

CREATE FUNCTION tw_accounting_media_post(p_company uuid,p_type text,p_id uuid,p_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t text;raw jsonb;s jsonb;m jsonb;maps jsonb;plan jsonb;bridge tw_accounting_media_postings%ROWTYPE;cost tw_accounting_cost_invoices%ROWTYPE;oldj tw_accounting_journals%ROWTYPE;
 j uuid;cid uuid;version integer;rate numeric;net numeric;tax numeric;bn numeric;bt numeric;credit_note boolean;client_note boolean;party uuid;partycode text;revenue text;control text;vat text;aux uuid;fiscal integer;
BEGIN
 IF NOT tw_accounting_can_manage() OR NOT (is_admin() OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 IF NOT coalesce((tw_module_access()->>'media')::boolean,false) OR NOT (is_admin() OR has_permission('finance.read') OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Media Finance access required' USING ERRCODE='42501';END IF;
 t:=tw_accounting_media_table(p_type);IF t IS NULL THEN RAISE EXCEPTION 'Unknown document type';END IF;
 -- Source edits and this posting serialize on the source row. All subsidiary
 -- balances are then serialized by the existing company posting lock.
 EXECUTE format('SELECT to_jsonb(s) FROM %I s WHERE id=$1 FOR UPDATE',t) INTO raw USING p_id;
 IF raw IS NULL THEN RAISE EXCEPTION 'Source document unavailable';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 s:=tw_accounting_media_source(p_company,p_type,p_id);
 IF s->>'status'='posted' THEN RETURN (s->>'journal')::uuid;END IF;
 IF NOT(s->>'eligible')::boolean THEN RAISE EXCEPTION '%',s->>'reason';END IF;
 IF p_token IS NULL OR p_token IS DISTINCT FROM s->>'token' THEN RAISE EXCEPTION 'Document, mappings or rates changed. Browse again before posting.' USING ERRCODE='40001';END IF;
 rate:=(s->>'rate')::numeric;net:=(s->>'net')::numeric;tax:=(s->>'tax')::numeric;
 IF net<=0 OR tax<0 OR net<>round(net,2) OR tax<>round(tax,2) OR net+tax<>(s->>'total')::numeric THEN RAISE EXCEPTION 'Source document totals do not reconcile';END IF;
 IF p_type='client_invoice' THEN
  PERFORM tw_accounting_submit_invoice(p_id,p_company);
  SELECT x.version INTO version FROM tw_accounting_invoice_submissions x WHERE invoice_id=p_id;
  control:=tw_accounting_media_mapping(p_company,'client_receivable')->>'account';revenue:=tw_accounting_media_mapping(p_company,'assignment_revenue')->>'account';vat:=tw_accounting_media_mapping(p_company,'output_vat')->>'account';
  plan:=tw_accounting_invoice_mapping_preview(p_id,p_company,control,revenue,vat);
  RETURN tw_accounting_post_mapped_invoice(p_id,p_company,version,(s->>'date')::date,control,revenue,vat,rate,plan,'{}');
 END IF;
 IF p_type='internal_cost' THEN
  IF EXISTS(SELECT 1 FROM tw_accounting_media_postings WHERE cost_id=p_id) THEN RAISE EXCEPTION 'Use the linked Media supplier invoice';END IF;
  RETURN tw_accounting_post_with_aux('cost-post',jsonb_build_object('id',p_id,'company',p_company,'version',raw->>'version','rate',rate));
 END IF;
 INSERT INTO tw_accounting_media_postings(source_type,source_id,company_id) VALUES(p_type,p_id,p_company) ON CONFLICT DO NOTHING;
 SELECT * INTO bridge FROM tw_accounting_media_postings WHERE source_type=p_type AND source_id=p_id FOR UPDATE;
 IF bridge.company_id<>p_company THEN RAISE EXCEPTION 'Document belongs to another accounting company';END IF;
 IF p_type='supplier_invoice' THEN
  m:=tw_accounting_media_mapping(p_company,'assignment_cost');control:=tw_accounting_media_mapping(p_company,'vendor_payable')->>'account';vat:=tw_accounting_media_mapping(p_company,'input_vat')->>'account';
  PERFORM set_config('tw.media_posting_write',p_id::text,true);
  IF bridge.cost_id IS NULL THEN
   SELECT * INTO cost FROM tw_accounting_cost_invoices x WHERE x.company_id=p_company AND x.vendor_id=(s->>'vendor')::uuid AND x.supplier_number=s->>'number' AND x.status='supplier' ORDER BY x.created_at LIMIT 1 FOR UPDATE;
   IF FOUND THEN
    IF cost.currency<>s->>'currency' OR cost.net<>net OR cost.tax<>tax OR cost.assignment_line_id IS DISTINCT FROM (s->>'assignment')::uuid THEN RAISE EXCEPTION 'Supplier invoice number already exists with different amounts or assignment; reconcile the original cost invoice';END IF;
    UPDATE tw_accounting_media_postings SET cost_id=cost.id,journal_id=cost.journal_id,status='posted',snapshot=s,version=tw_accounting_media_postings.version+1 WHERE source_type=p_type AND source_id=p_id;
    PERFORM set_config('tw.media_posting_write','',true);RETURN cost.journal_id;
   END IF;
   IF EXISTS(SELECT 1 FROM tw_accounting_cost_invoices x WHERE x.company_id=p_company AND x.vendor_id=(s->>'vendor')::uuid AND x.assignment_line_id=(s->>'assignment')::uuid AND x.status='internal') THEN RAISE EXCEPTION 'This assignment has a provisional cost invoice. Receive/reconcile that invoice in Accounting first, then post here to link it without duplicating cost';END IF;
  END IF;
  cid:=coalesce(bridge.cost_id,gen_random_uuid());SELECT * INTO cost FROM tw_accounting_cost_invoices WHERE id=cid;
  PERFORM tw_accounting_cost_save(jsonb_build_object('id',cid,'company',p_company,'version',cost.version,'vendor',s->>'vendor','date',s->>'date','due',raw->>'due_date','currency',s->>'currency','net',net::text,'tax',tax::text,'expense',m->>'account','payable',control,'vat',vat,'description',coalesce(nullif(raw->>'description',''),'Supplier invoice '||(s->>'number')),'reference','Media supplier invoice '||(s->>'number'),'supplierNumber',s->>'number','supplierDate',s->>'date','assignment',s->>'assignment'));
  UPDATE tw_accounting_cost_invoices SET auxiliaries=CASE WHEN m->>'auxiliary_id' IS NULL THEN '{}' ELSE jsonb_build_object(m->>'account',m->>'auxiliary_id') END WHERE id=cid;
  SELECT x.version INTO version FROM tw_accounting_cost_invoices x WHERE id=cid;
  j:=tw_accounting_post_with_aux('cost-post',jsonb_build_object('id',cid,'company',p_company,'version',version,'rate',rate));
  UPDATE tw_accounting_media_postings SET cost_id=cid,journal_id=j,status='posted',snapshot=s,version=tw_accounting_media_postings.version+1 WHERE source_type=p_type AND source_id=p_id;
  PERFORM set_config('tw.media_posting_write','',true);RETURN j;
 END IF;
 client_note:=p_type LIKE 'client_%';credit_note:=p_type LIKE '%credit_note';party:=coalesce(s->>'client',s->>'vendor')::uuid;partycode:=s->>'code';
 m:=tw_accounting_media_mapping(p_company,CASE WHEN client_note THEN 'assignment_revenue' ELSE 'assignment_cost' END);
 revenue:=m->>'account';aux:=nullif(m->>'auxiliary_id','')::uuid;
 control:=tw_accounting_media_mapping(p_company,CASE WHEN client_note THEN 'client_receivable' ELSE 'vendor_payable' END)->>'account';
 vat:=tw_accounting_media_mapping(p_company,CASE WHEN client_note THEN 'output_vat' ELSE 'input_vat' END)->>'account';
 PERFORM tw_accounting_require_account(p_company,revenue,'Posting',CASE WHEN client_note THEN 'Revenue' ELSE 'Expense' END,CASE WHEN client_note THEN 'Credit' ELSE 'Debit' END);
 PERFORM tw_accounting_require_account(p_company,control,'Control',CASE WHEN client_note THEN 'Asset' ELSE 'Liability' END,CASE WHEN client_note THEN 'Debit' ELSE 'Credit' END,CASE WHEN client_note THEN 'Customer' ELSE 'Supplier / creator' END);
 IF tax>0 THEN PERFORM tw_accounting_require_account(p_company,vat,'Control',CASE WHEN client_note THEN 'Liability' ELSE 'Asset' END,CASE WHEN client_note THEN 'Credit' ELSE 'Debit' END,CASE WHEN client_note THEN 'Customer' ELSE 'Supplier / creator' END);END IF;
 bn:=round(net*rate,2);bt:=round(tax*rate,2);IF bn<=0 OR tax>0 AND bt<=0 THEN RAISE EXCEPTION 'Amount is below one local-currency cent';END IF;
 j:=coalesce(bridge.journal_id,gen_random_uuid());
 IF bridge.journal_id IS NOT NULL THEN
  SELECT * INTO oldj FROM tw_accounting_journals WHERE id=j FOR UPDATE;
  IF oldj.status<>'pending' OR oldj.control_locked THEN RAISE EXCEPTION 'Original JV must be pending and unlocked';END IF;
  SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=p_company AND (s->>'date')::date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
  IF fiscal IS NULL OR split_part(oldj.voucher_number,'-',2)::integer<>fiscal THEN RAISE EXCEPTION 'Repost in the original open fiscal year to preserve the JV number';END IF;
  DELETE FROM tw_accounting_journal_lines WHERE journal_id=j;
  UPDATE tw_accounting_journals SET entry_date=(s->>'date')::date,reference=s->>'number',memo=raw->>'reason',transaction_currency=s->>'currency',exchange_rate=rate,exchange_rate_date=(s->>'date')::date WHERE id=j;
 ELSE
  INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date)
  VALUES(j,p_company,(s->>'date')::date,s->>'number',raw->>'reason',auth.uid(),'media_'||p_type,s->>'currency',rate,(s->>'date')::date);
 END IF;
 PERFORM set_config('tw.accounting_auxiliaries',CASE WHEN aux IS NULL THEN '{}' ELSE jsonb_build_object(revenue,aux)::text END,true);
 -- Client CN reduces receivable; supplier CN reduces payable. DNs do the reverse.
 IF client_note=credit_note THEN
  PERFORM tw_accounting_auto_line(j,1,revenue,raw->>'reason',bn,0,net,0);
  IF tax>0 THEN PERFORM tw_accounting_auto_line(j,2,vat,'Invoice tax adjustment',bt,0,tax,0,CASE WHEN client_note THEN party END,CASE WHEN NOT client_note THEN party END,partycode);END IF;
  PERFORM tw_accounting_auto_line(j,3,control,s->>'number',0,bn+bt,0,net+tax,CASE WHEN client_note THEN party END,CASE WHEN NOT client_note THEN party END,partycode);
 ELSE
  PERFORM tw_accounting_auto_line(j,1,revenue,raw->>'reason',0,bn,0,net);
  IF tax>0 THEN PERFORM tw_accounting_auto_line(j,2,vat,'Invoice tax adjustment',0,bt,0,tax,CASE WHEN client_note THEN party END,CASE WHEN NOT client_note THEN party END,partycode);END IF;
  PERFORM tw_accounting_auto_line(j,3,control,s->>'number',bn+bt,0,net+tax,0,CASE WHEN client_note THEN party END,CASE WHEN NOT client_note THEN party END,partycode);
 END IF;
 IF bridge.journal_id IS NULL THEN PERFORM tw_accounting_finish_receipt_journal(j);
 ELSE UPDATE tw_accounting_journals SET status='posted',posted_at=now(),posted_by=auth.uid(),version=tw_accounting_journals.version+1 WHERE id=j;END IF;
 PERFORM set_config('tw.accounting_auxiliaries','{}',true);
 UPDATE tw_accounting_media_postings SET journal_id=j,status='posted',snapshot=s,version=tw_accounting_media_postings.version+1 WHERE source_type=p_type AND source_id=p_id;
 PERFORM set_config('tw.media_posting_write',p_id::text,true);
 EXECUTE format('UPDATE %I SET status=''posted'',posted_at=now(),updated_at=now() WHERE id=$1',t) USING p_id;
 PERFORM set_config('tw.media_posting_write','',true);
 RETURN j;
END $$;

CREATE FUNCTION tw_accounting_cost_unpost(p_company uuid,p_id uuid,p_version integer,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_cost_invoices%ROWTYPE;j tw_accounting_journals%ROWTYPE;BEGIN
 IF NOT tw_accounting_can_manage() OR NOT (is_admin() OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR c.version IS DISTINCT FROM p_version OR c.status NOT IN('internal','supplier') THEN RAISE EXCEPTION 'Cost invoice changed. Reload.' USING ERRCODE='40001';END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=c.journal_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tw_accounting_journals x WHERE x.company_id=p_company AND x.reference=c.number AND x.automatic_source='cost_adjustment' AND x.status='posted' AND (x.control_locked OR EXISTS(SELECT 1 FROM tw_accounting_journals r WHERE r.reversal_of=x.id))) THEN RAISE EXCEPTION 'Resolve adjustment locks or reversals before unposting';END IF;
 IF j.status<>'posted' OR j.control_locked OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id) THEN RAISE EXCEPTION 'Resolve locks or reversals before unposting';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements s ON s.id=l.settlement_id WHERE l.cost_id=c.id AND s.status='posted') THEN RAISE EXCEPTION 'Reverse allocated vendor payments before unposting';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'The original posting period is closed';END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter an unposting reason';END IF;
 UPDATE tw_accounting_journals SET status='pending',unposted_by=auth.uid(),unposted_at=now(),unpost_reason=p_reason,version=version+1 WHERE id=j.id;
 UPDATE tw_accounting_journals SET status='pending',unposted_by=auth.uid(),unposted_at=now(),unpost_reason=p_reason,version=version+1 WHERE company_id=p_company AND reference=c.number AND automatic_source='cost_adjustment' AND status='posted';
 UPDATE tw_accounting_cost_invoices SET status='draft',version=version+1 WHERE id=c.id;
 RETURN j.id;
END $$;

CREATE FUNCTION tw_accounting_media_unpost(p_company uuid,p_type text,p_id uuid,p_version integer,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t text;b tw_accounting_media_postings%ROWTYPE;j tw_accounting_journals%ROWTYPE;v integer;BEGIN
 IF NOT tw_accounting_can_manage() OR NOT (is_admin() OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter an unposting reason';END IF;
 IF NOT coalesce((tw_module_access()->>'media')::boolean,false) OR NOT (is_admin() OR has_permission('finance.read') OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Media Finance access required' USING ERRCODE='42501';END IF;
 t:=tw_accounting_media_table(p_type);IF t IS NULL THEN RAISE EXCEPTION 'Unknown document type';END IF;
 EXECUTE format('SELECT 1 FROM %I WHERE id=$1 FOR UPDATE',t) USING p_id;
 IF p_type='client_invoice' THEN RETURN tw_accounting_unpost_invoice(p_id,p_company,p_version,p_reason);END IF;
 IF p_type='internal_cost' THEN IF EXISTS(SELECT 1 FROM tw_accounting_media_postings WHERE cost_id=p_id) THEN RAISE EXCEPTION 'Use the linked Media supplier invoice';END IF;RETURN tw_accounting_cost_unpost(p_company,p_id,p_version,p_reason);END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO b FROM tw_accounting_media_postings WHERE source_type=p_type AND source_id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR b.version IS DISTINCT FROM p_version OR b.status<>'posted' THEN RAISE EXCEPTION 'Posting changed. Reload.' USING ERRCODE='40001';END IF;
 IF p_type='supplier_invoice' THEN
  SELECT version INTO v FROM tw_accounting_cost_invoices WHERE id=b.cost_id;
  PERFORM tw_accounting_cost_unpost(p_company,b.cost_id,v,p_reason);
 ELSE
  SELECT * INTO j FROM tw_accounting_journals WHERE id=b.journal_id FOR UPDATE;
  IF j.status<>'posted' OR j.control_locked OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id) THEN RAISE EXCEPTION 'Resolve locks or reversals before unposting';END IF;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Original posting period is closed';END IF;
  UPDATE tw_accounting_journals SET status='pending',unposted_by=auth.uid(),unposted_at=now(),unpost_reason=p_reason,version=version+1 WHERE id=j.id;
  PERFORM set_config('tw.media_posting_write',p_id::text,true);
  EXECUTE format('UPDATE %I SET status=''pending_repost'',posted_at=NULL,updated_at=now() WHERE id=$1',t) USING p_id;
  PERFORM set_config('tw.media_posting_write','',true);
 END IF;
 UPDATE tw_accounting_media_postings SET status='pending',version=version+1 WHERE source_type=p_type AND source_id=p_id;
 RETURN b.journal_id;
END $$;

-- A source correction never edits a live journal, including direct table writes.
CREATE FUNCTION tw_accounting_guard_media_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text;BEGIN
 kind:=CASE TG_TABLE_NAME WHEN 'creator_supplier_invoices' THEN 'supplier_invoice' WHEN 'client_credit_notes' THEN 'client_credit_note' WHEN 'vendor_credit_notes' THEN 'vendor_credit_note' WHEN 'client_debit_notes' THEN 'client_debit_note' ELSE 'vendor_debit_note' END;
 IF EXISTS(SELECT 1 FROM tw_accounting_media_postings WHERE source_type=kind AND source_id=OLD.id AND status='posted') AND coalesce(current_setting('tw.media_posting_write',true),'')<>OLD.id::text THEN RAISE EXCEPTION 'Unpost this document from TW Accounting before editing or cancelling it';END IF;
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM tw_accounting_media_postings WHERE source_type=kind AND source_id=OLD.id) THEN RAISE EXCEPTION 'Accounting-linked documents cannot be deleted';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['creator_supplier_invoices','client_credit_notes','vendor_credit_notes','client_debit_notes','vendor_debit_notes'] LOOP
  EXECUTE format('CREATE TRIGGER tw_accounting_media_source BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tw_accounting_guard_media_source()',t);
 END LOOP;
END $$;

-- Corrected supplier/internal invoices retain both their cost document number
-- and their original JV, rebuilding only after a guarded pending transition.
DO $patch$ DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_cost_post(uuid,uuid,integer,numeric)'::regprocedure) INTO body;
 needle:='c.number:=tw_accounting_number(p_company,CASE WHEN c.supplier_number IS NULL THEN ''IC'' ELSE ''CI'' END,c.document_date);';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost numbering; stop';END IF;
 body:=replace(body,needle,'c.number:=coalesce(c.number,tw_accounting_number(p_company,CASE WHEN c.supplier_number IS NULL THEN ''IC'' ELSE ''CI'' END,c.document_date));');
 needle:='INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date)';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost journal creation; stop';END IF;
 body:=replace(body,needle,'IF c.journal_id IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals x JOIN tw_accounting_years y ON y.company_id=x.company_id JOIN tw_accounting_periods p ON p.year_id=y.id WHERE x.id=c.journal_id AND x.status=''pending'' AND NOT x.control_locked AND c.document_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed AND split_part(x.voucher_number,''-'',2)::integer=extract(year FROM y.start_date)::integer) THEN RAISE EXCEPTION ''Original JV must be pending in the same open fiscal year'';END IF;
 j:=c.journal_id;DELETE FROM tw_accounting_accrual_clearings WHERE cost_id=c.id AND journal_id=j;DELETE FROM tw_accounting_journal_lines WHERE journal_id=j;
 UPDATE tw_accounting_journals SET entry_date=c.document_date,memo=c.description,transaction_currency=c.currency,exchange_rate=rate,exchange_rate_date=c.document_date WHERE id=j;
 ELSE '||needle);
 needle:='PERFORM tw_accounting_auto_line(j,1,c.expense_account,c.description,bn,0,c.net,0);';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost line creation; stop';END IF;
 body:=replace(body,needle,'END IF; '||needle);
 needle:='PERFORM tw_accounting_finish_receipt_journal(j);';
 body:=replace(body,needle,'IF c.journal_id IS NULL THEN '||needle||' ELSE UPDATE tw_accounting_journals SET status=''posted'',posted_by=auth.uid(),posted_at=now(),version=version+1 WHERE id=j;END IF;');
 EXECUTE body;
END $patch$;
REVOKE ALL ON FUNCTION tw_accounting_media_table(text),tw_accounting_media_source(uuid,text,uuid),tw_accounting_media_queue(uuid,text,date,date,boolean,integer),tw_accounting_media_mapping(uuid,text),tw_accounting_media_post(uuid,text,uuid,text),tw_accounting_media_unpost(uuid,text,uuid,integer,text),tw_accounting_cost_unpost(uuid,uuid,integer,text),tw_accounting_guard_media_source() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_media_source(uuid,text,uuid),tw_accounting_media_queue(uuid,text,date,date,boolean,integer),tw_accounting_media_post(uuid,text,uuid,text),tw_accounting_media_unpost(uuid,text,uuid,integer,text) TO authenticated;
-- Credit/debit notes remain individually identifiable in aging. They are not
-- silently marked as cash settlements of the original invoice.
DO $aging$ DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_aging(uuid,text,text,uuid)'::regprocedure) INTO body;
 needle:='RETURN result;';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected aging definition; stop';END IF;
 EXECUTE replace(body,needle,$append$
 result:=result||coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.source_id,'number',b.snapshot->>'number','date',b.snapshot->>'date','due',NULL,'currency',b.snapshot->>'currency','account',l.account_code,'party',b.snapshot->>'code','partyName',b.snapshot->>'party','total',((b.snapshot->>'total')::numeric*CASE WHEN b.source_type LIKE '%credit_note' THEN -1 ELSE 1 END)::text,'settled','0','outstanding',((b.snapshot->>'total')::numeric*CASE WHEN b.source_type LIKE '%credit_note' THEN -1 ELSE 1 END)::text,'status','Unallocated note')) FROM tw_accounting_media_postings b JOIN tw_accounting_journals j ON j.id=b.journal_id JOIN tw_accounting_journal_lines l ON l.journal_id=j.id AND l.line_number=3 WHERE b.company_id=p_company AND b.status='posted' AND j.status='posted' AND b.source_type LIKE CASE WHEN p_kind='client' THEN 'client_%note' ELSE 'vendor_%note' END AND b.snapshot->>'currency'=p_currency AND (p_party IS NULL OR coalesce(l.client_id,l.vendor_id)=p_party)),'[]');
 RETURN result;$append$);
END $aging$;
DO $cost_source$ DECLARE signature text;body text;id_expr text;needle text;BEGIN
 FOREACH signature IN ARRAY ARRAY['tw_accounting_cost_save(jsonb)','tw_accounting_cost_post(uuid,uuid,integer,numeric)','tw_accounting_cost_reconcile(uuid,uuid,integer,date,text,date,numeric,numeric,text,text)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO body;
  id_expr:=CASE WHEN signature LIKE 'tw_accounting_cost_save%' THEN '(p_value->>''id'')::uuid' ELSE 'p_id' END;
  needle:='IF NOT tw_accounting_can_manage() THEN';
  IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost permission guard; stop';END IF;
  EXECUTE replace(body,needle,'IF EXISTS(SELECT 1 FROM tw_accounting_media_postings b WHERE b.cost_id='||id_expr||' AND coalesce(current_setting(''tw.media_posting_write'',true),'''')<>b.source_id::text) THEN RAISE EXCEPTION ''Use the linked Media supplier invoice for corrections'';END IF; '||needle);
 END LOOP;
END $cost_source$;
NOTIFY pgrst,'reload schema';
COMMIT;
