BEGIN;
-- Narrow Amgad to the owner's one approved identity. Preserve historical jobs.
CREATE OR REPLACE FUNCTION public.tw_finance_mail_is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND lower(email)='mohamedeldesouky@thinkwaymedia.com');
$$;
REVOKE ALL ON FUNCTION public.tw_finance_mail_is_owner() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tw_finance_mail_is_owner() TO authenticated,service_role;
ALTER POLICY finance_mail_config_read ON tw_finance_mail_config USING(tw_finance_mail_is_owner() AND (tw_module_access()->>'admin')::boolean);
ALTER POLICY finance_mail_jobs_read ON tw_finance_mail_jobs USING(tw_finance_mail_is_owner() AND (tw_module_access()->>'admin')::boolean);
UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='requester_removed',lease_id=NULL,lease_until=NULL,updated_at=now()
 WHERE sender<>'mohamedeldesouky@thinkwaymedia.com' AND status IN('queued','processing','prepared','sending');
ALTER TABLE tw_finance_mail_jobs ADD CONSTRAINT finance_mail_single_active_requester
 CHECK(sender='mohamedeldesouky@thinkwaymedia.com' OR status IN('sent','needs_review','failed'));
UPDATE tw_finance_mail_config SET enabled=false,updated_at=now()
 WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=authorized_by AND lower(u.email)='mohamedeldesouky@thinkwaymedia.com');
CREATE OR REPLACE FUNCTION tw_finance_mail_configure(p_company uuid,p_year uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT tw_finance_mail_is_owner() THEN RAISE EXCEPTION 'Finance owner required' USING ERRCODE='42501';END IF;
 IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) OR NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Verified accounting administrator required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE id=p_year AND company_id=p_company) THEN RAISE EXCEPTION 'Invalid fiscal scope';END IF;
 INSERT INTO tw_finance_mail_config(id,company_id,year_id,authorized_by,enabled)
 VALUES(true,p_company,p_year,auth.uid(),p_enabled)
 ON CONFLICT(id) DO UPDATE SET company_id=p_company,year_id=p_year,authorized_by=auth.uid(),enabled=p_enabled,enabled_at=now(),updated_at=now();
 -- Old scope is never silently reassigned to a new company or authorization.
 UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='configuration_changed',lease_id=NULL,lease_until=NULL,updated_at=now()
 WHERE status IN('queued','processing','prepared','sending');
END $$;

CREATE OR REPLACE FUNCTION tw_finance_mail_enqueue(p_email uuid,p_thread uuid,p_sender text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_finance_mail_config;existing uuid;BEGIN
 IF p_sender IS DISTINCT FROM 'mohamedeldesouky@thinkwaymedia.com' THEN RAISE EXCEPTION 'Unauthorized sender' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM tw_finance_mail_config WHERE id=true AND enabled AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=authorized_by AND lower(u.email)='mohamedeldesouky@thinkwaymedia.com') FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT id INTO existing FROM tw_finance_mail_jobs WHERE email_id=p_email;
 IF FOUND THEN RETURN existing;END IF;

 IF (SELECT count(*) FROM tw_finance_mail_jobs WHERE sender=p_sender AND created_at>now()-interval '24 hours')>=20 THEN RETURN NULL;END IF;
 INSERT INTO tw_finance_mail_jobs(email_id,thread_id,sender,company_id,year_id,authorized_by)
 VALUES(p_email,p_thread,p_sender,c.company_id,c.year_id,c.authorized_by) RETURNING id INTO existing;
 RETURN existing;
END $$;

CREATE OR REPLACE FUNCTION tw_finance_mail_claim() RETURNS SETOF tw_finance_mail_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tw_finance_mail_config WHERE enabled) THEN RETURN;END IF;
 UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='retry_limit',lease_id=NULL,lease_until=NULL
 WHERE status='processing' AND lease_until<now() AND attempts>=3;
 RETURN QUERY WITH candidate AS (
 SELECT j.id FROM tw_finance_mail_jobs j JOIN tw_finance_mail_config c ON c.enabled AND c.company_id=j.company_id AND c.year_id=j.year_id AND c.authorized_by=j.authorized_by
 WHERE j.sender='mohamedeldesouky@thinkwaymedia.com' AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=c.authorized_by AND lower(u.email)='mohamedeldesouky@thinkwaymedia.com') AND (j.status='queued' OR (j.status='processing' AND j.lease_until<now())) AND j.attempts<3
 ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1)
 UPDATE tw_finance_mail_jobs j SET status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
 FROM candidate WHERE j.id=candidate.id RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION tw_finance_mail_claim_send() RETURNS SETOF tw_finance_mail_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_finance_mail_jobs;prior text:=current_setting('request.jwt.claims',true);BEGIN
 UPDATE tw_finance_mail_jobs SET status='needs_review',error_code='delivery_uncertain',lease_id=NULL,lease_until=NULL
 WHERE status='sending' AND first_send_at<now()-interval '20 hours';
 SELECT q.* INTO j FROM tw_finance_mail_jobs q JOIN tw_finance_mail_config c ON c.enabled AND c.company_id=q.company_id AND c.year_id=q.year_id AND c.authorized_by=q.authorized_by
 WHERE q.sender='mohamedeldesouky@thinkwaymedia.com' AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=c.authorized_by AND lower(u.email)='mohamedeldesouky@thinkwaymedia.com') AND (q.status='prepared' OR(q.status='sending' AND q.lease_until<now())) AND q.response_text IS NOT NULL
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
COMMIT;
