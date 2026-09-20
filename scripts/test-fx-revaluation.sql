-- Development integration test. All fixture/rate changes are rolled back.
BEGIN;
DO $$
DECLARE v_user uuid; v_draft uuid; v_issued uuid; v_item uuid; v_before jsonb;
  v_audits int; v_result jsonb; v_header uuid;
BEGIN
  SELECT p.id INTO v_user FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE r.slug='super_admin' LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Test requires an existing development admin'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SELECT id INTO v_header FROM public.campaign_headers WHERE currency_code='EGP' LIMIT 1;
  UPDATE public.campaign_headers SET po_currency='USD',po_amount_original=100,
    po_amount_campaign_currency=5200,po_exchange_rate=52 WHERE id=v_header;
  INSERT INTO public.quotations(name,issue_date) VALUES('FX regression draft','2026-08-01') RETURNING id INTO v_draft;
  INSERT INTO public.quotation_items(quotation_id,creator_name,cost_currency,cost,revenue,fx_rate_to_egp,cost_egp,revenue_egp)
    VALUES(v_draft,'FX fixture','USD',100,120,52,5200,6240) RETURNING id INTO v_item;
  INSERT INTO public.quotations(name,status,issue_date) VALUES('FX regression approved','approved','2026-08-01') RETURNING id INTO v_issued;
  INSERT INTO public.quotation_items(quotation_id,creator_name,cost_currency,cost,revenue,fx_rate_to_egp,cost_egp,revenue_egp)
    VALUES(v_issued,'FX frozen fixture','USD',100,120,52,5200,6240);
  SELECT jsonb_agg(to_jsonb(i)) INTO v_before FROM public.quotation_items i WHERE quotation_id=v_issued;
  SELECT count(*) INTO v_audits FROM public.fx_rate_audit_logs;
  v_result:=public.save_exchange_rate(jsonb_build_object('from_currency','USD','to_currency','EGP',
    'exchange_rate',60,'effective_start_date','2026-09-20','apply_mode','override_historical','override_reason','Regression test'));
  ASSERT public.resolve_effective_exchange_rate('USD','EGP','2026-08-01')=60,'historical direct';
  ASSERT public.resolve_effective_exchange_rate('USD','EGP','2020-01-01')=60,'historical coverage';
  ASSERT abs(public.resolve_effective_exchange_rate('EGP','USD','2026-09-20')-1.0/60)<0.00000001,'inverse';
  ASSERT abs(public.resolve_effective_exchange_rate('SAR','EGP','2026-09-20')-60/3.75)<0.000001,'derived SAR follows USD';
  ASSERT abs(public.resolve_effective_exchange_rate('EUR','GBP','2026-09-20')-0.79/0.92)<0.000001,'cross pair';
  ASSERT (SELECT cost_egp=6000 AND revenue_egp=7200 AND fx_rate_to_egp=60 FROM public.quotation_items WHERE id=v_item),'draft refreshed';
  ASSERT (SELECT total_cost_egp=6000 AND total_revenue_egp=7200 AND total_gp_value_egp=1200 FROM public.quotations WHERE id=v_draft),'draft header refreshed';
  ASSERT (SELECT po_amount_campaign_currency=6000 AND po_exchange_rate=60 FROM public.campaign_headers WHERE id=v_header),'stored PO FX refreshed for billing';
  ASSERT v_before=(SELECT jsonb_agg(to_jsonb(i)) FROM public.quotation_items i WHERE quotation_id=v_issued),'approved document unchanged';
  ASSERT (SELECT count(*) FROM public.fx_rate_audit_logs)=v_audits+1,'audit inserted';
  ASSERT (SELECT exchange_rate_id IS NOT NULL AND impacted_record_count>=1 FROM public.fx_rate_audit_logs ORDER BY created_at DESC,id DESC LIMIT 1),'audit linked';
  -- A future rate must not change earlier conversions.
  PERFORM public.save_exchange_rate(jsonb_build_object('from_currency','USD','to_currency','EGP',
    'exchange_rate',70,'effective_start_date','2099-01-01','apply_mode','future'));
  ASSERT public.resolve_effective_exchange_rate('USD','EGP','2026-09-20')=60,'future rate is isolated';
  ASSERT public.resolve_effective_exchange_rate('USD','EGP','2099-01-01')=70,'future rate applies';
  BEGIN
    PERFORM public.resolve_effective_exchange_rate('ZZZ','EGP');
    RAISE EXCEPTION 'Missing rate incorrectly resolved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Missing FX rate:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.save_exchange_rate(jsonb_build_object('from_currency','USD','to_currency','EGP',
      'exchange_rate',1,'effective_start_date','2026-09-20'));
    RAISE EXCEPTION 'Unauthorized save succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'FX regression tests passed; rolling back all fixtures and edits.';
END;
$$;
CREATE FUNCTION pg_temp.reject_fx_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FX audit test failure'; END; $$;
CREATE TRIGGER test_reject_fx_audit BEFORE INSERT ON public.fx_rate_audit_logs
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_fx_audit();
DO $$
DECLARE v_user uuid; v_before numeric;
BEGIN
  SELECT p.id INTO v_user FROM public.profiles p JOIN public.roles r ON r.id=p.role_id WHERE r.slug='super_admin' LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  v_before:=public.resolve_effective_exchange_rate('USD','EGP','2026-09-20');
  BEGIN
    PERFORM public.save_exchange_rate(jsonb_build_object('from_currency','USD','to_currency','EGP',
      'exchange_rate',999,'effective_start_date','2026-09-20','apply_mode','future'));
    RAISE EXCEPTION 'Audit failure was ignored';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'FX audit test failure' THEN RAISE; END IF;
  END;
  ASSERT public.resolve_effective_exchange_rate('USD','EGP','2026-09-20')=v_before,'failed audit must roll back rate';
END; $$;
ROLLBACK;
