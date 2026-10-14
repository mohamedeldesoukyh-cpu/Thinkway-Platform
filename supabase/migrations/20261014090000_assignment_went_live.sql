-- One operational live state per creator package. Commercial amounts are untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public.assignment_live_state_backup_20261014 (
  table_name text NOT NULL, row_id uuid NOT NULL, previous_row jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(table_name,row_id)
);
ALTER TABLE public.assignment_live_state_backup_20261014 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_live_state_backup_20261014 FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.publication_assignment_line(p public.campaign_publications)
RETURNS uuid LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT coalesce(p.campaign_line_id,
 (SELECT campaign_line_id FROM assignment_post_schedule WHERE id=p.assignment_post_schedule_id),
 (SELECT campaign_line_id FROM assignment_deliverables WHERE id=p.assignment_deliverable_id),
 (SELECT CASE WHEN count(DISTINCT campaign_line_id)=1 THEN min(campaign_line_id::text)::uuid END
  FROM campaign_influencers WHERE campaign_header_id=p.campaign_header_id AND influencer_id=p.influencer_id))
$$;
REVOKE ALL ON FUNCTION public.publication_assignment_line(public.campaign_publications) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reconcile_assignment_went_live(p_line uuid, p_manual_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE baseline date; prior_guard text; r record; actual date; actual_id uuid; target_ids uuid[];
BEGIN
 IF p_line IS NULL THEN RETURN; END IF;
 -- Serialize updates within a package, including simultaneous publications.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_line::text,0));
 SELECT coalesce(p_manual_date, min(dt)) INTO baseline FROM (
  SELECT s.live_date dt FROM assignment_post_schedule s WHERE s.campaign_line_id=p_line
   AND (s.status::text IN ('posted','published','live','verified') OR s.metadata->>'live_date_source'='manual')
  UNION ALL SELECT d.live_date FROM assignment_deliverables d WHERE d.campaign_line_id=p_line
   AND (d.metadata->>'workflow_status' IN ('posted','published','live','verified') OR d.metadata->>'live_date_source'='manual')
  UNION ALL SELECT (p.publication_date AT TIME ZONE 'Africa/Cairo')::date FROM campaign_publications p
   WHERE publication_assignment_line(p)=p_line
 ) evidence WHERE dt <= (now() AT TIME ZONE 'Africa/Cairo')::date;
 IF baseline IS NULL OR baseline > (now() AT TIME ZONE 'Africa/Cairo')::date THEN RETURN; END IF;
 prior_guard:=current_setting('app.assignment_live_sync',true);
 PERFORM set_config('app.assignment_live_sync','on',true);
 INSERT INTO assignment_live_state_backup_20261014(table_name,row_id,previous_row)
 SELECT 'assignment_post_schedule',id,to_jsonb(s) FROM assignment_post_schedule s WHERE campaign_line_id=p_line
 ON CONFLICT DO NOTHING;
 INSERT INTO assignment_live_state_backup_20261014(table_name,row_id,previous_row)
 SELECT 'assignment_deliverables',id,to_jsonb(d) FROM assignment_deliverables d WHERE campaign_line_id=p_line
 ON CONFLICT DO NOTHING;
 -- Copied dates remain distinguishable from actual publication dates.
 UPDATE assignment_post_schedule SET live_date=baseline,status='posted',
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('went_live',true,'live_date_source','assignment','assignment_live_date',baseline)
 WHERE campaign_line_id=p_line AND (metadata->>'live_date_source' IS DISTINCT FROM 'publication');
 -- Resolve each actual publication to a post, never copy its date to unrelated ads.
 FOR r IN SELECT p.* FROM campaign_publications p WHERE publication_assignment_line(p)=p_line
  AND p.publication_date IS NOT NULL AND (p.publication_date AT TIME ZONE 'Africa/Cairo')::date <= (now() AT TIME ZONE 'Africa/Cairo')::date
  ORDER BY p.publication_date,p.id LOOP
  actual:=(r.publication_date AT TIME ZONE 'Africa/Cairo')::date;
  target_ids:=NULL;
  IF r.assignment_post_schedule_id IS NOT NULL THEN
   SELECT array_agg(id) INTO target_ids FROM assignment_post_schedule WHERE id=r.assignment_post_schedule_id AND campaign_line_id=p_line;
  ELSE
   SELECT array_agg(s.id ORDER BY s.sequence_number,s.id) INTO target_ids
   FROM assignment_post_schedule s JOIN assignment_deliverables d ON d.id=s.assignment_deliverable_id
   WHERE s.campaign_line_id=p_line AND
    (CASE WHEN r.assignment_deliverable_id IS NOT NULL THEN d.id=r.assignment_deliverable_id ELSE
     replace(replace(lower(d.platform),'instagram','ig'),'tiktok','tt')=replace(replace(lower(r.platform),'instagram','ig'),'tiktok','tt')
     AND replace(replace(lower(d.deliverable_type),'instagram','ig'),'tiktok','tt')=replace(replace(lower(r.publication_type),'instagram','ig'),'tiktok','tt') END);
  END IF;
  IF cardinality(target_ids)>0 THEN
   -- Keep an established publication mapping; otherwise use the first unclaimed post.
   SELECT s.id INTO actual_id FROM assignment_post_schedule s WHERE s.id=ANY(target_ids)
    AND s.metadata->>'publication_id'=r.id::text LIMIT 1;
   IF actual_id IS NULL THEN
    SELECT s.id INTO actual_id FROM assignment_post_schedule s WHERE s.id=ANY(target_ids)
     AND (s.metadata->>'publication_id' IS NULL OR s.metadata->>'live_date_source'<>'publication')
     ORDER BY s.sequence_number,s.id LIMIT 1;
   END IF;
   IF actual_id IS NULL AND cardinality(target_ids)=1 THEN actual_id:=target_ids[1]; END IF;
   IF actual_id IS NOT NULL THEN
    UPDATE assignment_post_schedule SET live_date=actual,status='posted',
     metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('went_live',true,'live_date_source','publication',
       'publication_id',r.id,'publication_live_date',actual,'assignment_live_date',baseline)
    WHERE id=actual_id;
   END IF;
  END IF;
 END LOOP;
 UPDATE assignment_post_schedule SET status='posted',metadata=coalesce(metadata,'{}'::jsonb)||'{"went_live":true}'::jsonb
 WHERE campaign_line_id=p_line AND status::text<>'posted';
 UPDATE assignment_deliverables d SET live_date=coalesce((SELECT min(s.live_date) FROM assignment_post_schedule s WHERE s.assignment_deliverable_id=d.id),baseline),
  metadata=coalesce(d.metadata,'{}'::jsonb)||jsonb_build_object('went_live',true,'workflow_status','posted','assignment_live_date',baseline)
 WHERE d.campaign_line_id=p_line;
 PERFORM set_config('app.assignment_live_sync',coalesce(prior_guard,''),true);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_assignment_went_live(uuid,date) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.assignment_went_live_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line_id uuid; manual_date date;
BEGIN
 IF current_setting('app.assignment_live_sync',true)='on' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='campaign_publications' THEN
  line_id:=publication_assignment_line(NEW);
 ELSE
  line_id:=NEW.campaign_line_id;
  IF NEW.metadata->>'live_date_source'='manual' THEN manual_date:=NEW.live_date; END IF;
 END IF;
 PERFORM reconcile_assignment_went_live(line_id,manual_date);
 RETURN NEW;
END $$;
CREATE TRIGGER sync_publication_assignment_live AFTER INSERT OR UPDATE OF publication_date,assignment_post_schedule_id,assignment_deliverable_id,campaign_line_id,platform,publication_type
 ON campaign_publications FOR EACH ROW EXECUTE FUNCTION assignment_went_live_trigger();
CREATE TRIGGER sync_post_assignment_live AFTER INSERT OR UPDATE OF live_date,status,metadata
 ON assignment_post_schedule FOR EACH ROW EXECUTE FUNCTION assignment_went_live_trigger();
CREATE TRIGGER sync_deliverable_assignment_live AFTER UPDATE OF live_date
 ON assignment_deliverables FOR EACH ROW EXECUTE FUNCTION assignment_went_live_trigger();

CREATE OR REPLACE FUNCTION public.record_assignment_went_live(p_campaign uuid,p_schedule uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_access_campaign_header(p_campaign) OR NOT public.has_permission('campaigns.write') THEN
  RAISE EXCEPTION 'Not authorized to update this campaign'; END IF;
 IF p_date IS NULL OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Choose an actual live date today or earlier'; END IF;
 SELECT s.campaign_line_id INTO line_id FROM assignment_post_schedule s JOIN campaign_lines l ON l.id=s.campaign_line_id
 WHERE s.id=p_schedule AND l.campaign_header_id=p_campaign;
 IF line_id IS NULL THEN RAISE EXCEPTION 'Ad does not belong to this campaign'; END IF;
 PERFORM reconcile_assignment_went_live(line_id,p_date);
END $$;
REVOKE ALL ON FUNCTION public.record_assignment_went_live(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_assignment_went_live(uuid,uuid,date) TO authenticated;
-- Reconcile historical evidence, including Draft publications. No invoice/payment dependency.
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM campaign_lines LOOP
 PERFORM reconcile_assignment_went_live(r.id); END LOOP; END $$;
COMMIT;
