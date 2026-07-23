-- Staged enrichment: Instagram/offline imports may sit in awaiting_profile_details
-- until required profile-identity fields are collected (or marked unavailable).

ALTER TYPE public.creator_enrichment_status
  ADD VALUE IF NOT EXISTS 'awaiting_profile_details';

COMMENT ON TYPE public.creator_enrichment_status IS
  'Creator enrichment lifecycle: never → queued → running → enriched|partial|awaiting_profile_details|failed|skipped';
