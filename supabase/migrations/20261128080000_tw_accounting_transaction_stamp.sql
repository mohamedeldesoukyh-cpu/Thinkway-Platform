BEGIN;
ALTER TABLE public.tw_accounting_journals ADD COLUMN updated_by uuid REFERENCES public.profiles(id);
CREATE FUNCTION public.tw_accounting_stamp_journal() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.updated_by:=auth.uid();NEW.updated_at:=now();
 IF TG_OP='INSERT' THEN NEW.created_at:=now();NEW.created_by:=coalesce(auth.uid(),NEW.created_by);
 ELSE NEW.created_at:=OLD.created_at;NEW.created_by:=OLD.created_by;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_stamp_journal() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tw_journal_actor_stamp BEFORE INSERT OR UPDATE ON public.tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_stamp_journal();
CREATE FUNCTION public.tw_accounting_transaction_stamp(p_company uuid,p_journal uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 RETURN (SELECT jsonb_build_object('createdBy',c.full_name,'createdAt',j.created_at,'updatedBy',u.full_name,'updatedAt',CASE WHEN j.updated_by IS NOT NULL THEN j.updated_at END,'postedBy',p.full_name,'postedAt',j.posted_at)
 FROM tw_accounting_journals j LEFT JOIN profiles c ON c.id=j.created_by LEFT JOIN profiles u ON u.id=j.updated_by LEFT JOIN profiles p ON p.id=j.posted_by
 WHERE j.id=p_journal AND j.company_id=p_company);
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_transaction_stamp(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_transaction_stamp(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.tw_accounting_audit_report(p_company uuid, p_from date, p_to date, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'manage')::boolean,false) THEN RAISE EXCEPTION 'Accounting management access required' USING ERRCODE='42501';END IF;
 IF p_from>p_to OR p_from IS NULL OR p_to IS NULL OR length(p_search)>120 OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Check audit filters';END IF;
 WITH entries AS(SELECT a.*,(SELECT full_name FROM profiles WHERE id=a.actor_id) actor_name FROM tw_accounting_audit a WHERE (a.occurred_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN p_from AND p_to
 AND (coalesce(a.after_data->>'company_id',a.before_data->>'company_id')=p_company::text
 OR (a.table_name='tw_accounting_companies' AND coalesce(a.after_data->>'id',a.before_data->>'id')=p_company::text)
 OR (a.table_name='tw_accounting_periods' AND coalesce(a.after_data->>'year_id',a.before_data->>'year_id') IN(SELECT id::text FROM tw_accounting_years WHERE company_id=p_company)))
 AND concat_ws(' ',a.table_name,a.operation,a.after_data->>'reason',a.after_data->>'memo',a.after_data->>'reference',a.after_data->>'voucher_number') ILIKE '%'||p_search||'%')
 SELECT jsonb_build_object('count',(SELECT count(*) FROM entries),'rows',(SELECT coalesce(jsonb_agg(x ORDER BY x.id DESC),'[]') FROM(SELECT * FROM entries ORDER BY id DESC OFFSET p_offset LIMIT 50)x)) INTO result;
 RETURN result;
END $function$;
NOTIFY pgrst,'reload schema';
COMMIT;
