-- Match influencer_documents RLS for private certificate files.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_access_influencer_document_object(object_name text, writing boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE influencer_ref uuid;
BEGIN
  IF split_part(object_name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  influencer_ref := split_part(object_name, '/', 1)::uuid;
  RETURN public.has_permission(CASE WHEN writing THEN 'influencers.write' ELSE 'influencers.read' END)
    AND (NOT writing OR public.is_internal_user())
    AND public.can_access_influencer(influencer_ref)
    AND EXISTS (SELECT 1 FROM public.influencers WHERE id = influencer_ref);
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_influencer_document_object(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_influencer_document_object(text, boolean) TO authenticated;

-- Replace legacy dev policies as well, avoiding unsafe UUID casts on malformed paths.
DROP POLICY IF EXISTS influencer_documents_storage_select ON storage.objects;
DROP POLICY IF EXISTS influencer_documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS influencer_documents_storage_update ON storage.objects;
DROP POLICY IF EXISTS influencer_documents_storage_delete ON storage.objects;

DROP POLICY IF EXISTS influencer_document_objects_read ON storage.objects;
CREATE POLICY influencer_document_objects_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'influencer-documents' AND public.can_access_influencer_document_object(name, false));
DROP POLICY IF EXISTS influencer_document_objects_insert ON storage.objects;
CREATE POLICY influencer_document_objects_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'influencer-documents' AND public.can_access_influencer_document_object(name, true));
DROP POLICY IF EXISTS influencer_document_objects_update ON storage.objects;
CREATE POLICY influencer_document_objects_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'influencer-documents' AND public.can_access_influencer_document_object(name, true))
WITH CHECK (bucket_id = 'influencer-documents' AND public.can_access_influencer_document_object(name, true));
DROP POLICY IF EXISTS influencer_document_objects_delete ON storage.objects;
CREATE POLICY influencer_document_objects_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'influencer-documents' AND public.can_access_influencer_document_object(name, true));
COMMIT;


