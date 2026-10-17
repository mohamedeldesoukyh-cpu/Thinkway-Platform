BEGIN;
DO $$
DECLARE actor uuid; version_id uuid; period_id uuid; line_id uuid; failed boolean := false;
BEGIN
  SELECT p.id INTO actor FROM profiles p JOIN roles r ON p.role_id=r.id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No test actor available'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO budget_versions(document_number,name,fiscal_year,currency_code,created_by)
  VALUES('TEST-'||gen_random_uuid(),'Monthly budget rollback test',2026,'EGP',actor) RETURNING id INTO version_id;
  INSERT INTO budget_periods(budget_version_id,period_type,period_key,period_start,period_end)
  VALUES(version_id,'monthly','2026-01','2026-01-01','2026-01-31') RETURNING id INTO period_id;
  INSERT INTO budget_lines(budget_version_id,budget_period_id,currency_code,revenue_budget,cost_budget,gp_budget,margin_budget)
  VALUES(version_id,period_id,'EGP',100,125,-25,-25) RETURNING id INTO line_id;
  UPDATE budget_lines SET cost_budget=150,gp_budget=-50,margin_budget=-50 WHERE id=line_id;
  IF (SELECT gp_budget FROM budget_lines WHERE id=line_id) <> -50 THEN RAISE EXCEPTION 'Edit or negative profit failed'; END IF;
  BEGIN
    INSERT INTO budget_lines(budget_version_id,budget_period_id,revenue_budget,cost_budget) VALUES(version_id,period_id,-1,0);
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Negative revenue accepted'; END IF;
  UPDATE budget_versions SET status='approved' WHERE id=version_id;
  failed := false;
  BEGIN
    UPDATE budget_lines SET revenue_budget=200 WHERE id=line_id;
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF (SELECT revenue_budget FROM budget_lines WHERE id=line_id) <> 100 THEN RAISE EXCEPTION 'Approved budget was editable'; END IF;
  RAISE NOTICE 'Monthly budget create/edit, negative GP, validation and approved lock passed (rolled back)';
END $$;
ROLLBACK;
