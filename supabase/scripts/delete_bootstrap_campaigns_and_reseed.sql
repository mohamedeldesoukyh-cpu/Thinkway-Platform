-- =============================================================================
-- Delete invalid bootstrap campaigns (full header delete) + reseed TW-YYYY counter
--
-- Targets: TW-2026-2, TW-2026-3 (stored as TW-2026-0002 / TW-2026-0003 also match)
--
-- v_execute := 0  preflight + sequence dry-run
-- v_execute := 1  delete campaigns + reseed sequences (apply)
-- =============================================================================

DO $$
DECLARE
  v_execute int := 0;
  v_docs_display text[] := ARRAY['TW-2026-2', 'TW-2026-3'];
  v_doc text;
  v_header_id uuid;
  v_header_doc text;
  v_line_ids uuid[];
  v_invoice_ids uuid[];
  v_vio_ids uuid[];
  v_deliverable_ids uuid[];
  r record;
BEGIN
  FOREACH v_doc IN ARRAY v_docs_display LOOP
    SELECT id, document_number
    INTO v_header_id, v_header_doc
    FROM public.campaign_headers
    WHERE document_number = v_doc
       OR (
         v_doc ~ '^TW-(\d{4})-(\d+)$'
         AND document_number = (
           'TW-' || (regexp_match(v_doc, '^TW-(\d{4})-(\d+)$'))[1]
           || '-' || lpad((regexp_match(v_doc, '^TW-(\d{4})-(\d+)$'))[2], 4, '0')
         )
       )
    LIMIT 1;

    IF v_header_id IS NULL THEN
      RAISE NOTICE 'SKIP % — campaign header not found', v_doc;
      CONTINUE;
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

    RAISE NOTICE '=== PREFLIGHT % (% id=%) ===', v_doc, v_header_doc, v_header_id;
    RAISE NOTICE 'lines=% deliverables=% vendor_ios=% invoices=%',
      cardinality(v_line_ids), cardinality(v_deliverable_ids),
      cardinality(v_vio_ids), cardinality(v_invoice_ids);

    IF v_execute <> 1 THEN
      CONTINUE;
    END IF;

    DELETE FROM public.campaign_publications WHERE campaign_header_id = v_header_id;

    IF cardinality(v_line_ids) > 0 THEN
      DELETE FROM public.assignment_post_schedule WHERE campaign_line_id = ANY (v_line_ids);
    END IF;

    IF cardinality(v_invoice_ids) > 0 THEN
      DELETE FROM public.payments WHERE invoice_id = ANY (v_invoice_ids);
      DELETE FROM public.invoice_versions WHERE invoice_id = ANY (v_invoice_ids);
      DELETE FROM public.invoice_line_items WHERE invoice_id = ANY (v_invoice_ids);
      DELETE FROM public.invoices WHERE id = ANY (v_invoice_ids);
    END IF;

    IF cardinality(v_line_ids) > 0 THEN
      UPDATE public.campaign_lines SET vendor_io_id = NULL WHERE id = ANY (v_line_ids);
      DELETE FROM public.vendor_io_lines WHERE campaign_line_id = ANY (v_line_ids);
    END IF;

    IF cardinality(v_vio_ids) > 0 THEN
      UPDATE public.vendor_ios SET replaces_vendor_io_id = NULL
      WHERE replaces_vendor_io_id = ANY (v_vio_ids);
      DELETE FROM public.vendor_ios WHERE campaign_header_id = v_header_id;
    END IF;

    DELETE FROM public.deliverables WHERE campaign_id = v_header_id;
    DELETE FROM public.assignment_deliverables WHERE campaign_header_id = v_header_id;
    DELETE FROM public.campaign_influencers WHERE campaign_header_id = v_header_id;
    DELETE FROM public.campaign_lines WHERE campaign_header_id = v_header_id;
    DELETE FROM public.client_ios WHERE campaign_header_id = v_header_id;
    DELETE FROM public.campaign_members WHERE campaign_header_id = v_header_id;
    DELETE FROM public.campaign_headers WHERE id = v_header_id;

    RAISE NOTICE 'Deleted campaign %', v_header_doc;
  END LOOP;

  RAISE NOTICE '=== SEQUENCE RESEED (year 2026) ===';
  FOR r IN
    SELECT *
    FROM public.reseed_thinkway_campaign_sequence(2026, v_execute <> 1)
  LOOP
    RAISE NOTICE 'prefix=% prev=% new=% max_existing=% next=% survivors=% applied=%',
      r.prefix, r.previous_last_value, r.new_last_value,
      r.max_existing_serial, r.next_serial, r.surviving_campaigns, r.applied;
  END LOOP;

  IF v_execute <> 1 THEN
    RAISE NOTICE 'Preflight only. Set v_execute := 1 to delete campaigns and apply reseed.';
  END IF;
END $$;

-- Verify after v_execute=1:
-- SELECT document_number, name FROM campaign_headers ORDER BY document_number;
-- SELECT * FROM document_sequences WHERE prefix = 'TW-2026';
-- SELECT * FROM public.reseed_thinkway_campaign_sequence(2026, true);
