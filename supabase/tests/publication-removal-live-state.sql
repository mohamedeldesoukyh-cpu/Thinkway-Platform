-- Development regression: all fixture changes roll back.
BEGIN;
DO $$
DECLARE l uuid; c uuid; d uuid; p uuid; pub uuid; pub2 uuid; before_money jsonb; after_money jsonb;
BEGIN
 SELECT campaign_line_id INTO l FROM assignment_post_schedule GROUP BY campaign_line_id HAVING count(*)>=3 LIMIT 1;
 IF l IS NULL THEN RAISE EXCEPTION 'Need a package fixture'; END IF;
 SELECT campaign_header_id INTO c FROM campaign_lines WHERE id=l;
 SELECT id,assignment_deliverable_id INTO p,d FROM assignment_post_schedule WHERE campaign_line_id=l ORDER BY id LIMIT 1;
 SELECT jsonb_build_object('line',(SELECT to_jsonb(x)-ARRAY['metadata','updated_at'] FROM campaign_lines x WHERE id=l),
  'posts',(SELECT jsonb_agg(to_jsonb(x)-ARRAY['metadata','updated_at','status','live_date'] ORDER BY id) FROM assignment_post_schedule x WHERE campaign_line_id=l),
  'deliverables',(SELECT jsonb_agg(to_jsonb(x)-ARRAY['metadata','updated_at','live_date'] ORDER BY id) FROM assignment_deliverables x WHERE campaign_line_id=l)) INTO before_money;
 PERFORM set_config('app.assignment_live_sync','on',true);
 DELETE FROM campaign_publications cp WHERE publication_assignment_line(cp)=l;
 UPDATE campaign_lines SET metadata=coalesce(metadata,'{}')-ARRAY['manual_went_live_date','went_live','went_live_date'] WHERE id=l;
 UPDATE assignment_post_schedule SET live_date=NULL,status='approved',metadata='{}' WHERE campaign_line_id=l;
 UPDATE assignment_deliverables SET live_date=NULL,metadata='{}' WHERE campaign_line_id=l;
 PERFORM set_config('app.assignment_live_sync','',true);
 INSERT INTO campaign_publications(campaign_header_id,campaign_line_id,assignment_deliverable_id,assignment_post_schedule_id,publication_date,status)
 VALUES(c,l,d,p,'2026-08-05 12:00:00+00','draft') RETURNING id INTO pub;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (status::text<>'posted' OR live_date IS NULL)) THEN RAISE EXCEPTION 'Publication must mark package live'; END IF;
 INSERT INTO campaign_publications(campaign_header_id,campaign_line_id,assignment_deliverable_id,assignment_post_schedule_id,publication_date,status)
 VALUES(c,l,d,p,'2026-08-07 12:00:00+00','draft') RETURNING id INTO pub2;
 DELETE FROM campaign_publications WHERE id=pub;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (status::text<>'posted' OR live_date IS DISTINCT FROM '2026-08-07'::date)) THEN RAISE EXCEPTION 'Remaining publication must replace deleted date'; END IF;
 UPDATE campaign_publications SET publication_date=NULL WHERE id=pub2;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (live_date IS NOT NULL OR status::text<>'approved')) THEN RAISE EXCEPTION 'Removing date must restore pre-live status'; END IF;
 UPDATE campaign_publications SET publication_date='2026-08-08 12:00:00+00' WHERE id=pub2;
 DELETE FROM campaign_publications WHERE id=pub2;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (live_date IS NOT NULL OR status::text<>'approved' OR metadata->>'went_live'='true')) THEN RAISE EXCEPTION 'Last deletion left live posts / recognized revenue'; END IF;
 IF EXISTS(SELECT 1 FROM assignment_deliverables WHERE campaign_line_id=l AND (live_date IS NOT NULL OR metadata->>'workflow_status'='posted')) THEN RAISE EXCEPTION 'Last deletion left live deliverables'; END IF;
 IF EXISTS(SELECT 1 FROM campaign_lines WHERE id=l AND (metadata->>'went_live'='true' OR metadata ? 'went_live_date')) THEN RAISE EXCEPTION 'Last deletion left live assignment'; END IF;
 -- Independent manual confirmation survives removing a publication.
 PERFORM reconcile_assignment_went_live(l,'2026-08-01');
 INSERT INTO campaign_publications(campaign_header_id,campaign_line_id,assignment_deliverable_id,assignment_post_schedule_id,publication_date,status)
 VALUES(c,l,d,p,'2026-08-09 12:00:00+00','draft') RETURNING id INTO pub;
 DELETE FROM campaign_publications WHERE id=pub;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (live_date IS DISTINCT FROM '2026-08-01'::date OR status::text<>'posted')) THEN RAISE EXCEPTION 'Independent manual evidence was lost'; END IF;
 SELECT jsonb_build_object('line',(SELECT to_jsonb(x)-ARRAY['metadata','updated_at'] FROM campaign_lines x WHERE id=l),
  'posts',(SELECT jsonb_agg(to_jsonb(x)-ARRAY['metadata','updated_at','status','live_date'] ORDER BY id) FROM assignment_post_schedule x WHERE campaign_line_id=l),
  'deliverables',(SELECT jsonb_agg(to_jsonb(x)-ARRAY['metadata','updated_at','live_date'] ORDER BY id) FROM assignment_deliverables x WHERE campaign_line_id=l)) INTO after_money;
 IF before_money IS DISTINCT FROM after_money THEN RAISE EXCEPTION 'Commercial fields changed'; END IF;
 RAISE NOTICE 'PASS: last removal, remaining evidence, removed date, workflow restoration, manual evidence, unchanged commercial amounts';
END $$;
DO $$
DECLARE l uuid; l2 uuid; c uuid; pub uuid;
BEGIN
 SELECT a.campaign_line_id,b.campaign_line_id,cl.campaign_header_id INTO l,l2,c
 FROM assignment_post_schedule a JOIN campaign_lines cl ON cl.id=a.campaign_line_id
 JOIN campaign_lines cl2 ON cl2.campaign_header_id=cl.campaign_header_id AND cl2.id<>cl.id
 JOIN assignment_post_schedule b ON b.campaign_line_id=cl2.id LIMIT 1;
 IF l2 IS NULL THEN RAISE EXCEPTION 'Need two assignments in a campaign'; END IF;
 PERFORM set_config('app.assignment_live_sync','on',true);
 DELETE FROM campaign_publications cp WHERE publication_assignment_line(cp) IN (l,l2);
 UPDATE campaign_lines SET metadata='{}' WHERE id IN (l,l2);
 UPDATE assignment_post_schedule SET metadata='{}',live_date=NULL,status='draft' WHERE campaign_line_id IN (l,l2);
 UPDATE assignment_deliverables SET metadata='{}',live_date=NULL WHERE campaign_line_id IN (l,l2);
 PERFORM set_config('app.assignment_live_sync','',true);
 INSERT INTO campaign_publications(campaign_header_id,campaign_line_id,publication_date,status)
 VALUES(c,l,'2026-08-05 12:00:00+00','draft') RETURNING id INTO pub;
 UPDATE campaign_publications SET campaign_line_id=l2 WHERE id=pub;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND live_date IS NOT NULL) THEN RAISE EXCEPTION 'Moving publication left old assignment live'; END IF;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l2 AND live_date IS NULL) THEN RAISE EXCEPTION 'Moving publication failed to mark new assignment live'; END IF;
 UPDATE campaign_publications SET publication_date='2099-08-05' WHERE id=pub;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l2 AND live_date IS NOT NULL) THEN RAISE EXCEPTION 'Future evidence incorrectly recognizes revenue'; END IF;
 RAISE NOTICE 'PASS: moving publication reconciles both assignments; future evidence clears live state';
END $$;
ROLLBACK;
