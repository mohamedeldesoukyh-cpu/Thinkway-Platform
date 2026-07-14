-- Grants for creator_intelligence (Phase H projection).
--
-- The 20260713120000 migration created the table with RLS and a SELECT policy
-- but no table GRANTs, so the backfill's service-role upsert failed with
-- "permission denied for table creator_intelligence". Same defect and same fix
-- as 20260705210000_creator_dna_ipl_grants.sql: table privileges follow the
-- project convention (authenticated + service_role), while RLS keeps
-- authenticated users read-only — there is no authenticated write policy, so
-- despite the INSERT/UPDATE/DELETE grant only the service role (server-side,
-- RLS-bypassing) can write. Security is unchanged: reads stay policy-gated,
-- writes stay server-only.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence
  TO authenticated, service_role;
