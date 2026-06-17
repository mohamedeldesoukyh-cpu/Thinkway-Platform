-- =============================================================================
-- THINKWAY — Full operational reset (ALL campaigns + related transactional data)
--
-- Removes every campaign, assignment, IO, invoice, and related operational row.
-- Does NOT touch: groups, clients, brands, vendors/influencers, master data,
-- users, roles, or the intelligence warehouse schema.
--
-- After delete, document sequences are reset so the next records are:
--   TW-2026-0001, VIO-2026-0001, CIO-2026-0001, INV-2026-00001, etc.
--
-- Run in Supabase SQL Editor as postgres / service role.
--
-- Step 1: v_execute := 0  (preflight counts only)
-- Step 2: v_execute := 1  (DESTRUCTIVE — deletes all operational data)
-- =============================================================================

DO $$
DECLARE
  v_execute int := 0; -- 0 = preflight, 1 = DELETE
  v_year int := 2026;   -- sequence year to reseed (NULL = all years found)
  r record;
BEGIN
  RAISE NOTICE '=== PREFLIGHT (operational counts) ===';

  RAISE NOTICE 'campaign_headers=%',
    (SELECT count(*) FROM public.campaign_headers);
  RAISE NOTICE 'campaign_lines=%',
    (SELECT count(*) FROM public.campaign_lines);
  RAISE NOTICE 'campaign_influencers=%',
    (SELECT count(*) FROM public.campaign_influencers);
  RAISE NOTICE 'assignment_deliverables=%',
    (SELECT count(*) FROM public.assignment_deliverables);
  RAISE NOTICE 'vendor_ios=%',
    (SELECT count(*) FROM public.vendor_ios);
  RAISE NOTICE 'client_ios=%',
    (SELECT count(*) FROM public.client_ios);
  RAISE NOTICE 'invoices=%',
    (SELECT count(*) FROM public.invoices);
  RAISE NOTICE 'finance_documents (campaign-linked)=%',
    (SELECT count(*) FROM public.finance_documents
     WHERE campaign_header_id IS NOT NULL
        OR source_table IN ('invoices', 'vendor_ios', 'client_ios'));
  RAISE NOTICE 'movement_items=%',
    (SELECT count(*) FROM public.movement_items);
  RAISE NOTICE 'po_governance_logs=%',
    (SELECT count(*) FROM public.po_governance_logs);

  RAISE NOTICE '--- document_sequences (before) ---';
  FOR r IN
    SELECT prefix, last_value
    FROM public.document_sequences
    WHERE prefix ~ '^(TW|VIO|CIO|INV|MOV)-'
    ORDER BY prefix
  LOOP
    RAISE NOTICE '  % = %', r.prefix, r.last_value;
  END LOOP;

  IF v_execute <> 1 THEN
    RAISE NOTICE 'No deletes (v_execute=0). Set v_execute := 1 and re-run to wipe all campaigns.';
    RETURN;
  END IF;

  RAISE NOTICE '=== EXECUTING FULL DELETE ===';

  -- IO notifications (no FK to IO tables)
  DELETE FROM public.io_notifications
  WHERE io_type IN ('client', 'vendor');

  -- Finance document graph (campaign / invoice / IO sourced)
  DELETE FROM public.finance_document_links fdl
  WHERE fdl.source_document_id IN (
      SELECT id FROM public.finance_documents fd
      WHERE fd.campaign_header_id IS NOT NULL
         OR fd.source_table IN ('invoices', 'vendor_ios', 'client_ios')
    )
    OR fdl.target_document_id IN (
      SELECT id FROM public.finance_documents fd
      WHERE fd.campaign_header_id IS NOT NULL
         OR fd.source_table IN ('invoices', 'vendor_ios', 'client_ios')
    );

  DELETE FROM public.finance_documents
  WHERE campaign_header_id IS NOT NULL
     OR source_table IN ('invoices', 'vendor_ios', 'client_ios');

  -- Clear line billing links before invoice delete (check constraints on billing_status)
  UPDATE public.assignment_deliverables
  SET invoice_line_item_id = NULL,
      billing_status = 'draft',
      invoiced_amount = 0,
      collected_amount = 0,
      remaining_amount = billable_amount,
      invoiced_at = NULL,
      locked_at = NULL;

  UPDATE public.assignment_post_schedule
  SET invoice_line_item_id = NULL,
      invoiced_amount = 0,
      collected_amount = 0,
      remaining_amount = billable_amount,
      invoiced_at = NULL,
      locked_at = NULL;

  UPDATE public.campaign_lines
  SET invoice_id = NULL,
      vendor_io_id = NULL,
      billing_status = 'draft',
      operational_status = 'draft',
      assignment_status = 'draft';

  -- Invoices & collections
  DELETE FROM public.payments WHERE invoice_id IS NOT NULL;
  DELETE FROM public.invoice_versions;
  DELETE FROM public.collection_audit_logs WHERE entity_type = 'invoice';
  DELETE FROM public.finance_override_logs WHERE entity_type = 'invoice';
  DELETE FROM public.invoice_line_items;
  DELETE FROM public.invoices;

  -- Approvals (all operational approval rows)
  DELETE FROM public.approval_steps;
  DELETE FROM public.approvals;

  -- Publications & post schedules
  DELETE FROM public.assignment_post_schedule;
  DELETE FROM public.campaign_publications;

  -- Vendor IO chain
  UPDATE public.vendor_ios SET replaces_vendor_io_id = NULL
  WHERE replaces_vendor_io_id IS NOT NULL;
  UPDATE public.campaign_lines SET vendor_io_id = NULL WHERE vendor_io_id IS NOT NULL;
  DELETE FROM public.vendor_io_lines;
  DELETE FROM public.vendor_ios;

  -- Movement batches block header delete (RESTRICT)
  DELETE FROM public.movement_items;
  DELETE FROM public.reassignment_logs WHERE batch_id IS NOT NULL;
  DELETE FROM public.movement_batches;

  -- Budget lines linked to campaigns
  DELETE FROM public.budget_lines WHERE campaign_header_id IS NOT NULL;

  -- Legacy deliverables table (if present)
  DELETE FROM public.deliverables WHERE campaign_id IS NOT NULL;

  -- Assignment commercial rows
  DELETE FROM public.assignment_deliverables;

  -- Overrides & governance logs
  DELETE FROM public.finance_override_logs
  WHERE entity_type IN ('campaign_line', 'campaign_lines', 'campaign_headers', 'campaign');
  DELETE FROM public.po_governance_logs;

  -- Campaign operational core
  DELETE FROM public.campaign_influencers;
  DELETE FROM public.client_ios;
  DELETE FROM public.campaign_members;
  DELETE FROM public.campaign_lines;
  DELETE FROM public.campaign_headers;

  -- Legacy campaigns table (pre-hierarchy), if any rows remain
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns'
  ) THEN
    DELETE FROM public.campaign_influencers WHERE campaign_id IS NOT NULL;
    DELETE FROM public.campaign_members WHERE campaign_id IS NOT NULL;
    EXECUTE 'DELETE FROM public.campaigns';
  END IF;

  -- Audit noise for deleted entities (optional cleanup)
  DELETE FROM public.audit_logs
  WHERE entity_type IN (
    'campaign', 'campaign_headers', 'campaign_lines', 'campaign_line',
    'assignment_deliverables', 'deliverable', 'vendor_ios', 'vendor_io',
    'client_ios', 'client_io', 'invoice', 'invoices'
  );

  RAISE NOTICE '=== RESEEDING DOCUMENT SEQUENCES ===';

  -- Campaign headers: TW-YYYY → next insert = 0001
  FOR r IN
    SELECT * FROM public.reseed_thinkway_campaign_sequence(v_year, false)
  LOOP
    RAISE NOTICE 'TW reseed: % prev=% new=% next=% applied=%',
      r.prefix, r.previous_last_value, r.new_last_value, r.next_serial, r.applied;
  END LOOP;

  -- Invoices: INV-YYYY → next insert = 00001
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reseed_invoice_document_sequences'
  ) THEN
    FOR r IN
      SELECT * FROM public.reseed_invoice_document_sequences(v_year, false)
    LOOP
      RAISE NOTICE 'INV reseed: % prev=% new=% next=% applied=%',
        r.prefix, r.previous_last_value, r.new_last_value, r.next_serial, r.applied;
    END LOOP;
  END IF;

  -- VIO / CIO / MOV — no reseed helper; force counters to 0
  UPDATE public.document_sequences ds
  SET last_value = 0,
      updated_at = timezone('utc', now())
  WHERE ds.prefix ~ '^(VIO|CIO|MOV)-'
    AND (v_year IS NULL OR ds.prefix = 'VIO-' || v_year::text
      OR ds.prefix = 'CIO-' || v_year::text
      OR ds.prefix = 'MOV-' || v_year::text);

  INSERT INTO public.document_sequences (prefix, last_value)
  SELECT p, 0
  FROM (VALUES
    ('VIO-' || v_year::text),
    ('CIO-' || v_year::text),
    ('MOV-' || v_year::text)
  ) AS v(p)
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = 0,
        updated_at = timezone('utc', now());

  RAISE NOTICE '--- document_sequences (after) ---';
  FOR r IN
    SELECT prefix, last_value
    FROM public.document_sequences
    WHERE prefix ~ '^(TW|VIO|CIO|INV|MOV)-'
    ORDER BY prefix
  LOOP
    RAISE NOTICE '  % = % (next serial: %)', r.prefix, r.last_value, r.last_value + 1;
  END LOOP;

  RAISE NOTICE '=== DONE ===';
  RAISE NOTICE 'Master data preserved: groups, clients, brands, vendors/influencers.';
  RAISE NOTICE 'Next campaign: TW-% -0001 | Next VIO: VIO-% -0001 | Next CIO: CIO-% -0001',
    v_year, v_year, v_year;
  RAISE NOTICE 'Optional: purge IO PDF/HTML from Supabase Storage buckets vendor_io_documents / client_io_documents.';
END $$;

-- Verify after v_execute=1:
-- SELECT count(*) FROM campaign_headers;  -- expect 0
-- SELECT prefix, last_value FROM document_sequences WHERE prefix LIKE 'TW-%';
