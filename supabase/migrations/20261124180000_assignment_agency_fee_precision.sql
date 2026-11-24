-- Preserve six decimal places for assignment AF rates, retaining the previous
-- four-digit integer capacity. Monetary amounts keep their existing precision.
BEGIN;

-- PostgreSQL requires removing the column-specific PO sync trigger while
-- widening the column. Restore its exact definition and enabled state within
-- the same locked transaction; no rows or document numbers are changed.
LOCK TABLE public.campaign_lines IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE
  trigger_definition text;
  trigger_enabled "char";
  view_definition text;
  view_owner text;
  view_options text;
  view_comment text;
  view_grants jsonb;
  grant_entry jsonb;
BEGIN
  SELECT pg_get_viewdef(c.oid), pg_get_userbyid(c.relowner),
      array_to_string(c.reloptions, ', '), obj_description(c.oid),
      (SELECT jsonb_agg(jsonb_build_object(
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
        'privilege', a.privilege_type, 'grantable', a.is_grantable))
       FROM aclexplode(c.relacl) a)
    INTO STRICT view_definition, view_owner, view_options, view_comment, view_grants
    FROM pg_class c WHERE c.oid = 'public.campaign_fx_po_totals'::regclass;

  SELECT pg_get_triggerdef(oid), tgenabled
    INTO STRICT trigger_definition, trigger_enabled
    FROM pg_trigger
    WHERE tgrelid = 'public.campaign_lines'::regclass
      AND tgname = 'sync_header_po_on_line_change';

  DROP TRIGGER sync_header_po_on_line_change ON public.campaign_lines;
  DROP VIEW public.campaign_fx_po_totals;
  ALTER TABLE public.campaign_lines
    ALTER COLUMN agency_fee_percent TYPE numeric(10, 6);
  EXECUTE 'CREATE VIEW public.campaign_fx_po_totals'
    || CASE WHEN view_options IS NULL THEN '' ELSE ' WITH (' || view_options || ')' END
    || ' AS ' || view_definition;
  -- Clear default grants before restoring the original ACL.
  REVOKE ALL ON public.campaign_fx_po_totals FROM PUBLIC, anon, authenticated, service_role;
  FOR grant_entry IN SELECT value FROM jsonb_array_elements(view_grants) LOOP
    EXECUTE 'GRANT ' || (grant_entry->>'privilege')
      || ' ON public.campaign_fx_po_totals TO ' || (grant_entry->>'grantee')
      || CASE WHEN (grant_entry->>'grantable')::boolean THEN ' WITH GRANT OPTION' ELSE '' END;
  END LOOP;
  EXECUTE format('ALTER VIEW public.campaign_fx_po_totals OWNER TO %I', view_owner);
  EXECUTE format('COMMENT ON VIEW public.campaign_fx_po_totals IS %L', view_comment);
  EXECUTE trigger_definition;
  IF trigger_enabled = 'D' THEN
    ALTER TABLE public.campaign_lines DISABLE TRIGGER sync_header_po_on_line_change;
  ELSIF trigger_enabled = 'R' THEN
    ALTER TABLE public.campaign_lines ENABLE REPLICA TRIGGER sync_header_po_on_line_change;
  ELSIF trigger_enabled = 'A' THEN
    ALTER TABLE public.campaign_lines ENABLE ALWAYS TRIGGER sync_header_po_on_line_change;
  END IF;
END $$;

ALTER TABLE public.assignment_deliverables
  ALTER COLUMN agency_fee_percent TYPE numeric(10, 6);

COMMIT;
