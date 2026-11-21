BEGIN;
CREATE TABLE tw_accounting_mapping_definitions(key text PRIMARY KEY,section text NOT NULL,media_label text NOT NULL,posting_use text NOT NULL,account_type text NOT NULL,normal_balance text NOT NULL,kind text NOT NULL,subledger text,default_account text NOT NULL);
INSERT INTO tw_accounting_mapping_definitions VALUES
('assignment_revenue','Revenue','Assignment Revenue','Invoice posting','Revenue','Credit','Posting',NULL,'411001'),
('agency_fee','Revenue','AF · Agency fees','Invoice posting','Revenue','Credit','Posting',NULL,'414001'),
('usage_rights_revenue','Revenue','UR Revenue · Usage rights','Invoice posting','Revenue','Credit','Posting',NULL,'411001'),
('assignment_cost','Costs','Assignment Cost','Approved cost invoice','Expense','Debit','Posting',NULL,'511001'),
('usage_rights_cost','Costs','UR Cost · Usage rights','Approved cost invoice','Expense','Debit','Posting',NULL,'511001'),
('revenue_share','Costs','Revenue Share','Approved cost invoice','Expense','Debit','Posting',NULL,'511001'),
('vr_refund','Adjustments','VR / client rebate','Adjustment journal; no automatic recognition yet','Revenue','Debit','Posting',NULL,'421001'),
('client_receivable','Clients and vendors','Client receivable','Invoice / receipt; linked client account takes priority','Asset','Debit','Control','Customer','121001'),
('vendor_payable','Clients and vendors','Vendor payable','Cost invoice / payment; linked vendor account takes priority','Liability','Credit','Control','Supplier / creator','211001'),
('customer_advance','Clients and vendors','Customer advances','Unallocated receipt / later allocation','Liability','Credit','Control','Customer','221001'),
('vendor_advance','Clients and vendors','Vendor advances','Unallocated payment / later allocation','Asset','Debit','Control','Supplier / creator','131001'),
('cash_bank','Collections and payments','Cash / bank','Receipt / payment default; choose actual bank when entering','Asset','Debit','Posting',NULL,'112001'),
('output_vat','VAT and withholding','VAT payable · Output VAT','Client invoice posting','Liability','Credit','Posting',NULL,'231001'),
('input_vat','VAT and withholding','VAT receivable · Input VAT','Approved supplier invoice with reviewed tax','Asset','Debit','Posting',NULL,'141001'),
('customer_withholding','VAT and withholding','Customer withholding tax receivable','Adjustment journal; dedicated tax settlement pending','Asset','Debit','Control','Customer','142001'),
('vendor_withholding','VAT and withholding','Vendor withholding tax payable','Adjustment journal; dedicated tax settlement pending','Liability','Credit','Control','Supplier / creator','232001'),
('fx_gain','Exchange differences','Realized FX Gain','Receipt / payment / advance allocation','Revenue','Credit','Posting',NULL,'712001'),
('fx_loss','Exchange differences','Realized FX Loss','Receipt / payment / advance allocation','Expense','Debit','Posting',NULL,'722001'),
('unrealized_fx_gain','Exchange differences','Unrealized FX Gain','Period-end revaluation; not automatic yet','Revenue','Credit','Posting',NULL,'713001'),
('unrealized_fx_loss','Exchange differences','Unrealized FX Loss','Period-end revaluation; not automatic yet','Expense','Debit','Posting',NULL,'723001'),
('unbilled_revenue','Accruals','Unbilled revenue / contract asset','Accrual / closing journal; not automatic yet','Asset','Debit','Control','Customer','122001'),
('accrued_cost','Accruals','Accrued campaign cost','Accrual / closing journal; not automatic yet','Liability','Credit','Posting',NULL,'212001');
CREATE TABLE tw_accounting_mappings(company_id uuid REFERENCES tw_accounting_companies(id),key text REFERENCES tw_accounting_mapping_definitions(key),account_code text NOT NULL,auxiliary_id uuid REFERENCES tw_accounting_auxiliaries(id),version integer NOT NULL DEFAULT 1,PRIMARY KEY(company_id,key),FOREIGN KEY(company_id,account_code) REFERENCES tw_accounting_accounts(company_id,code));
ALTER TABLE tw_accounting_mapping_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tw_accounting_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_mapping_definitions,tw_accounting_mappings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_mapping_definitions,tw_accounting_mappings TO authenticated;
CREATE POLICY accounting_read ON tw_accounting_mapping_definitions FOR SELECT TO authenticated USING ((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE POLICY accounting_read ON tw_accounting_mappings FOR SELECT TO authenticated USING ((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON tw_accounting_mappings FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
CREATE FUNCTION tw_accounting_mappings_read(p_company uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY section,media_label),'[]') FROM (
 SELECT d.*,a.code account,a.name account_name,coalesce(a.active,false) active,m.auxiliary_id,coalesce(m.version,0) version,m.key IS NOT NULL customized FROM tw_accounting_mapping_definitions d LEFT JOIN tw_accounting_mappings m ON m.key=d.key AND m.company_id=p_company LEFT JOIN tw_accounting_accounts a ON a.company_id=p_company AND a.code=coalesce(m.account_code,d.default_account)
 )x;
$$;
CREATE FUNCTION tw_accounting_mapping_save(p_company uuid,p_key text,p_account text,p_auxiliary uuid,p_version integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d tw_accounting_mapping_definitions%ROWTYPE;a tw_accounting_accounts%ROWTYPE;v integer;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO d FROM tw_accounting_mapping_definitions WHERE key=p_key;IF NOT FOUND THEN RAISE EXCEPTION 'Unknown mapping'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR (a.account_type,a.normal_balance,a.kind) IS DISTINCT FROM (d.account_type,d.normal_balance,d.kind) OR a.subledger IS DISTINCT FROM d.subledger THEN RAISE EXCEPTION 'Choose an active account matching this mapping type and balance'; END IF;
 IF a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL THEN RAISE EXCEPTION 'Use a general default account here; client/vendor-specific accounts are selected by their direct link'; END IF;
 IF a.has_auxiliary AND NOT EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE id=p_auxiliary AND company_id=p_company AND account_code=p_account AND active) OR NOT a.has_auxiliary AND p_auxiliary IS NOT NULL THEN RAISE EXCEPTION 'Choose a valid auxiliary for the mapped account'; END IF;
 SELECT version INTO v FROM tw_accounting_mappings WHERE company_id=p_company AND key=p_key;
 IF coalesce(v,0) IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Mapping changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO tw_accounting_mappings VALUES(p_company,p_key,p_account,p_auxiliary,1) ON CONFLICT(company_id,key) DO UPDATE SET account_code=excluded.account_code,auxiliary_id=excluded.auxiliary_id,version=tw_accounting_mappings.version+1;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_mappings_read(uuid),tw_accounting_mapping_save(uuid,text,text,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_mappings_read(uuid),tw_accounting_mapping_save(uuid,text,text,uuid,integer) TO authenticated;
COMMIT;
