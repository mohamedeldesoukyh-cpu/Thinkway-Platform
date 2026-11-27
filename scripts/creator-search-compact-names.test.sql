-- Read-only regression checks; safe on dev and existing production records.
BEGIN;
DO $$
DECLARE
  actual real;
  sample record;
BEGIN
  IF public.creator_search_compact_name('Chef  Manar') <> 'chefmanar' THEN
    RAISE EXCEPTION 'Space-insensitive name normalization failed';
  END IF;
  SELECT public.creator_search_compute_rank('chefmanar', 'chefmanar', ARRAY['chefmanar'],
    ARRAY[]::text[], ARRAY['chef manar'], 'chef manar', NULL) INTO actual;
  IF actual IS DISTINCT FROM 850::real THEN RAISE EXCEPTION 'Compact exact name rank: %', actual; END IF;
  SELECT public.creator_search_compute_rank('chefman', 'chefman', ARRAY['chefman'],
    ARRAY[]::text[], ARRAY['chef manar'], 'chef manar', NULL) INTO actual;
  IF actual IS DISTINCT FROM 790::real THEN RAISE EXCEPTION 'Compact prefix rank: %', actual; END IF;
  SELECT public.creator_search_compute_rank('chefmanar', 'chefmanar', ARRAY['chefmanar'],
    ARRAY['chefmanar'], ARRAY['chef manar'], 'chef manar', NULL) INTO actual;
  IF actual IS DISTINCT FROM 1000::real THEN RAISE EXCEPTION 'Exact handle must rank first'; END IF;
  IF has_function_privilege('anon', 'public.creator_search_candidate_keys(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.creator_search_candidate_keys(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Candidate lookup must remain internal';
  END IF;
  FOR sample IN
    SELECT id, display_name FROM public.influencers
    WHERE status = 'active' AND display_name LIKE '% %'
      AND length(public.creator_search_compact_name(display_name)) >= 3 LIMIT 3
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.creator_search_candidate_keys(public.creator_search_compact_name(sample.display_name))
      WHERE source_type = 'influencer' AND creator_id = sample.id
    ) THEN RAISE EXCEPTION 'Compact name missing from candidates: %', sample.id; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.search_creators_impl(public.creator_search_compact_name(sample.display_name), 200, 0)
      WHERE source_type = 'influencer' AND creator_id = sample.id
    ) THEN RAISE EXCEPTION 'Compact name missing from ranked search: %', sample.id; END IF;
  END LOOP;
END $$;
ROLLBACK;
