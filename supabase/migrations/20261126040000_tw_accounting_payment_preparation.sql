BEGIN;
CREATE TABLE tw_accounting_payment_preparations(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),value jsonb NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','posted','cancelled')),version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tw_accounting_payment_preparations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_payment_preparations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_payment_preparations TO authenticated;
CREATE POLICY accounting_read ON tw_accounting_payment_preparations FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER payment_preparation_audit AFTER INSERT OR UPDATE ON tw_accounting_payment_preparations FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
CREATE FUNCTION tw_accounting_payment_prepare(p_company uuid,p_action text,p_id uuid,p_version integer,p_value jsonb DEFAULT NULL,p_expected jsonb DEFAULT NULL,p_reason text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p tw_accounting_payment_preparations%ROWTYPE;result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO p FROM tw_accounting_payment_preparations WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF p.company_id<>p_company THEN RAISE EXCEPTION 'Preparation unavailable'; END IF;
  IF p_action='post' AND p.status='posted' AND p.value=p_value THEN RETURN p.id; END IF;
  IF p.status<>'draft' THEN RAISE EXCEPTION 'Only draft preparations can change'; END IF;
  IF p.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Preparation changed. Reload.' USING ERRCODE='40001'; END IF;
 ELSIF p_version IS NOT NULL OR p_action='cancel' THEN RAISE EXCEPTION 'Preparation unavailable'; END IF;
 IF p_action='cancel' THEN
  IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a cancellation reason'; END IF;
  UPDATE tw_accounting_payment_preparations SET status='cancelled',version=version+1 WHERE id=p_id;
  INSERT INTO tw_accounting_audit(actor_id,table_name,operation,after_data) VALUES(auth.uid(),'tw_accounting_payment_preparations','CANCEL_PREPARATION',jsonb_build_object('company_id',p_company,'id',p_id,'reason',trim(p_reason)));
  RETURN p_id;
 END IF;
 IF p_action NOT IN('save','post') OR p_action IS NULL OR (p_value->>'company')::uuid IS DISTINCT FROM p_company OR p_value->>'kind' IS DISTINCT FROM 'payment' OR nullif(p_value->>'parent','') IS NOT NULL THEN RAISE EXCEPTION 'Prepare an ordinary vendor payment'; END IF;
 -- Validate the current open items and rates without reserving invoices or numbers.
 PERFORM tw_accounting_settlement_quote(p_value);
 IF p.id IS NULL THEN INSERT INTO tw_accounting_payment_preparations(id,company_id,value,created_by) VALUES(p_id,p_company,p_value,auth.uid());
 ELSE UPDATE tw_accounting_payment_preparations SET value=p_value,version=version+1 WHERE id=p_id; END IF;
 IF p_action='post' THEN
  result:=tw_accounting_post_with_aux('settlement',p_value,'{}',p_id,p_expected);
  UPDATE tw_accounting_payment_preparations SET status='posted',version=version+1 WHERE id=p_id;
 END IF;
 RETURN p_id;
END $$;
CREATE FUNCTION tw_accounting_cheques(p_company uuid,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE rows jsonb;n integer;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_offset<0 OR p_offset>10000000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
 SELECT count(*) INTO n FROM tw_accounting_voucher_register WHERE company_id=p_company AND kind='payment' AND request->'value'->>'method'='check';
 SELECT coalesce(jsonb_agg(x),'[]') INTO rows FROM(
  SELECT v.id,v.number,v.date,v.party_code,v.party_name,v.amount::text,v.currency,v.status,v.voucher_number,v.request->'value'->>'reference' reference,
   (SELECT max(br.entry_date) FROM tw_accounting_settlements st JOIN tw_accounting_journal_lines l ON l.journal_id=st.journal_id AND l.account_code=st.cash_account JOIN tw_accounting_bank_match_lines ml ON ml.journal_id=l.journal_id AND ml.line_number=l.line_number JOIN tw_accounting_bank_rows br ON br.match_id=ml.match_id WHERE st.id=v.id) cleared_date
  FROM tw_accounting_voucher_register v WHERE v.company_id=p_company AND v.kind='payment' AND v.request->'value'->>'method'='check' ORDER BY v.date DESC,v.id LIMIT 50 OFFSET p_offset
 )x;RETURN jsonb_build_object('rows',rows,'count',n);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_payment_prepare(uuid,text,uuid,integer,jsonb,jsonb,text),tw_accounting_cheques(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_payment_prepare(uuid,text,uuid,integer,jsonb,jsonb,text),tw_accounting_cheques(uuid,integer) TO authenticated;
COMMIT;
