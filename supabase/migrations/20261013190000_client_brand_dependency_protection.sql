BEGIN;

-- Check all inbound foreign keys, including SET NULL and CASCADE relations.
-- Definer access is limited to this trigger so RLS-hidden dependencies still block
-- a destructive change. No dependency contents or counts are returned to callers.
CREATE OR REPLACE FUNCTION public.guard_client_entity_dependencies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; used boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN RETURN NEW; END IF;
  END IF;
  FOR r IN
    SELECT c.conrelid, c.conrelid::regclass AS child_table,
           cardinality(c.conkey) AS key_count, a.attname AS child_column
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid=TG_RELID
    ORDER BY c.conrelid,c.oid
  LOOP
    -- Serialize this rare administrative operation against concurrent child writes.
    -- Without this, a dependency could be inserted between the check and reparenting.
    EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE', r.child_table);
    IF r.key_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Linked-record validation requires review.';
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I=$1)',r.child_table,r.child_column)
      INTO used USING OLD.id;
    IF used THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Linked records prevent deletion or client reassignment. Reassign or remove dependencies through their own workflows first.';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_client_entity_dependencies() FROM PUBLIC;

CREATE TRIGGER protect_brand_dependencies
BEFORE DELETE OR UPDATE OF client_id ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.guard_client_entity_dependencies();
CREATE TRIGGER protect_client_dependencies
BEFORE DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.guard_client_entity_dependencies();

-- Invoker rights preserve existing RLS. A typed confirmation and exact original
-- client prevent stale forms from deleting/moving a changed record.
CREATE OR REPLACE FUNCTION public.delete_unused_client_entity(p_kind text,p_id uuid,p_confirmation text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
SET lock_timeout='3s' SET statement_timeout='10s' AS $$
DECLARE deleted_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_internal_user(),false)
     OR NOT coalesce(public.has_permission('clients.write'),false)
     OR (public.get_user_role_slug() IN ('super_admin','admin','finance') AND coalesce(auth.jwt()->>'aal','')<>'aal2') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Not authorized';
  END IF;
  IF p_kind='brand' THEN
    DELETE FROM public.brands WHERE id=p_id AND name=p_confirmation
      AND public.can_access_client(client_id) RETURNING id INTO deleted_id;
  ELSIF p_kind='client' THEN
    DELETE FROM public.clients WHERE id=p_id AND name=p_confirmation
      AND public.can_access_client(id) RETURNING id INTO deleted_id;
  ELSE
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid entity type';
  END IF;
  RETURN deleted_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.delete_unused_client_entity(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_unused_client_entity(text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_unused_brand_client(p_id uuid,p_previous_client_id uuid,p_client_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
SET lock_timeout='3s' SET statement_timeout='10s' AS $$
DECLARE moved_id uuid; destination_group uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_internal_user(),false)
     OR NOT coalesce(public.has_permission('clients.write'),false)
     OR (public.get_user_role_slug() IN ('super_admin','admin','finance') AND coalesce(auth.jwt()->>'aal','')<>'aal2')
     OR NOT coalesce(public.can_access_client(p_previous_client_id),false)
     OR NOT coalesce(public.can_access_client(p_client_id),false) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Not authorized';
  END IF;
  IF p_client_id IS NULL OR p_client_id=p_previous_client_id THEN RETURN false; END IF;
  SELECT group_id INTO destination_group FROM public.clients
    WHERE id=p_client_id AND status <> 'archived' FOR KEY SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.brands destination JOIN public.brands source
    ON lower(trim(destination.name))=lower(trim(source.name))
    WHERE source.id=p_id AND destination.client_id=p_client_id AND destination.id<>p_id) THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Duplicate brand for destination client';
  END IF;
  UPDATE public.brands SET client_id=p_client_id,group_id=destination_group
    WHERE id=p_id AND client_id=p_previous_client_id RETURNING id INTO moved_id;
  RETURN moved_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.move_unused_brand_client(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_unused_brand_client(uuid,uuid,uuid) TO authenticated;
COMMIT;
