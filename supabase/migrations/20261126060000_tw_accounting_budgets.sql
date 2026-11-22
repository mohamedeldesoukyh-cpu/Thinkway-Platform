BEGIN;
CREATE TABLE tw_accounting_budgets(
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),period_id uuid NOT NULL REFERENCES tw_accounting_periods(id),account_code text NOT NULL,
 amount numeric(18,2) NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid NOT NULL REFERENCES profiles(id),
 PRIMARY KEY(company_id,period_id,account_code),FOREIGN KEY(company_id,account_code) REFERENCES tw_accounting_accounts(company_id,code));
ALTER TABLE tw_accounting_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_budgets FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_budgets TO authenticated;
CREATE POLICY accounting_read ON tw_accounting_budgets FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE ON tw_accounting_budgets FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
CREATE FUNCTION tw_accounting_budget_save(p_company uuid,p_year uuid,p_account text,p_lines jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb;v integer;old_amount numeric;locked boolean;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE id=p_year AND company_id=p_company) OR NOT EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account AND active AND kind<>'Group' AND account_type IN('Revenue','Expense')) THEN RAISE EXCEPTION 'Choose a fiscal year and active income or expense account';END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)<>12 OR (SELECT count(DISTINCT value->>'period') FROM jsonb_array_elements(p_lines))<>12 THEN RAISE EXCEPTION 'Provide all twelve monthly allocations once';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods WHERE id=(item->>'period')::uuid AND year_id=p_year) THEN RAISE EXCEPTION 'Budget changes require open periods in the selected year';END IF;
  IF coalesce(item->>'amount','') !~ '^-?[0-9]{1,12}(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Enter valid budget amounts';END IF;
  SELECT version,amount INTO v,old_amount FROM tw_accounting_budgets WHERE company_id=p_company AND period_id=(item->>'period')::uuid AND account_code=p_account;
  IF v IS DISTINCT FROM (item->>'version')::integer THEN RAISE EXCEPTION 'Budget changed; reload before saving' USING ERRCODE='40001';END IF;
  SELECT is_closed INTO locked FROM tw_accounting_periods WHERE id=(item->>'period')::uuid;
  IF locked THEN IF coalesce(old_amount,0)<>(item->>'amount')::numeric THEN RAISE EXCEPTION 'Closed-period budget cannot change';END IF;CONTINUE;END IF;
  INSERT INTO tw_accounting_budgets(company_id,period_id,account_code,amount,updated_by) VALUES(p_company,(item->>'period')::uuid,p_account,(item->>'amount')::numeric,auth.uid())
  ON CONFLICT(company_id,period_id,account_code) DO UPDATE SET amount=excluded.amount,version=tw_accounting_budgets.version+1,updated_at=now(),updated_by=auth.uid();
 END LOOP;
END $$;
CREATE FUNCTION tw_accounting_budget_report(p_company uuid,p_year uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 WITH actual AS(SELECT l.account_code,p.id period_id,sum(CASE WHEN a.account_type='Revenue' THEN l.credit-l.debit ELSE l.debit-l.credit END) amount
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
 JOIN tw_accounting_periods p ON j.entry_date BETWEEN p.start_date AND p.end_date JOIN tw_accounting_years y ON y.id=p.year_id AND y.company_id=j.company_id
 WHERE j.company_id=p_company AND y.id=p_year AND j.status='posted' AND coalesce(j.automatic_source,'') NOT IN('fiscal_close','fiscal_reopen') GROUP BY l.account_code,p.id)
 SELECT coalesce(jsonb_agg(x ORDER BY x.code,x.date),'[]') INTO result FROM(
 SELECT a.code,a.name,a.account_type type,p.id period,p.start_date date,b.amount::text budget,b.version,coalesce(v.amount,0)::text actual
 FROM tw_accounting_accounts a CROSS JOIN tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id
 LEFT JOIN tw_accounting_budgets b ON b.company_id=p_company AND b.period_id=p.id AND b.account_code=a.code LEFT JOIN actual v ON v.period_id=p.id AND v.account_code=a.code
 WHERE a.company_id=p_company AND y.company_id=p_company AND y.id=p_year AND a.kind<>'Group' AND a.account_type IN('Revenue','Expense'))x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_budget_save(uuid,uuid,text,jsonb),tw_accounting_budget_report(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tw_accounting_budget_save(uuid,uuid,text,jsonb),tw_accounting_budget_report(uuid,uuid) TO authenticated;
COMMIT;
