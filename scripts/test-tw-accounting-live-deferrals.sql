-- Run ONLY with scripts/psql-development.mjs. Every fixture and serial rolls back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid;company uuid;client uuid;vendor uuid;h campaign_headers%ROWTYPE;l campaign_lines%ROWTYPE;
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();source uuid:=gen_random_uuid();j uuid;release uuid;items jsonb;blocked boolean;before_source jsonb;chart jsonb;
BEGIN
 SELECT p.id INTO STRICT actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SELECT jsonb_agg(jsonb_build_object('code',code,'name',name,'parent',parent_code,'type',account_type,'normal',normal_balance,'kind',kind,'subledger',subledger)) INTO chart FROM tw_accounting_accounts WHERE company_id=(SELECT company_id FROM tw_accounting_accounts WHERE code='221001' LIMIT 1) AND NOT auto_party_account;
 company:=tw_accounting_create_company('QA rollback live deferrals','EG','EGP','2026-01-01',chart);
 SELECT * INTO STRICT l FROM campaign_lines LIMIT 1;
 SELECT * INTO STRICT h FROM campaign_headers WHERE id=l.campaign_header_id;
 client:=h.client_id;
 SELECT id INTO STRICT vendor FROM influencers WHERE tw_accounting_eligible_vendor(id) LIMIT 1;
 h.id:=gen_random_uuid();h.document_number:='QA-DEFER-'||h.id;h.name:='Isolated deferral fixture';h.slug:='qa-defer-'||h.id;
 INSERT INTO campaign_headers(id,document_number,name,client_id,currency_code,status,brand_id,group_id,team_id,report_type_id,agency_or_direct) VALUES(h.id,h.document_number,h.name,h.client_id,h.currency_code,h.status,h.brand_id,h.group_id,h.team_id,h.report_type_id,h.agency_or_direct);
 l.id:=a;l.campaign_header_id:=h.id;l.document_number:='QA-LIVE-A-'||a;l.name:='QA creator A';l.metadata:='{}';l.invoice_id:=NULL;l.vendor_io_id:=NULL;l.status:='draft';l.billing_status:='draft';l.assignment_status:='draft';l.operational_status:='draft';l.vendor_assignment_locked:=false;l.revenue_locked:=false;l.cost_locked:=false;
 INSERT INTO campaign_lines SELECT l.*;
 l.id:=b;l.document_number:='QA-LIVE-B-'||b;l.name:='QA creator B';INSERT INTO campaign_lines SELECT l.*;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,automatic_source,created_by,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(source,company,'2026-11-01','QA-SOURCE','Isolated invoice and cost fixture','qa_fixture',actor,'EGP',1,'2026-11-01');
 PERFORM tw_accounting_auto_line(source,1,'121001','Receivable',1340,0,1340,0,client,NULL,NULL);
 PERFORM tw_accounting_auto_line(source,2,'411001','QA-LIVE-A-'||a||' revenue',0,1000,0,1000,client,NULL,NULL);
 PERFORM tw_accounting_auto_line(source,3,'231001','Output VAT unchanged',0,140,0,140,client,NULL,NULL);
 PERFORM tw_accounting_auto_line(source,4,'511001','QA-LIVE-A-'||a||' cost',600,0,600,0,NULL,vendor,NULL);
 PERFORM tw_accounting_auto_line(source,5,'141001','Input VAT unchanged',84,0,84,0,NULL,vendor,NULL);
 PERFORM tw_accounting_auto_line(source,6,'211001','Payable unchanged',0,684,0,684,NULL,vendor,NULL);
 PERFORM tw_accounting_auto_line(source,7,'411001','QA-LIVE-B-'||b||' revenue',0,200,0,200,client,NULL,NULL);
 PERFORM tw_accounting_finish_receipt_journal(source);
 SELECT jsonb_agg(to_jsonb(x) ORDER BY line_number) INTO before_source FROM tw_accounting_journal_lines x WHERE journal_id=source;
 items:=jsonb_build_array(jsonb_build_object('assignment',a,'sources',jsonb_build_array(source||':2')),jsonb_build_object('assignment',a,'sources',jsonb_build_array(source||':4')),jsonb_build_object('assignment',b,'sources',jsonb_build_array(source||':7')));
 j:=tw_accounting_defer_campaign_lines(company,'2026-11-02','QA-DEFER',items);
 IF j IS DISTINCT FROM tw_accounting_defer_campaign_lines(company,'2026-11-02','QA-DEFER',items) THEN RAISE EXCEPTION 'Batch retry was not idempotent';END IF;
 IF (SELECT count(*) FROM tw_accounting_journal_lines WHERE journal_id=j)<>6 OR (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j)<>0 THEN RAISE EXCEPTION 'One combined balanced JV expected';END IF;
 IF (SELECT sum(credit-debit) FROM tw_accounting_journal_lines WHERE journal_id=j AND account_code='221001')<>1200 OR (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j AND account_code='133001')<>600 THEN RAISE EXCEPTION 'Revenue/cost classification mismatch';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_defer_campaign_lines(company,'2026-11-02','QA-DUPLICATE',items);EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%already deferred%';END;IF NOT blocked THEN RAISE EXCEPTION 'Duplicate source accepted';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_defer_campaign_lines(company,'2026-11-02','QA-TAX',jsonb_build_array(jsonb_build_object('assignment',a,'sources',jsonb_build_array(source||':3'))));EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%VAT and settlement%';END;IF NOT blocked THEN RAISE EXCEPTION 'VAT accepted';END IF;
 blocked:=false;BEGIN UPDATE campaign_lines SET metadata=jsonb_build_object('went_live',true,'went_live_date','2099-01-01') WHERE id=a;EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%future date%';END;IF NOT blocked THEN RAISE EXCEPTION 'Future recognition accepted';END IF;
 UPDATE campaign_lines SET metadata=jsonb_build_object('went_live',true,'went_live_date','2026-11-05') WHERE id=a;
 SELECT DISTINCT release_journal_id INTO STRICT release FROM tw_accounting_live_deferrals WHERE assignment_id=a;
 IF (SELECT count(*) FROM tw_accounting_journal_lines WHERE journal_id=release)<>4 OR (SELECT entry_date FROM tw_accounting_journals WHERE id=release)<>'2026-11-05' THEN RAISE EXCEPTION 'Incorrect partial release';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_live_deferrals WHERE assignment_id=b AND release_journal_id IS NOT NULL) THEN RAISE EXCEPTION 'Unrelated assignment released';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id IN(j,release) GROUP BY account_code HAVING account_code IN('141001','231001','121001','211001')) THEN RAISE EXCEPTION 'VAT or settlement affected';END IF;
 UPDATE campaign_lines SET metadata=metadata||'{"qa_note":"unchanged live status"}' WHERE id=a;
 IF (SELECT count(*) FROM tw_accounting_journals WHERE company_id=company AND automatic_source='campaign_deferral_release')<>1 THEN RAISE EXCEPTION 'Duplicate release';END IF;
 blocked:=false;BEGIN UPDATE campaign_lines SET metadata=metadata||'{"went_live":false}' WHERE id=a;EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%review the linked JVs%';END;IF NOT blocked THEN RAISE EXCEPTION 'Posted recognition silently undone';END IF;
 IF before_source IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY line_number) FROM tw_accounting_journal_lines x WHERE journal_id=source) THEN RAISE EXCEPTION 'Source invoice changed';END IF;
 IF has_function_privilege('authenticated','tw_accounting_release_live_deferral()','EXECUTE') THEN RAISE EXCEPTION 'Internal release exposed';END IF;
 RAISE NOTICE 'PASS: combined revenue/cost JV, unchanged VAT/settlements, partial live-date release, idempotency, duplicate and future guards, immutable source, restricted release';
END $$;
ROLLBACK;
