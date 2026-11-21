BEGIN;

CREATE TABLE public.tw_module_assignments (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  media boolean NOT NULL DEFAULT true,
  accounting_role text NOT NULL DEFAULT 'none' CHECK (accounting_role IN ('none','read','manage')),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.tw_module_assignments ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.tw_module_access() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce((SELECT CASE
    WHEN NOT p.is_active OR EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id)
      OR EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) THEN '{"media":false,"accounting":false,"manage":false,"admin":false}'::jsonb
    WHEN r.slug IN ('admin','super_admin') THEN '{"media":true,"accounting":true,"manage":true,"admin":true}'::jsonb
    ELSE jsonb_build_object('media',coalesce(m.media,true),
      'accounting',coalesce(m.accounting_role,CASE WHEN r.slug='finance' THEN 'manage' ELSE 'none' END)<>'none',
      'manage',coalesce(m.accounting_role,CASE WHEN r.slug='finance' THEN 'manage' ELSE 'none' END)='manage','admin',false)
    END FROM profiles p JOIN roles r ON r.id=p.role_id LEFT JOIN tw_module_assignments m ON m.profile_id=p.id WHERE p.id=auth.uid()),
    '{"media":false,"accounting":false,"manage":false,"admin":false}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.tw_module_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tw_module_access() TO authenticated;

CREATE FUNCTION public.tw_accounting_can_manage() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((tw_module_access()->>'manage')::boolean,false) AND coalesce(auth.jwt()->>'aal','')='aal2';
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_can_manage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tw_accounting_can_manage() TO authenticated;

CREATE POLICY tw_modules_read ON public.tw_module_assignments FOR SELECT TO authenticated
  USING(profile_id=auth.uid() OR (public.tw_module_access()->>'admin')::boolean);
CREATE POLICY tw_modules_write ON public.tw_module_assignments FOR ALL TO authenticated
  USING((public.tw_module_access()->>'admin')::boolean)
  WITH CHECK((public.tw_module_access()->>'admin')::boolean);

CREATE TABLE public.tw_accounting_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150),
  country_code text NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
  base_currency text NOT NULL CHECK(base_currency ~ '^[A-Z]{3}$'),
  currencies text[] NOT NULL,
  fiscal_start_month integer NOT NULL CHECK(fiscal_start_month BETWEEN 1 AND 12),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  CHECK(base_currency=ANY(currencies)),
  CHECK(cardinality(currencies) BETWEEN 1 AND 30)
);
CREATE UNIQUE INDEX tw_company_name_unique ON public.tw_accounting_companies(lower(trim(name)));

CREATE TABLE public.tw_accounting_accounts (
  company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK(code ~ '^[0-9]{6}$'),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150),
  name_ar text NOT NULL DEFAULT '' CHECK(length(name_ar)<=150),
  parent_code text,
  account_type text NOT NULL CHECK(account_type IN ('Asset','Liability','Equity','Revenue','Expense')),
  normal_balance text NOT NULL CHECK(normal_balance IN ('Debit','Credit')),
  kind text NOT NULL CHECK(kind IN ('Group','Posting','Control','System')),
  subledger text CHECK(subledger IN ('Customer','Supplier / creator','Employee')),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,code),
  FOREIGN KEY(company_id,parent_code) REFERENCES public.tw_accounting_accounts(company_id,code) DEFERRABLE INITIALLY DEFERRED,
  CHECK((kind='Control')=(subledger IS NOT NULL)),
  CHECK(parent_code IS DISTINCT FROM code)
);

CREATE TABLE public.tw_accounting_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  UNIQUE(company_id,start_date),
  CHECK(end_date=(start_date+interval '1 year'-interval '1 day')::date),
  CHECK(extract(day FROM start_date)=1)
);
CREATE TABLE public.tw_accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES public.tw_accounting_years(id),
  period_number integer NOT NULL CHECK(period_number BETWEEN 1 AND 12),
  start_date date NOT NULL,
  end_date date NOT NULL,
  UNIQUE(year_id,period_number),
  CHECK(end_date>=start_date)
);
CREATE TABLE public.tw_accounting_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id),
  table_name text NOT NULL,
  operation text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.tw_accounting_audit_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data)
  VALUES(auth.uid(),TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,to_jsonb(NEW));
  RETURN NEW;
END; $$;

CREATE FUNCTION public.tw_accounting_validate_account() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.kind='System' AND current_user='authenticated' THEN RAISE EXCEPTION 'System accounts are reserved for the accounting engine'; END IF;
  -- Serialize structural edits within a company to prevent concurrent cycles.
  PERFORM 1 FROM tw_accounting_companies WHERE id=NEW.company_id FOR UPDATE;
  IF TG_OP='UPDATE' THEN
    IF NEW.company_id<>OLD.company_id OR NEW.code<>OLD.code THEN RAISE EXCEPTION 'Company and account code cannot be changed'; END IF;
    IF OLD.kind='System' AND (NEW.kind<>OLD.kind OR NEW.account_type<>OLD.account_type OR NEW.normal_balance<>OLD.normal_balance OR NOT NEW.active) THEN RAISE EXCEPTION 'System account structure is protected'; END IF;
    IF EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND parent_code=NEW.code)
      AND (NEW.kind<>'Group' OR NOT NEW.active) THEN RAISE EXCEPTION 'A group with children must remain an active group'; END IF;
    NEW.version:=OLD.version+1; NEW.updated_at:=now();
  END IF;
  IF NEW.parent_code IS NULL AND NEW.kind<>'Group' THEN RAISE EXCEPTION 'Detail accounts require a parent group'; END IF;
  IF NEW.parent_code IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.parent_code AND kind='Group' AND active) THEN RAISE EXCEPTION 'Parent must be an active group in this company'; END IF;
    IF EXISTS(WITH RECURSIVE ancestors AS (
      SELECT code,parent_code FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.parent_code
      UNION SELECT a.code,a.parent_code FROM tw_accounting_accounts a JOIN ancestors b ON a.code=b.parent_code WHERE a.company_id=NEW.company_id)
      SELECT 1 FROM ancestors WHERE code=NEW.code) THEN RAISE EXCEPTION 'Account hierarchy cannot contain cycles'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tw_account_validate BEFORE INSERT OR UPDATE ON public.tw_accounting_accounts FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_validate_account();

CREATE FUNCTION public.tw_accounting_validate_company() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM unnest(NEW.currencies) c WHERE c !~ '^[A-Z]{3}$') THEN RAISE EXCEPTION 'Invalid currency code'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.id<>OLD.id OR NEW.base_currency<>OLD.base_currency OR NEW.fiscal_start_month<>OLD.fiscal_start_month THEN
      RAISE EXCEPTION 'Base currency and fiscal start month are fixed after company creation'; END IF;
    NEW.version:=OLD.version+1; NEW.updated_at:=now();
  ELSE NEW.created_by:=auth.uid(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tw_company_validate BEFORE INSERT OR UPDATE ON public.tw_accounting_companies FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_validate_company();

CREATE FUNCTION public.tw_module_validate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (tw_module_access()->>'admin')::boolean OR NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF NEW.profile_id=auth.uid() OR EXISTS(SELECT 1 FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.id=NEW.profile_id AND r.slug IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Administrator access cannot be removed here'; END IF;
  IF EXISTS(SELECT 1 FROM client_users WHERE profile_id=NEW.profile_id) OR EXISTS(SELECT 1 FROM influencers WHERE profile_id=NEW.profile_id) THEN RAISE EXCEPTION 'Portal users cannot be assigned internal modules'; END IF;
  NEW.updated_by:=auth.uid(); NEW.updated_at:=now();
  IF TG_OP='UPDATE' THEN
    IF NEW.profile_id<>OLD.profile_id THEN RAISE EXCEPTION 'Assignment user cannot be changed'; END IF;
    NEW.version:=OLD.version+1;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tw_module_validate BEFORE INSERT OR UPDATE ON public.tw_module_assignments FOR EACH ROW EXECUTE FUNCTION public.tw_module_validate();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tw_accounting_companies','tw_accounting_accounts','tw_accounting_years','tw_accounting_periods'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY accounting_read ON public.%I FOR SELECT TO authenticated USING ((public.tw_module_access()->>''accounting'')::boolean)',t);
    EXECUTE format('CREATE POLICY accounting_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.tw_accounting_can_manage())',t);
    IF t IN ('tw_accounting_companies','tw_accounting_accounts') THEN
      EXECUTE format('CREATE POLICY accounting_update ON public.%I FOR UPDATE TO authenticated USING (public.tw_accounting_can_manage()) WITH CHECK (public.tw_accounting_can_manage())',t);
    END IF;
    EXECUTE format('GRANT SELECT,INSERT ON public.%I TO authenticated',t);
    IF t IN ('tw_accounting_companies','tw_accounting_accounts') THEN EXECUTE format('GRANT UPDATE ON public.%I TO authenticated',t); END IF;
    EXECUTE format('CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change()',t);
  END LOOP;
END $$;
ALTER TABLE public.tw_accounting_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounting_audit_read ON public.tw_accounting_audit FOR SELECT TO authenticated USING ((public.tw_module_access()->>'manage')::boolean);
GRANT SELECT ON public.tw_accounting_audit TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.tw_module_assignments TO authenticated;
CREATE TRIGGER tw_modules_audit AFTER INSERT OR UPDATE ON public.tw_module_assignments FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();

CREATE FUNCTION public.tw_accounting_add_year(p_company uuid,p_start date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE y uuid; fiscal_month integer;
BEGIN
  IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management access required'; END IF;
  SELECT fiscal_start_month INTO fiscal_month FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
  IF fiscal_month IS NULL OR extract(month FROM p_start)<>fiscal_month OR extract(day FROM p_start)<>1 THEN RAISE EXCEPTION 'Start date must match the company fiscal calendar'; END IF;
  IF EXISTS(SELECT 1 FROM tw_accounting_years WHERE company_id=p_company AND daterange(start_date,end_date,'[]') && daterange(p_start,(p_start+interval '1 year'-interval '1 day')::date,'[]')) THEN RAISE EXCEPTION 'Financial year overlaps an existing year'; END IF;
  INSERT INTO tw_accounting_years(company_id,start_date,end_date) VALUES(p_company,p_start,(p_start+interval '1 year'-interval '1 day')::date) RETURNING id INTO y;
  INSERT INTO tw_accounting_periods(year_id,period_number,start_date,end_date)
    SELECT y,n+1,(p_start+make_interval(months=>n))::date,(p_start+make_interval(months=>n+1)-interval '1 day')::date FROM generate_series(0,11) n;
  RETURN y;
END; $$;

CREATE FUNCTION public.tw_accounting_create_company(p_name text,p_country text,p_currency text,p_start date,p_chart jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; a jsonb;
BEGIN
  IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management access required'; END IF;
  IF jsonb_typeof(p_chart)<>'array' OR jsonb_array_length(p_chart) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid starter chart'; END IF;
  INSERT INTO tw_accounting_companies(name,country_code,base_currency,currencies,fiscal_start_month)
    VALUES(trim(p_name),p_country,p_currency,ARRAY[p_currency],extract(month FROM p_start)) RETURNING id INTO c;
  -- Groups precede detail accounts; codes in the approved chart sort parent-first.
  FOR a IN SELECT value FROM jsonb_array_elements(p_chart) ORDER BY value->>'code' LOOP
    INSERT INTO tw_accounting_accounts(company_id,code,name,parent_code,account_type,normal_balance,kind,subledger)
    VALUES(c,a->>'code',a->>'name',a->>'parent',a->>'type',a->>'normal',a->>'kind',a->>'subledger');
  END LOOP;
  PERFORM tw_accounting_add_year(c,p_start);
  RETURN c;
END; $$;
REVOKE ALL ON FUNCTION public.tw_accounting_add_year(uuid,date),public.tw_accounting_create_company(text,text,text,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tw_accounting_add_year(uuid,date),public.tw_accounting_create_company(text,text,text,date,jsonb) TO authenticated;

-- Restrictive policies supplement (never replace) existing operational policies.
-- Portal users keep their existing portal policies; accounting-only staff cannot
-- query operational tables directly through PostgREST after losing Media access.
CREATE FUNCTION public.tw_media_data_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((tw_module_access()->>'media')::boolean,false)
 OR EXISTS(SELECT 1 FROM client_users WHERE profile_id=auth.uid())
 OR EXISTS(SELECT 1 FROM influencers WHERE profile_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.tw_media_data_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tw_media_data_access() TO authenticated;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity
    AND tablename NOT LIKE 'tw_%' AND tablename NOT IN ('profiles','roles','permissions','role_permissions','client_users','influencers') LOOP
    EXECUTE format('CREATE POLICY tw_media_module_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.tw_media_data_access())) WITH CHECK ((SELECT public.tw_media_data_access()))',t.tablename);
  END LOOP;
END $$;

-- Only validated functions may create fiscal calendars.
REVOKE INSERT,UPDATE,DELETE ON public.tw_accounting_years,public.tw_accounting_periods FROM authenticated,anon;
REVOKE DELETE ON public.tw_module_assignments FROM authenticated,anon;
COMMIT;
