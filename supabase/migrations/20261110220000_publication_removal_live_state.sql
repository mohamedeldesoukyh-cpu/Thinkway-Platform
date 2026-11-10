BEGIN;
CREATE OR REPLACE FUNCTION public.reconcile_assignment_went_live(p_line uuid, p_manual_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE baseline date; prior_guard text; r record; actual date; actual_id uuid; target_ids uuid[];
BEGIN
 IF p_line IS NULL THEN RETURN; END IF;
 -- Serialize updates within a package, including simultaneous publications.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_line::text,0));

 -- Keep independent manual evidence separate from dates copied across the package.
 SELECT coalesce(p_manual_date,min(dt)) INTO baseline FROM (
  SELECT p_manual_date dt
  UNION ALL SELECT (metadata->>'manual_went_live_date')::date FROM campaign_lines WHERE id=p_line
  UNION ALL SELECT s.live_date FROM assignment_post_schedule s WHERE s.campaign_line_id=p_line
   AND (s.metadata->>'live_date_source'='manual' OR
    (coalesce(s.metadata->>'live_date_source','') NOT IN ('assignment','publication')
     AND NOT coalesce(s.metadata,'{}'::jsonb) ? 'assignment_live_date' AND s.status::text IN ('posted','published','live','verified')))
  UNION ALL SELECT d.live_date FROM assignment_deliverables d WHERE d.campaign_line_id=p_line
   AND (d.metadata->>'live_date_source'='manual' OR
    (coalesce(d.metadata->>'live_date_source','') NOT IN ('assignment','publication')
     AND NOT coalesce(d.metadata,'{}'::jsonb) ? 'assignment_live_date'
     AND d.metadata->>'workflow_status' IN ('posted','published','live','verified')))
 ) evidence WHERE dt <= (now() AT TIME ZONE 'Africa/Cairo')::date;
 prior_guard:=current_setting('app.assignment_live_sync',true);
 PERFORM set_config('app.assignment_live_sync','on',true);
 IF baseline IS NOT NULL THEN
  UPDATE campaign_lines SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('manual_went_live_date',baseline) WHERE id=p_line;
 END IF;
 -- Remove derived evidence before recalculating: copied dates must never sustain themselves.
 UPDATE assignment_post_schedule s SET live_date=NULL,
  status=(CASE WHEN s.status::text NOT IN ('posted','published','live','verified') THEN s.status::text
   WHEN s.metadata->>'assignment_live_previous_status' NOT IN ('posted','published','live','verified') THEN s.metadata->>'assignment_live_previous_status'
   ELSE 'draft' END)::assignment_post_status,
  metadata=coalesce(s.metadata,'{}'::jsonb)-ARRAY['went_live','live_date_source','publication_id','publication_live_date','assignment_live_date']
 WHERE s.campaign_line_id=p_line AND (s.metadata->>'live_date_source' IN ('assignment','publication') OR s.metadata ? 'assignment_live_date');
 UPDATE assignment_deliverables d SET live_date=NULL,
  metadata=(coalesce(d.metadata,'{}'::jsonb)-ARRAY['went_live','live_date_source','publication_id','publication_live_date','assignment_live_date','workflow_status'])
    ||jsonb_build_object('workflow_status',coalesce(d.metadata->>'assignment_live_previous_workflow','draft'))
 WHERE d.campaign_line_id=p_line AND (d.metadata->>'live_date_source' IN ('assignment','publication') OR d.metadata ? 'assignment_live_date');
 SELECT min(dt) INTO baseline FROM (
  SELECT baseline dt UNION ALL
  SELECT (p.publication_date AT TIME ZONE 'Africa/Cairo')::date FROM campaign_publications p WHERE publication_assignment_line(p)=p_line
 ) evidence WHERE dt <= (now() AT TIME ZONE 'Africa/Cairo')::date;
 IF baseline IS NULL THEN
  UPDATE campaign_lines SET metadata=coalesce(metadata,'{}'::jsonb)-ARRAY['went_live','went_live_date'] WHERE id=p_line;
  PERFORM set_config('app.assignment_live_sync',coalesce(prior_guard,''),true);
  RETURN;
 END IF;
 -- Remember the non-live workflow for future removal without changing commercial amounts.
 UPDATE assignment_post_schedule SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('assignment_live_previous_status',status::text)
 WHERE campaign_line_id=p_line AND status::text NOT IN ('posted','published','live','verified');
 UPDATE assignment_deliverables SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('assignment_live_previous_workflow',coalesce(metadata->>'workflow_status','draft'))
 WHERE campaign_line_id=p_line AND coalesce(metadata->>'workflow_status','draft') NOT IN ('posted','published','live','verified');
 INSERT INTO assignment_live_state_backup_20261014(table_name,row_id,previous_row)
 SELECT 'campaign_lines',id,to_jsonb(l) FROM campaign_lines l WHERE id=p_line ON CONFLICT DO NOTHING;
 UPDATE campaign_lines SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('went_live',true,'went_live_date',baseline)
 WHERE id=p_line AND (metadata->>'went_live_date' IS DISTINCT FROM baseline::text OR metadata->>'went_live' IS DISTINCT FROM 'true');

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

CREATE OR REPLACE FUNCTION public.assignment_went_live_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line_id uuid; old_line uuid; manual_date date; lock_id uuid;
BEGIN
 IF current_setting('app.assignment_live_sync',true)='on' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME='campaign_publications' THEN
  IF TG_OP IN ('UPDATE','DELETE') THEN old_line:=publication_assignment_line(OLD); END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN line_id:=publication_assignment_line(NEW); END IF;
  -- Stable lock order also covers moving evidence between two assignments.
  FOR lock_id IN SELECT DISTINCT x FROM unnest(ARRAY[old_line,line_id]) x WHERE x IS NOT NULL ORDER BY x LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended(lock_id::text,0));
  END LOOP;
  IF old_line IS DISTINCT FROM line_id THEN PERFORM reconcile_assignment_went_live(old_line); END IF;
 ELSE
  line_id:=NEW.campaign_line_id;
  IF NEW.metadata->>'live_date_source'='manual' THEN manual_date:=NEW.live_date; END IF;
 END IF;
 PERFORM reconcile_assignment_went_live(line_id,manual_date);
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS sync_publication_assignment_live ON public.campaign_publications;
CREATE TRIGGER sync_publication_assignment_live AFTER INSERT OR DELETE OR UPDATE OF publication_date,assignment_post_schedule_id,assignment_deliverable_id,campaign_line_id,campaign_header_id,influencer_id,platform,publication_type
 ON public.campaign_publications FOR EACH ROW EXECUTE FUNCTION public.assignment_went_live_trigger();
COMMIT;
