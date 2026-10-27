-- Match client_documents RLS for private certificate files.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_access_client_document_object(object_name text, writing boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE client_ref uuid;
BEGIN
  IF split_part(object_name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  client_ref := split_part(object_name, '/', 1)::uuid;
  RETURN public.has_permission(CASE WHEN writing THEN 'clients.write' ELSE 'clients.read' END)
    AND public.can_access_client(client_ref)
    AND EXISTS (SELECT 1 FROM public.clients WHERE id = client_ref);
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_client_document_object(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_client_document_object(text, boolean) TO authenticated;

DROP POLICY IF EXISTS client_document_objects_read ON storage.objects;
CREATE POLICY client_document_objects_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND public.can_access_client_document_object(name, false));
DROP POLICY IF EXISTS client_document_objects_insert ON storage.objects;
CREATE POLICY client_document_objects_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents' AND public.can_access_client_document_object(name, true));
DROP POLICY IF EXISTS client_document_objects_update ON storage.objects;
CREATE POLICY client_document_objects_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents' AND public.can_access_client_document_object(name, true))
WITH CHECK (bucket_id = 'client-documents' AND public.can_access_client_document_object(name, true));
DROP POLICY IF EXISTS client_document_objects_delete ON storage.objects;
CREATE POLICY client_document_objects_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents' AND public.can_access_client_document_object(name, true));
COMMIT;
