\set ON_ERROR_STOP on
BEGIN;
-- Match the Storage API's transaction context for this rollback-only metadata test.
SET LOCAL storage.allow_delete_query = 'true';
SELECT set_config('request.jwt.claim.sub', p.id::text, true)
FROM public.profiles p
WHERE p.is_active AND EXISTS (
  SELECT 1 FROM public.role_permissions rp JOIN public.permissions pm ON pm.id=rp.permission_id
  WHERE rp.role_id=p.role_id AND pm.slug='clients.write'
) LIMIT 1;
SELECT set_config('test.client_document_path', id::text || '/trade_license/rls-qa.pdf', true) FROM public.clients LIMIT 1;
SET LOCAL ROLE authenticated;
DO $$
DECLARE object_id uuid;
BEGIN
  INSERT INTO storage.objects(bucket_id,name) VALUES ('client-documents',current_setting('test.client_document_path')) RETURNING id INTO object_id;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE id=object_id) THEN RAISE EXCEPTION 'Read denied'; END IF;
  UPDATE storage.objects SET metadata='{"qa":true}' WHERE id=object_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Update denied'; END IF;
  DELETE FROM storage.objects WHERE id=object_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delete denied'; END IF;
  IF public.can_access_client_document_object('invalid/trade_license/test.pdf',true) THEN RAISE EXCEPTION 'Invalid path accepted'; END IF;
  IF public.can_access_client_document_object('00000000-0000-0000-0000-000000000000/trade_license/test.pdf',true) THEN RAISE EXCEPTION 'Unknown client accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name) VALUES ('client-documents',current_setting('test.client_document_path'));
    RAISE EXCEPTION 'Unauthorized upload accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF public.can_access_client_document_object(current_setting('test.client_document_path'),false) THEN RAISE EXCEPTION 'Unauthorized read accepted'; END IF;
END $$;
ROLLBACK;
\echo 'Client document storage: authorized CRUD and unauthorized/path guards passed; test rolled back.'
