-- Run against development only. All fixture changes and payments are rolled back.
BEGIN;
DO $$
DECLARE actor uuid; v record; batch uuid:=gen_random_uuid(); entry uuid; second_batch uuid:=gen_random_uuid(); payload jsonb; status text; total numeric;
BEGIN
  SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug IN ('admin','super_admin') AND p.is_active LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No development admin fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  SELECT vi.*,a.currency INTO v FROM vendor_ios vi JOIN campaign_influencers a ON a.id=vi.assignment_id
   WHERE vi.document_generated_at IS NOT NULL AND NOT vi.is_superseded AND vi.status NOT IN ('rejected','cancelled') AND a.vendor_payment_status='unpaid'
   AND NOT EXISTS(SELECT 1 FROM creator_payment_entries e WHERE e.assignment_id=a.id) LIMIT 1;
  IF v.id IS NULL THEN RAISE EXCEPTION 'No development generated IO fixture'; END IF;
  UPDATE influencers SET payment_details=jsonb_build_object('aaib_nickname','TEST'||replace(batch::text,'-',''),'aaib_currency',v.currency,'aaib_registered',true) WHERE id=v.influencer_id;
  -- Registration can be invalidated by a pre-existing nickname; confirm in a separate edit.
  UPDATE influencers SET payment_details=jsonb_set(payment_details,'{aaib_registered}','true') WHERE id=v.influencer_id;
  payload:=jsonb_build_array(jsonb_build_object('assignmentId',v.assignment_id,'ioId',v.id,'creator','Test creator','fee',1000,'vat',14,'currency',v.currency,'rate',1,'amount',570,'nickname','TEST'||replace(batch::text,'-','')));
  PERFORM create_creator_payment_export(batch,v.campaign_header_id,current_date,'test csv',payload);
  PERFORM create_creator_payment_export(batch,v.campaign_header_id,current_date,'test csv',payload);
  IF (SELECT count(*) FROM creator_payment_entries WHERE batch_id=batch)<>1 THEN RAISE EXCEPTION 'Idempotency failed'; END IF;
  SELECT id INTO entry FROM creator_payment_entries WHERE batch_id=batch;
  SELECT vendor_payment_status::text INTO status FROM campaign_influencers WHERE id=v.assignment_id;
  IF status<>'unpaid' THEN RAISE EXCEPTION 'Export marked payment as paid'; END IF;
  BEGIN
    PERFORM create_creator_payment_export(gen_random_uuid(),v.campaign_header_id,current_date,'overpay',jsonb_set(payload,'{0,amount}','600'));
    RAISE EXCEPTION 'overpayment accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='overpayment accepted' OR SQLERRM NOT LIKE 'Payment exceeds%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM create_creator_payment_export(gen_random_uuid(),v.campaign_header_id,current_date,'change terms',jsonb_set(payload,'{0,fee}','2000'));
    RAISE EXCEPTION 'pending terms changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='pending terms changed' OR SQLERRM NOT LIKE 'Confirm pending%' THEN RAISE; END IF; END;
  PERFORM confirm_creator_payment(entry,'paid','TEST-PAID');
  PERFORM confirm_creator_payment(entry,'paid','TEST-PAID');
  SELECT vendor_payment_status::text INTO status FROM campaign_influencers WHERE id=v.assignment_id;
  IF status<>'pending' THEN RAISE EXCEPTION 'Partial payment status failed'; END IF;
  SELECT paid INTO total FROM creator_payment_balances WHERE assignment_id=v.assignment_id;
  IF total<>570 THEN RAISE EXCEPTION 'Partial ledger total failed'; END IF;
  PERFORM create_creator_payment_export(second_batch,v.campaign_header_id,current_date,'second csv',payload);
  SELECT id INTO entry FROM creator_payment_entries WHERE batch_id=second_batch;
  PERFORM confirm_creator_payment(entry,'failed','TEST-REJECTED');
  IF (SELECT reserved FROM creator_payment_balances WHERE assignment_id=v.assignment_id)<>0 THEN RAISE EXCEPTION 'Failed payment reservation not released'; END IF;
  second_batch:=gen_random_uuid();
  PERFORM create_creator_payment_export(second_batch,v.campaign_header_id,current_date,'retry csv',payload);
  SELECT id INTO entry FROM creator_payment_entries WHERE batch_id=second_batch;
  PERFORM confirm_creator_payment(entry,'paid','TEST-FINAL');
  SELECT vendor_payment_status::text INTO status FROM campaign_influencers WHERE id=v.assignment_id;
  IF status<>'paid' THEN RAISE EXCEPTION 'Full payment status failed'; END IF;
  BEGIN
    PERFORM confirm_creator_payment(entry,'failed','wrong change');
    RAISE EXCEPTION 'confirmed result changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='confirmed result changed' OR SQLERRM NOT LIKE 'This result has already%' THEN RAISE; END IF; END;
  UPDATE influencers SET payment_details=jsonb_set(payment_details,'{account_number}','"changed"') WHERE id=v.influencer_id;
  IF (SELECT payment_details->>'aaib_registered' FROM influencers WHERE id=v.influencer_id)<>'false' THEN RAISE EXCEPTION 'Registration was not invalidated'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  BEGIN
    PERFORM confirm_creator_payment(entry,'paid','no auth');
    RAISE EXCEPTION 'Unauthorized result accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unauthorized result accepted' OR SQLERRM NOT LIKE 'Finance access required%' THEN RAISE; END IF; END;
  RAISE NOTICE 'PASS: VAT, installments, reservations, idempotency, failed retry, full status, immutable confirmations, bank invalidation, authorization';
END $$;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM creator_payment_entries) THEN RAISE EXCEPTION 'RLS exposed payment entries without an actor'; END IF;
  IF has_table_privilege(current_user,'public.creator_payment_entries','INSERT') THEN RAISE EXCEPTION 'Direct ledger inserts are allowed'; END IF;
  RAISE NOTICE 'PASS: ledger RLS and direct-write restriction';
END $$;
ROLLBACK;
