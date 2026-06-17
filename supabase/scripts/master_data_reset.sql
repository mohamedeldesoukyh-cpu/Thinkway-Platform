-- =============================================================================
-- THINKWAY — Master data reset (brands + clients)
--
-- Removes all brands and clients. Preserves holding groups, vendors, users.
-- Resets CLT / BRD document_sequences so next inserts start at 000001.
--
-- Prerequisites: no campaign_headers referencing brands (run full_operational_reset first).
--
-- v_execute := 0  preflight
-- v_execute := 1  DELETE
-- =============================================================================

DO $$
DECLARE
  v_execute int := 0;
  r record;
BEGIN
  RAISE NOTICE '=== PREFLIGHT ===';
  RAISE NOTICE 'brands=%', (SELECT count(*) FROM public.brands);
  RAISE NOTICE 'clients=%', (SELECT count(*) FROM public.clients);
  RAISE NOTICE 'groups (preserved)=%', (SELECT count(*) FROM public.groups);
  RAISE NOTICE 'campaign_headers=%', (SELECT count(*) FROM public.campaign_headers);

  IF (SELECT count(*) FROM public.campaign_headers) > 0 THEN
    RAISE EXCEPTION 'campaign_headers still exist — run full_operational_reset.sql first.';
  END IF;

  IF v_execute <> 1 THEN
    RAISE NOTICE 'No deletes (v_execute=0). Set v_execute := 1 and re-run.';
    RETURN;
  END IF;

  RAISE NOTICE '=== EXECUTING DELETE ===';

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns_legacy'
  ) THEN
    DELETE FROM public.campaign_influencers WHERE campaign_id IN (SELECT id FROM public.campaigns_legacy);
    DELETE FROM public.campaign_members WHERE campaign_id IN (SELECT id FROM public.campaigns_legacy);
    DELETE FROM public.deliverables WHERE campaign_id IN (SELECT id FROM public.campaigns_legacy);
    DELETE FROM public.campaigns_legacy;
    RAISE NOTICE 'Removed legacy campaigns table rows';
  END IF;

  DELETE FROM public.brands;

  DELETE FROM public.client_users;
  DELETE FROM public.client_contacts;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_credit_note_lines') THEN
    DELETE FROM public.client_credit_note_lines;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_credit_notes') THEN
    DELETE FROM public.client_credit_notes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_debit_note_lines') THEN
    DELETE FROM public.client_debit_note_lines;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_debit_notes') THEN
    DELETE FROM public.client_debit_notes;
  END IF;

  DELETE FROM public.finance_document_links fdl
  WHERE fdl.source_document_id IN (
      SELECT id FROM public.finance_documents WHERE client_id IS NOT NULL
    )
    OR fdl.target_document_id IN (
      SELECT id FROM public.finance_documents WHERE client_id IS NOT NULL
    );

  DELETE FROM public.finance_documents WHERE client_id IS NOT NULL;

  DELETE FROM public.clients;

  UPDATE public.document_sequences
  SET last_value = 0, updated_at = timezone('utc', now())
  WHERE prefix IN ('CLT', 'BRD');

  INSERT INTO public.document_sequences (prefix, last_value)
  SELECT p, 0 FROM unnest(ARRAY['CLT', 'BRD']::text[]) AS p
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = 0, updated_at = timezone('utc', now());

  RAISE NOTICE '=== DONE ===';
  RAISE NOTICE 'brands=% clients=%',
    (SELECT count(*) FROM public.brands),
    (SELECT count(*) FROM public.clients);

  FOR r IN
    SELECT prefix, last_value FROM public.document_sequences
    WHERE prefix IN ('GRP', 'CLT', 'BRD') ORDER BY prefix
  LOOP
    RAISE NOTICE 'sequence % = % (next: %)', r.prefix, r.last_value, r.last_value + 1;
  END LOOP;
END $$;
