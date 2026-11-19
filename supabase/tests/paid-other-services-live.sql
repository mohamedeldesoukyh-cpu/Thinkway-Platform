-- Development only: reuse an isolated transactional fixture, roll back all edits.
BEGIN;
DO $$
DECLARE a uuid; l uuid; snapshot jsonb;
BEGIN
 SELECT i.id,i.campaign_line_id INTO a,l FROM campaign_influencers i
 WHERE i.campaign_line_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM creator_payment_entries e WHERE e.assignment_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM creator_payment_cost_holds h WHERE h.assignment_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM campaign_publications p WHERE publication_assignment_line(p)=i.campaign_line_id)
 AND EXISTS(SELECT 1 FROM assignment_post_schedule s WHERE s.campaign_line_id=i.campaign_line_id)
 LIMIT 1;
 IF a IS NULL THEN RAISE EXCEPTION 'No development fixture available'; END IF;
 SELECT to_jsonb(i)-ARRAY['vendor_payment_status','vendor_paid_at','updated_at'] INTO snapshot FROM campaign_influencers i WHERE id=a;
 PERFORM set_config('app.assignment_live_sync','on',true);
 UPDATE assignment_post_schedule SET live_date=NULL,status='approved',metadata='{}' WHERE campaign_line_id=l;
 UPDATE assignment_deliverables SET live_date=NULL,metadata='{}' WHERE campaign_line_id=l;
 PERFORM set_config('app.assignment_live_sync','',true);
 UPDATE campaign_lines SET metadata=(coalesce(metadata,'{}')-ARRAY['went_live','went_live_date','manual_went_live_date'])
 ||'{"influencer_assignment":{"platforms":[{"platform":"other","deliverables":["other_service"]}]}}'::jsonb WHERE id=l;
 UPDATE campaign_influencers SET vendor_payment_status='pending',vendor_paid_at=NULL WHERE id=a;
 IF EXISTS(SELECT 1 FROM campaign_lines WHERE id=l AND metadata->>'went_live'='true') THEN RAISE EXCEPTION 'Partial payment completed service'; END IF;
 UPDATE campaign_influencers SET vendor_payment_status='paid',vendor_paid_at='2026-08-01 12:00:00+00' WHERE id=a;
 IF NOT EXISTS(SELECT 1 FROM campaign_lines WHERE id=l AND metadata->>'went_live'='true' AND metadata->>'went_live_date'='2026-08-01') THEN RAISE EXCEPTION 'Paid service did not complete'; END IF;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l AND (status::text<>'posted' OR live_date IS DISTINCT FROM '2026-08-01'::date)) THEN RAISE EXCEPTION 'Recognition schedule was not updated'; END IF;
 IF snapshot IS DISTINCT FROM (SELECT to_jsonb(i)-ARRAY['vendor_payment_status','vendor_paid_at','updated_at'] FROM campaign_influencers i WHERE id=a) THEN RAISE EXCEPTION 'Commercial values changed'; END IF;
 -- A later settlement update must not overwrite the actual completion date.
 UPDATE campaign_influencers SET vendor_paid_at='2026-08-02 12:00:00+00' WHERE id=a;
 IF NOT EXISTS(SELECT 1 FROM campaign_lines WHERE id=l AND metadata->>'went_live_date'='2026-08-01') THEN RAISE EXCEPTION 'Completion date changed'; END IF;
 -- Ordinary creators do not become live from payment.
 UPDATE campaign_lines SET metadata=(metadata-ARRAY['went_live','went_live_date','manual_went_live_date'])
 ||'{"influencer_assignment":{"platforms":[{"platform":"instagram","deliverables":["instagram_post"]}]}}'::jsonb WHERE id=l;
 UPDATE campaign_influencers SET vendor_paid_at='2026-08-03 12:00:00+00' WHERE id=a;
 IF EXISTS(SELECT 1 FROM campaign_lines WHERE id=l AND metadata->>'went_live'='true') THEN RAISE EXCEPTION 'Creator completed from payment'; END IF;
 RAISE NOTICE 'PASS: partial/paid services, recognition schedule, stable completion date, unchanged commercials, creator exclusion';
END $$;
ROLLBACK;
