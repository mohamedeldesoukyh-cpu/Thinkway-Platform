BEGIN;
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
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM campaign_lines LOOP
 PERFORM reconcile_assignment_went_live(r.id); END LOOP; END $$;
COMMIT;
