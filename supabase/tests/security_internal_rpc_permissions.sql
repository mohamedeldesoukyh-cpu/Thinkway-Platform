-- Run on dev after applying the security migration. No fixture data is modified.
BEGIN;
DO $check$
BEGIN
 IF has_function_privilege('anon', 'public.send_client_io(uuid,uuid)', 'EXECUTE') OR
    has_function_privilege('anon', 'public.send_vendor_io(uuid,uuid)', 'EXECUTE') OR
    has_function_privilege('anon', 'public.recalculate_invoice_totals(uuid)', 'EXECUTE') OR
    has_function_privilege('anon', 'public.apply_campaign_advances(uuid)', 'EXECUTE') OR
    has_function_privilege('anon', 'public.settle_collection_advance_internal(uuid,uuid,numeric,integer)', 'EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous mutation privilege remains';
 END IF;
 IF NOT has_function_privilege('service_role','public.next_document_number(text,integer)','EXECUTE') OR
    NOT has_function_privilege('authenticated','public.send_vendor_io(uuid,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Expected caller privilege missing';
 END IF;
END $check$;
SET LOCAL ROLE anon;
DO $test$
BEGIN
 BEGIN
  PERFORM public.send_vendor_io('00000000-0000-0000-0000-000000000000'::uuid,NULL::uuid);
  RAISE EXCEPTION 'Anonymous send unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
DO $test$
BEGIN
 BEGIN
  PERFORM public.send_client_io('00000000-0000-0000-0000-000000000000'::uuid,NULL::uuid);
  RAISE EXCEPTION 'Unauthenticated identity unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.recalculate_invoice_totals('00000000-0000-0000-0000-000000000000'::uuid);
  RAISE EXCEPTION 'Unauthorized recalculate unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: permission denial checks passed; test transaction rolled back' result;

