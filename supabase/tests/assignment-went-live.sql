-- Run against development; all fixture mutations roll back.
BEGIN;
DO $$ DECLARE l uuid; c uuid; p uuid; d uuid; pub uuid; before_money jsonb; after_money jsonb; BEGIN
 SELECT s.campaign_line_id INTO l FROM assignment_post_schedule s GROUP BY s.campaign_line_id HAVING count(*)>=3 LIMIT 1;
 IF l IS NULL THEN RAISE EXCEPTION 'Need a package fixture'; END IF;
 SELECT campaign_header_id INTO c FROM campaign_lines WHERE id=l;
 SELECT id,assignment_deliverable_id INTO p,d FROM assignment_post_schedule WHERE campaign_line_id=l ORDER BY sequence_number,id LIMIT 1;
 SELECT jsonb_agg(to_jsonb(s)-ARRAY['live_date','status','metadata','updated_at']) INTO before_money FROM assignment_post_schedule s WHERE campaign_line_id=l;
 PERFORM set_config('app.assignment_live_sync','on',true);
 DELETE FROM campaign_publications cp WHERE publication_assignment_line(cp)=l;
 UPDATE assignment_post_schedule SET live_date=NULL,status='draft',metadata='{}' WHERE campaign_line_id=l;
 UPDATE assignment_deliverables SET live_date=NULL,metadata='{}' WHERE campaign_line_id=l;
 PERFORM set_config('app.assignment_live_sync','',true);
 -- Manual confirmation propagates to every sibling even with financial locks.
 UPDATE assignment_post_schedule SET live_date='2026-08-01',metadata='{"live_date_source":"manual"}' WHERE id=p;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (live_date IS DISTINCT FROM '2026-08-01'::date OR status::text<>'posted')) THEN RAISE EXCEPTION 'Manual date did not propagate'; END IF;
 INSERT INTO campaign_publications(campaign_header_id,campaign_line_id,assignment_deliverable_id,assignment_post_schedule_id,publication_date,status)
 VALUES(c,l,d,p,'2026-08-05 12:00:00+00','draft') RETURNING id INTO pub;
 IF (SELECT live_date FROM assignment_post_schedule WHERE id=p)<>'2026-08-05'::date THEN RAISE EXCEPTION 'Publication did not override copied date'; END IF;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND id<>p AND live_date<>'2026-08-01'::date) THEN RAISE EXCEPTION 'Publication overwrote siblings actual/copy dates'; END IF;
 UPDATE campaign_publications SET publication_date='2026-08-06 12:00:00+00' WHERE id=pub;
 IF (SELECT live_date FROM assignment_post_schedule WHERE id=p)<>'2026-08-06'::date THEN RAISE EXCEPTION 'Updated actual date did not sync'; END IF;
 SELECT jsonb_agg(to_jsonb(s)-ARRAY['live_date','status','metadata','updated_at'] ORDER BY s.id) INTO after_money FROM assignment_post_schedule s WHERE campaign_line_id=l;
 SELECT jsonb_agg(value ORDER BY value->>'id') INTO before_money FROM jsonb_array_elements(before_money);
 IF before_money IS DISTINCT FROM after_money THEN RAISE EXCEPTION 'Commercial fields changed'; END IF;
 -- Publication-only entry must also mark the whole package live, irrespective of Draft status or metrics.
 PERFORM set_config('app.assignment_live_sync','on',true);
 UPDATE assignment_post_schedule SET live_date=NULL,status='draft',metadata='{}' WHERE campaign_line_id=l;
 UPDATE assignment_deliverables SET live_date=NULL,metadata='{}' WHERE campaign_line_id=l;
 PERFORM set_config('app.assignment_live_sync','',true);
 UPDATE campaign_publications SET publication_date='2026-08-07 12:00:00+00' WHERE id=pub;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (status::text<>'posted' OR live_date IS DISTINCT FROM '2026-08-07'::date)) THEN RAISE EXCEPTION 'Draft publication did not mark package live'; END IF;
 -- Unauthorized RPC must fail, not silently mutate data.
 BEGIN
  PERFORM record_assignment_went_live(c,p,'2026-08-01');
  RAISE EXCEPTION 'Authorization bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Authorization bypass' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: manual propagation, publication override/update, Draft evidence, unchanged financials, authorization';
END $$;
ROLLBACK;
