BEGIN;
CREATE TABLE public.tw_accounting_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 journal_id uuid NOT NULL REFERENCES public.tw_accounting_journals(id),
 company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
 storage_path text NOT NULL UNIQUE CHECK(storage_path LIKE journal_id::text || '/' || id::text || '.%'),
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 10485760),
 uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), uploaded_at timestamptz, removed_at timestamptz
);
CREATE INDEX tw_accounting_attachments_journal ON public.tw_accounting_attachments(journal_id);
CREATE FUNCTION public.tw_accounting_attachment_access(p_journal uuid,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((tw_module_access()->>'accounting')::boolean,false) AND EXISTS(
 SELECT 1 FROM tw_accounting_journals j WHERE j.id=p_journal AND (NOT p_write OR
 (tw_accounting_can_manage() AND NOT j.control_locked AND j.status IN ('draft','posted') AND EXISTS(
 SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id
 WHERE y.company_id=j.company_id AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed))));
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_attachment_access(uuid,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_attachment_access(uuid,boolean) TO authenticated;
CREATE FUNCTION public.tw_accounting_attachment_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;
BEGIN
 SELECT * INTO j FROM tw_accounting_journals WHERE id=NEW.journal_id;
 PERFORM 1 FROM tw_accounting_companies WHERE id=j.company_id FOR UPDATE;
 PERFORM 1 FROM tw_accounting_journals WHERE id=NEW.journal_id FOR UPDATE;
 IF NOT tw_accounting_attachment_access(NEW.journal_id,true) THEN RAISE EXCEPTION 'Attachment changes require an unlocked journal in an open period'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.uploaded_by<>auth.uid() OR NEW.uploaded_at IS NOT NULL OR NEW.removed_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid new attachment'; END IF;
  NEW.company_id:=j.company_id;
 ELSE
  IF (to_jsonb(NEW)-'uploaded_at'-'removed_at') IS DISTINCT FROM (to_jsonb(OLD)-'uploaded_at'-'removed_at') OR OLD.removed_at IS NOT NULL THEN RAISE EXCEPTION 'Attachment identity is immutable'; END IF;
  IF NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
   IF OLD.uploaded_at IS NOT NULL OR NEW.uploaded_at IS NULL OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='tw-accounting-attachments' AND o.name=NEW.storage_path AND (o.metadata->>'size')::bigint=NEW.byte_size AND o.metadata->>'mimetype'=NEW.mime_type) THEN RAISE EXCEPTION 'Upload is incomplete'; END IF;
   NEW.uploaded_at:=now();
  END IF;
  IF NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN NEW.removed_at:=now(); END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.tw_accounting_attachment_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER accounting_attachment_guard BEFORE INSERT OR UPDATE ON public.tw_accounting_attachments FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_attachment_guard();
CREATE TRIGGER accounting_attachment_audit AFTER INSERT OR UPDATE ON public.tw_accounting_attachments FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();
ALTER TABLE public.tw_accounting_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_accounting_attachments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.tw_accounting_attachments TO authenticated;
GRANT UPDATE(uploaded_at,removed_at) ON public.tw_accounting_attachments TO authenticated;
CREATE POLICY accounting_attachments_read ON public.tw_accounting_attachments FOR SELECT TO authenticated USING(tw_accounting_attachment_access(journal_id,false));
CREATE POLICY accounting_attachments_insert ON public.tw_accounting_attachments FOR INSERT TO authenticated WITH CHECK(uploaded_by=auth.uid() AND tw_accounting_attachment_access(journal_id,true));
CREATE POLICY accounting_attachments_update ON public.tw_accounting_attachments FOR UPDATE TO authenticated USING(removed_at IS NULL AND tw_accounting_attachment_access(journal_id,true)) WITH CHECK(tw_accounting_attachment_access(journal_id,true));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('tw-accounting-attachments','tw-accounting-attachments',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp']);
CREATE FUNCTION public.tw_accounting_attachment_object(p_path text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tw_accounting_attachments a WHERE a.storage_path=p_path AND a.removed_at IS NULL AND tw_accounting_attachment_access(a.journal_id,p_write)
 AND (NOT p_write OR a.uploaded_at IS NULL AND a.uploaded_by=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_attachment_object(text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_attachment_object(text,boolean) TO authenticated;
CREATE POLICY accounting_attachment_objects_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='tw-accounting-attachments' AND tw_accounting_attachment_object(name,false));
CREATE POLICY accounting_attachment_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='tw-accounting-attachments' AND tw_accounting_attachment_object(name,true));
NOTIFY pgrst,'reload schema';
COMMIT;
