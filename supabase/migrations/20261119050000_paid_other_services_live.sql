BEGIN;

CREATE TABLE IF NOT EXISTS public.paid_other_service_live_backup (
 assignment_id uuid PRIMARY KEY, captured_at timestamptz NOT NULL DEFAULT now(),
 line jsonb NOT NULL, schedules jsonb, deliverables jsonb
);
ALTER TABLE public.paid_other_service_live_backup ENABLE ROW LEVEL SECURITY;

-- Other services have no social publication. Confirmed settlement is their
-- completion event; reuse the same live-state and recognition pipeline.
CREATE OR REPLACE FUNCTION public.complete_paid_other_service(p_assignment uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; completed date;
BEGIN
 SELECT i.*,l.metadata AS line_metadata INTO a
 FROM campaign_influencers i JOIN campaign_lines l ON l.id=i.campaign_line_id
 WHERE i.id=p_assignment;
 IF NOT FOUND OR a.vendor_payment_status::text <> 'paid' THEN RETURN; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(a.line_metadata->'influencer_assignment'->'platforms','[]'::jsonb)) p
   WHERE p->>'platform'='other' AND p->'deliverables' ? 'other_service'
 ) THEN RETURN; END IF;
 -- An existing manual/publication completion date remains authoritative.
 IF a.line_metadata->>'went_live'='true' THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM creator_payment_cost_holds WHERE assignment_id=a.id) THEN RETURN; END IF;
 SELECT max(coalesce(payment_date,(confirmed_at AT TIME ZONE 'Africa/Cairo')::date)) INTO completed
 FROM creator_payment_entries WHERE assignment_id=a.id AND status='paid' AND cleared_at IS NULL;
 completed:=coalesce(completed,(a.vendor_paid_at AT TIME ZONE 'Africa/Cairo')::date);
 IF completed IS NULL OR completed>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RETURN; END IF;
 INSERT INTO paid_other_service_live_backup(assignment_id,line,schedules,deliverables)
 SELECT a.id,to_jsonb(l),
 (SELECT jsonb_agg(to_jsonb(s)) FROM assignment_post_schedule s WHERE s.campaign_line_id=l.id),
 (SELECT jsonb_agg(to_jsonb(d)) FROM assignment_deliverables d WHERE d.campaign_line_id=l.id)
 FROM campaign_lines l WHERE l.id=a.campaign_line_id ON CONFLICT DO NOTHING;
 PERFORM reconcile_assignment_went_live(a.campaign_line_id,completed);
END $$;
REVOKE ALL ON FUNCTION public.complete_paid_other_service(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.complete_paid_other_service_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM complete_paid_other_service(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.complete_paid_other_service_trigger() FROM PUBLIC;
DROP TRIGGER IF EXISTS complete_paid_other_service ON public.campaign_influencers;
CREATE TRIGGER complete_paid_other_service AFTER UPDATE OF vendor_payment_status,vendor_paid_at
 ON public.campaign_influencers FOR EACH ROW
 WHEN (NEW.vendor_payment_status::text='paid') EXECUTE FUNCTION public.complete_paid_other_service_trigger();

-- Reconcile existing paid services too. The standard reconciler snapshots each
-- affected line/deliverable/schedule before changing it; no payments or IOs change.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT id FROM campaign_influencers WHERE vendor_payment_status::text='paid' LOOP
  PERFORM complete_paid_other_service(r.id);
 END LOOP;
END $$;
COMMIT;

