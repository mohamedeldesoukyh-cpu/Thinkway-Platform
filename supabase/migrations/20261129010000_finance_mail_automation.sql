BEGIN;
-- Separate read-only delegation; no accounting writes or numbering allocations.
CREATE TABLE public.tw_finance_mail_config (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 year_id uuid NOT NULL REFERENCES tw_accounting_years(id),
 authorized_by uuid NOT NULL REFERENCES profiles(id),
 enabled boolean NOT NULL DEFAULT false,
 enabled_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tw_finance_mail_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email_id uuid NOT NULL UNIQUE, thread_id uuid NOT NULL,
 sender text NOT NULL CHECK(sender IN('mohamedeldesouky@thinkwaymedia.com','mmahmoud@thinkwaymedia.com','raaof@thinkwaymedia.com')),
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 year_id uuid NOT NULL REFERENCES tw_accounting_years(id),
 authorized_by uuid NOT NULL REFERENCES profiles(id),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','prepared','sending','sent','needs_review','failed')),
 attempts integer NOT NULL DEFAULT 0, lease_id uuid, lease_until timestamptz,
 response_text text, error_code text, outbound_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 first_send_at timestamptz,
 CHECK(length(response_text)<=180000)
);
CREATE INDEX tw_finance_mail_jobs_pending ON tw_finance_mail_jobs(status,created_at);
ALTER TABLE tw_finance_mail_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tw_finance_mail_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_finance_mail_config,tw_finance_mail_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON tw_finance_mail_config,tw_finance_mail_jobs TO authenticated;
GRANT ALL ON tw_finance_mail_config,tw_finance_mail_jobs TO service_role;
CREATE POLICY finance_mail_config_read ON tw_finance_mail_config FOR SELECT TO authenticated USING((tw_module_access()->>'admin')::boolean);
CREATE POLICY finance_mail_jobs_read ON tw_finance_mail_jobs FOR SELECT TO authenticated USING((tw_module_access()->>'admin')::boolean);

CREATE FUNCTION tw_finance_mail_configure(p_company uuid,p_year uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) OR NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Verified accounting administrator required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE id=p_year AND company_id=p_company) THEN RAISE EXCEPTION 'Invalid fiscal scope';END IF;
 INSERT INTO tw_finance_mail_config(id,company_id,year_id,authorized_by,enabled)
 VALUES(true,p_company,p_year,auth.uid(),p_enabled)
 ON CONFLICT(id) DO UPDATE SET company_id=p_company,year_id=p_year,authorized_by=auth.uid(),enabled=p_enabled,enabled_at=now(),updated_at=now();
 -- Old scope is never silently reassigned to a new company or authorization.
 UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='configuration_changed',lease_id=NULL,lease_until=NULL,updated_at=now()
 WHERE status IN('queued','processing','prepared','sending');
END $$;
REVOKE ALL ON FUNCTION tw_finance_mail_configure(uuid,uuid,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_finance_mail_configure(uuid,uuid,boolean) TO authenticated;

CREATE FUNCTION tw_finance_mail_enqueue(p_email uuid,p_thread uuid,p_sender text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_finance_mail_config;existing uuid;BEGIN
 SELECT * INTO c FROM tw_finance_mail_config WHERE id=true AND enabled FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT id INTO existing FROM tw_finance_mail_jobs WHERE email_id=p_email;
 IF FOUND THEN RETURN existing;END IF;
 IF p_sender NOT IN('mohamedeldesouky@thinkwaymedia.com','mmahmoud@thinkwaymedia.com','raaof@thinkwaymedia.com') THEN RAISE EXCEPTION 'Unauthorized sender';END IF;
 IF (SELECT count(*) FROM tw_finance_mail_jobs WHERE sender=p_sender AND created_at>now()-interval '24 hours')>=20 THEN RETURN NULL;END IF;
 INSERT INTO tw_finance_mail_jobs(email_id,thread_id,sender,company_id,year_id,authorized_by)
 VALUES(p_email,p_thread,p_sender,c.company_id,c.year_id,c.authorized_by) RETURNING id INTO existing;
 RETURN existing;
END $$;

CREATE FUNCTION tw_finance_mail_claim() RETURNS SETOF tw_finance_mail_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tw_finance_mail_config WHERE enabled) THEN RETURN;END IF;
 UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='retry_limit',lease_id=NULL,lease_until=NULL
 WHERE status='processing' AND lease_until<now() AND attempts>=3;
 RETURN QUERY WITH candidate AS (
 SELECT j.id FROM tw_finance_mail_jobs j JOIN tw_finance_mail_config c ON c.enabled AND c.company_id=j.company_id AND c.year_id=j.year_id AND c.authorized_by=j.authorized_by
 WHERE (j.status='queued' OR (j.status='processing' AND j.lease_until<now())) AND j.attempts<3
 ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1)
 UPDATE tw_finance_mail_jobs j SET status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
 FROM candidate WHERE j.id=candidate.id RETURNING j.*;
END $$;

-- This service-only function delegates exactly three read operations. It never
-- grants service_role direct access to the general accounting report functions.
CREATE FUNCTION tw_finance_mail_read(p_job uuid,p_lease uuid,p_operation text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_finance_mail_jobs;result jsonb;prior text:=current_setting('request.jwt.claims',true);BEGIN
 SELECT * INTO j FROM tw_finance_mail_jobs WHERE id=p_job AND lease_id=p_lease AND lease_until>now() AND status='processing';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM tw_finance_mail_config c WHERE c.enabled AND c.company_id=j.company_id AND c.year_id=j.year_id AND c.authorized_by=j.authorized_by) THEN RAISE EXCEPTION 'Inactive report delegation' USING ERRCODE='42501';END IF;
 -- Recheck the authorizer's current permissions, without manufacturing MFA.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',j.authorized_by,'role','authenticated')::text,true);
 IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Report delegation revoked' USING ERRCODE='42501';END IF;
 IF p_operation='setup' THEN
  SELECT jsonb_build_object('company',to_jsonb(c),'year',(SELECT to_jsonb(y) FROM tw_accounting_years y WHERE y.id=j.year_id AND y.company_id=j.company_id),
   'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM tw_accounting_accounts a WHERE a.company_id=j.company_id AND a.client_id IS NULL AND a.vendor_id IS NULL)) INTO result FROM tw_accounting_companies c WHERE c.id=j.company_id;
 ELSIF p_operation='party_lookup' THEN
  result:=tw_accounting_party_lookup(j.company_id,'client',p_args->>'search',NULL);
 ELSIF p_operation='statement' THEN
  IF p_args->>'action' NOT IN('pnl','client_statement') OR p_args->>'display' NOT IN('local','USD','foreign') THEN RAISE EXCEPTION 'Unsupported report';END IF;
  IF p_args->>'action'='client_statement' AND nullif(p_args->>'party','') IS NULL THEN RAISE EXCEPTION 'Client selection required';END IF;
  result:=tw_accounting_statement_filtered(j.company_id,(p_args->>'from')::date,(p_args->>'to')::date,NULL,
   CASE WHEN p_args->>'action'='pnl' THEN 'all' ELSE 'client' END,nullif(p_args->>'party','')::uuid,NULL,0,NULL,
   jsonb_build_object('reportMode',CASE WHEN p_args->>'action'='pnl' THEN 'profit' ELSE 'statement' END,'display',p_args->>'display','dateBasis','journal','includeUnlocked',true,'excludeClosing',p_args->>'action'='pnl','skipZero',false));
 ELSE RAISE EXCEPTION 'Unsupported delegated operation';END IF;
 PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);RAISE;
END $$;
REVOKE ALL ON FUNCTION tw_finance_mail_enqueue(uuid,uuid,text),tw_finance_mail_claim(),tw_finance_mail_read(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tw_finance_mail_enqueue(uuid,uuid,text),tw_finance_mail_claim(),tw_finance_mail_read(uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION tw_finance_mail_claim_send() RETURNS SETOF tw_finance_mail_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_finance_mail_jobs;prior text:=current_setting('request.jwt.claims',true);BEGIN
 UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='delivery_uncertain',lease_id=NULL,lease_until=NULL
 WHERE status='sending' AND first_send_at<now()-interval '20 hours';
 SELECT q.* INTO j FROM tw_finance_mail_jobs q JOIN tw_finance_mail_config c ON c.enabled AND c.company_id=q.company_id AND c.year_id=q.year_id AND c.authorized_by=q.authorized_by
 WHERE (q.status='prepared' OR(q.status='sending' AND q.lease_until<now())) AND q.response_text IS NOT NULL
 ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN;END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',j.authorized_by,'role','authenticated')::text,true);
 IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN
  UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='authorization_revoked' WHERE id=j.id;
  PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);RETURN;
 END IF;
 PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);
 RETURN QUERY UPDATE tw_finance_mail_jobs SET status='sending',first_send_at=coalesce(first_send_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=j.id RETURNING *;
EXCEPTION WHEN OTHERS THEN PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);RAISE;
END $$;
REVOKE ALL ON FUNCTION tw_finance_mail_claim_send() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tw_finance_mail_claim_send() TO service_role;
COMMIT;
