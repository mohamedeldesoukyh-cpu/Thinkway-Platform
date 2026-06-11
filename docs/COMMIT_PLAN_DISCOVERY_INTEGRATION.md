# Suggested commit plan (do not run until tests pass)

## Commit 1 — Discovery engine foundation
- `supabase/migrations/20260611010000_discovery_engine.sql`
- `services/discovery-worker/**`
- `lib/discovery/**`, `docker-compose.discovery.yml`, `docs/DISCOVERY_ENGINE.md`

## Commit 2 — Creator unified layer + schema integration
- `supabase/migrations/20260612010000_creator_discovery_integration.sql`
- `lib/creators/**`
- `types/database.ts` discovery + shortlist types

## Commit 3 — Creator Browser + campaign workflow UI
- `features/campaigns/components/creator-*.tsx`
- `features/campaigns/components/campaign-creator-discovery-panel.tsx`
- `features/campaigns/creator-discovery-actions.ts`
- `features/campaigns/components/tabs/campaign-lines-tab-inner.tsx`
- `app/api/campaigns/influencers/route.ts`

## Commit 4 — Docs + alignment
- `docs/DISCOVERY_INTEGRATION_TEST_PLAN.md`
- `docs/ARCHITECTURE_ALIGNMENT.md` discovery row
- `package.json` / `package-lock.json` (bullmq, ioredis)

Optional follow-up PR: promote discovery profile → vendor, historical charts, OAuth merge.
