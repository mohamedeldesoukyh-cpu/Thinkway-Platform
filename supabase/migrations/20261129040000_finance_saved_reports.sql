BEGIN;
CREATE TABLE public.tw_finance_saved_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 year_id uuid REFERENCES tw_accounting_years(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 plan jsonb NOT NULL CHECK(plan->>'action'='custom_ledger' AND octet_length(plan::text)<10000),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tw_finance_saved_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_finance_saved_reports FROM PUBLIC,anon,service_role;
GRANT SELECT,INSERT,DELETE ON tw_finance_saved_reports TO authenticated;
CREATE POLICY own_accounting_reports ON tw_finance_saved_reports TO authenticated
 USING(owner_id=auth.uid() AND coalesce((tw_module_access()->>'accounting')::boolean,false))
 WITH CHECK(owner_id=auth.uid() AND coalesce((tw_module_access()->>'accounting')::boolean,false)
 AND (year_id IS NULL OR EXISTS(SELECT 1 FROM tw_accounting_years y WHERE y.id=year_id AND y.company_id=tw_finance_saved_reports.company_id)));
COMMIT;
