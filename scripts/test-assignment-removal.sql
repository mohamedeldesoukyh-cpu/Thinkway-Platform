-- Run with scripts/psql-development.mjs. All fixtures and schema changes roll back.
BEGIN;
\ir ../supabase/migrations/20260930110000_remove_campaign_assignment.sql
DO $$
DECLARE
  actor uuid; campaign uuid := gen_random_uuid(); line uuid := gen_random_uuid();
  other_line uuid := gen_random_uuid(); cio uuid := gen_random_uuid();
  client uuid; brand uuid; original jsonb := '{"version":1,"lines":[{"name":"Original creator"}]}'::jsonb;
  before_total numeric; after_total numeric;
BEGIN
  SELECT p.id INTO actor FROM public.profiles p
    JOIN public.roles r ON r.id=p.role_id WHERE p.is_active AND r.slug IN ('admin','super_admin') LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Test needs a development admin'; END IF;
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  SELECT client_id, brand_id INTO client, brand FROM public.campaign_headers LIMIT 1;
  INSERT INTO public.campaign_headers(id,document_number,name,client_id,brand_id,created_by,currency_code)
    VALUES(campaign,'TEST-REMOVE-'||campaign,'Rollback removal test',client,brand,actor,'EGP');
  INSERT INTO public.campaign_lines(id,campaign_header_id,document_number,name,currency_code,revenue,revenue_before_vat,cost,cost_before_vat)
    VALUES(line,campaign,'TEST-LINE-'||line,'Old creator','EGP',100,100,50,50),
          (other_line,campaign,'TEST-LINE-'||other_line,'Remaining creator','EGP',200,200,80,80);
  INSERT INTO public.client_ios(id,campaign_header_id,client_id,status,assignment_snapshot,created_by)
    VALUES(cio,campaign,client,'approved',original,actor);
  INSERT INTO public.client_io_assignments(client_io_id,campaign_line_id) VALUES(cio,line),(cio,other_line);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT po_consumed INTO before_total FROM public.campaign_fx_po_totals WHERE campaign_header_id=campaign;

  BEGIN
    PERFORM public.remove_campaign_assignment(campaign,line,'');
    RAISE EXCEPTION 'TEST FAILED: missing reason accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Enter a reason%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.remove_campaign_assignment(campaign,line,'Wrong creator');
    RAISE EXCEPTION 'TEST FAILED: anonymous removal accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'You do not have permission%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  BEGIN
    PERFORM public.remove_campaign_assignment(gen_random_uuid(),line,'Wrong creator');
    RAISE EXCEPTION 'TEST FAILED: wrong campaign accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Assignment not found%' AND SQLERRM NOT LIKE 'You do not have permission%' THEN RAISE; END IF; END;
  UPDATE public.campaign_lines SET billing_status='moved_to_billing' WHERE id=line;
  BEGIN
    PERFORM public.remove_campaign_assignment(campaign,line,'Wrong creator');
    RAISE EXCEPTION 'TEST FAILED: billing guard bypassed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'This assignment has billing%' THEN RAISE; END IF; END;
  UPDATE public.campaign_lines SET billing_status='draft' WHERE id=line;
  UPDATE public.client_ios SET assignment_snapshot=NULL WHERE id=cio;
  BEGIN
    PERFORM public.remove_campaign_assignment(campaign,line,'Wrong creator');
    RAISE EXCEPTION 'TEST FAILED: missing historical snapshot accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'The existing Client IO has no frozen%' THEN RAISE; END IF; END;
  IF (SELECT status FROM public.client_ios WHERE id=cio) <> 'approved'
    OR (SELECT status FROM public.campaign_lines WHERE id=line) = 'cancelled' THEN
    RAISE EXCEPTION 'TEST FAILED: failed removal partially changed IO or assignment';
  END IF;
  UPDATE public.client_ios SET assignment_snapshot=original WHERE id=cio;
  PERFORM public.remove_campaign_assignment(campaign,line,'Wrong creator selected');
  IF NOT EXISTS(SELECT 1 FROM public.campaign_lines WHERE id=line AND status='cancelled' AND revenue=100 AND cost=50)
    THEN RAISE EXCEPTION 'TEST FAILED: line/history not retained'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.client_ios WHERE id=cio AND status='revision_required' AND assignment_snapshot=original)
    THEN RAISE EXCEPTION 'TEST FAILED: approved snapshot changed or revision missing'; END IF;
  IF (SELECT count(*) FROM public.client_io_assignments WHERE client_io_id=cio) <> 2
    THEN RAISE EXCEPTION 'TEST FAILED: historical IO composition changed'; END IF;
  IF (SELECT count(*) FROM public.document_lifecycle_reactions WHERE document_id=cio AND from_status='approved' AND reason_code='creator_removed') <> 1
    THEN RAISE EXCEPTION 'TEST FAILED: approval transition history missing'; END IF;
  SELECT po_consumed INTO after_total FROM public.campaign_fx_po_totals WHERE campaign_header_id=campaign;
  IF before_total-after_total <> 100 THEN RAISE EXCEPTION 'TEST FAILED: active totals still include removed creator'; END IF;
  PERFORM public.remove_campaign_assignment(campaign,line,'Repeated click');
  IF (SELECT count(*) FROM public.business_change_events WHERE entity_id=line AND event_type='creator_removed') <> 1
    THEN RAISE EXCEPTION 'TEST FAILED: repeat removal not idempotent'; END IF;
  BEGIN
    UPDATE public.campaign_lines SET revenue_before_vat=999, revenue=999 WHERE id=line;
    RAISE EXCEPTION 'TEST FAILED: stale edit accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'This assignment was removed%' THEN RAISE; END IF; END;
  RAISE NOTICE 'PASS: authorization, campaign scope, reason, billing guard, soft removal, IO snapshot/junction preservation, revision audit, active totals, idempotency, stale editor';
END $$;


ROLLBACK;
