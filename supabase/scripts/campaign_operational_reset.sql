-- =============================================================================
-- THINKWAY — Campaign operational reset (single campaign only)
--
-- Removes transactional operational data for ONE campaign, then deletes the
-- campaign header. Does NOT touch: clients, vendors, influencers, currencies,
-- FX, users, or global settings.
--
-- Run in Supabase SQL Editor as postgres / service role.
-- Step 1: Run PREFLIGHT only (v_execute := 0)
-- Step 2: Set v_execute := 1 and run again to delete
-- =============================================================================

DO $$
DECLARE
  -- >>> CONFIGURE ---------------------------------------------------------------
  v_campaign_document_number text := 'TW-2026-0003'; -- or NULL
  v_campaign_name_pattern text := NULL;              -- e.g. '%Arab bank%event%'
  v_execute int := 0;                                -- 0 = preflight, 1 = DELETE
  -- -----------------------------------------------------------------------------

  v_header_id uuid;
  v_header_name text;
  v_header_doc text;
  v_line_ids uuid[];
  v_invoice_ids uuid[];
  v_vio_ids uuid[];
  v_deliverable_ids uuid[];
  v_influencer_ids uuid[];
  v_count int;
BEGIN
  IF v_campaign_document_number IS NOT NULL AND btrim(v_campaign_document_number) <> '' THEN
    SELECT id, name, document_number
    INTO v_header_id, v_header_name, v_header_doc
    FROM public.campaign_headers
    WHERE document_number = btrim(v_campaign_document_number)
    LIMIT 1;
  ELSIF v_campaign_name_pattern IS NOT NULL THEN
    SELECT id, name, document_number
    INTO v_header_id, v_header_name, v_header_doc
    FROM public.campaign_headers
    WHERE name ILIKE v_campaign_name_pattern
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Set v_campaign_document_number or v_campaign_name_pattern.';
  END IF;

  IF v_header_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_line_ids
  FROM public.campaign_lines WHERE campaign_header_id = v_header_id;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_invoice_ids
  FROM public.invoices
  WHERE campaign_header_id = v_header_id OR campaign_id = v_header_id;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_vio_ids
  FROM public.vendor_ios WHERE campaign_header_id = v_header_id;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_deliverable_ids
  FROM public.assignment_deliverables WHERE campaign_header_id = v_header_id;

  SELECT coalesce(array_agg(DISTINCT influencer_id), ARRAY[]::uuid[]) INTO v_influencer_ids
  FROM public.campaign_influencers WHERE campaign_header_id = v_header_id;

  RAISE NOTICE '=== PREFLIGHT ===';
  RAISE NOTICE 'Campaign: % (%) id=%', v_header_name, v_header_doc, v_header_id;
  RAISE NOTICE 'campaign_lines=%', cardinality(v_line_ids);
  RAISE NOTICE 'invoices=%', cardinality(v_invoice_ids);
  RAISE NOTICE 'vendor_ios=%', cardinality(v_vio_ids);
  RAISE NOTICE 'assignment_deliverables=%', cardinality(v_deliverable_ids);
  RAISE NOTICE 'campaign_influencers (vendor rows)=%', cardinality(v_influencer_ids);
  RAISE NOTICE 'Influencer master rows are NOT deleted (ids linked: %)', v_influencer_ids;

  IF v_execute <> 1 THEN
    RAISE NOTICE 'No deletes (v_execute=0). Set v_execute := 1 and re-run to delete.';
    RETURN;
  END IF;

  RAISE NOTICE '=== EXECUTING DELETE ===';

  DELETE FROM public.campaign_publications WHERE campaign_header_id = v_header_id;

  IF cardinality(v_line_ids) > 0 THEN
    DELETE FROM public.assignment_post_schedule WHERE campaign_line_id = ANY (v_line_ids);
  END IF;

  IF cardinality(v_invoice_ids) > 0 THEN
    DELETE FROM public.payments WHERE invoice_id = ANY (v_invoice_ids);
    DELETE FROM public.invoice_versions WHERE invoice_id = ANY (v_invoice_ids);
    DELETE FROM public.collection_audit_logs
    WHERE entity_type = 'invoice' AND entity_id = ANY (v_invoice_ids);
    DELETE FROM public.finance_override_logs
    WHERE entity_type = 'invoice' AND entity_id = ANY (v_invoice_ids);
    DELETE FROM public.invoice_line_items WHERE invoice_id = ANY (v_invoice_ids);
    DELETE FROM public.invoices WHERE id = ANY (v_invoice_ids);
  END IF;

  IF cardinality(v_line_ids) > 0 THEN
    DELETE FROM public.finance_override_logs
    WHERE entity_type IN ('campaign_line', 'campaign_lines')
      AND entity_id = ANY (v_line_ids);
  END IF;

  DELETE FROM public.audit_logs
  WHERE (entity_type IN ('campaign_headers', 'campaign') AND entity_id = v_header_id)
     OR (entity_type IN ('campaign_lines', 'campaign_line') AND entity_id = ANY (v_line_ids))
     OR (entity_type IN ('assignment_deliverables', 'deliverable')
         AND entity_id = ANY (v_deliverable_ids))
     OR (entity_type IN ('vendor_ios', 'vendor_io') AND entity_id = ANY (v_vio_ids));

  DELETE FROM public.approvals
  WHERE (entity_type = 'campaign' AND entity_id = v_header_id)
     OR (entity_type = 'campaign_influencer' AND entity_id IN (
       SELECT id FROM public.campaign_influencers WHERE campaign_header_id = v_header_id
     ))
     OR (entity_type = 'deliverable' AND entity_id IN (
       SELECT id FROM public.deliverables WHERE campaign_id = v_header_id
     ))
     OR (entity_type = 'invoice' AND entity_id = ANY (v_invoice_ids));

  DELETE FROM public.deliverables WHERE campaign_id = v_header_id;

  IF cardinality(v_line_ids) > 0 THEN
    UPDATE public.campaign_lines SET vendor_io_id = NULL WHERE id = ANY (v_line_ids);
    DELETE FROM public.vendor_io_lines WHERE campaign_line_id = ANY (v_line_ids);
  END IF;

  IF cardinality(v_vio_ids) > 0 THEN
    UPDATE public.vendor_ios SET replaces_vendor_io_id = NULL
    WHERE replaces_vendor_io_id = ANY (v_vio_ids);
    DELETE FROM public.vendor_ios WHERE campaign_header_id = v_header_id;
  END IF;

  DELETE FROM public.movement_items WHERE campaign_header_id = v_header_id;
  DELETE FROM public.budget_lines WHERE campaign_header_id = v_header_id;
  DELETE FROM public.assignment_deliverables WHERE campaign_header_id = v_header_id;
  DELETE FROM public.campaign_influencers WHERE campaign_header_id = v_header_id;
  DELETE FROM public.campaign_lines WHERE campaign_header_id = v_header_id;
  DELETE FROM public.client_ios WHERE campaign_header_id = v_header_id;
  DELETE FROM public.campaign_members WHERE campaign_header_id = v_header_id;

  DELETE FROM public.campaign_headers WHERE id = v_header_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Done. campaign_headers deleted: %', v_count;

  -- Reseed TW-YYYY counter so next campaign fills gaps left by invalid bootstrap deletes.
  IF v_count > 0 AND v_header_doc ~ '^TW-(\d{4})-\d+$' THEN
    PERFORM public.reseed_thinkway_campaign_sequence(
      (regexp_match(v_header_doc, '^TW-(\d{4})-'))[1]::integer,
      false
    );
    RAISE NOTICE 'Reseeded document_sequences for deleted campaign year.';
  END IF;
END $$;

-- Optional: list remaining campaigns after reset
-- SELECT document_number, name, created_at FROM public.campaign_headers ORDER BY created_at DESC;
