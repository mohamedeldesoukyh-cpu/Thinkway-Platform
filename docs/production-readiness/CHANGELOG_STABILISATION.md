# Stabilisation Sprint — Change Log

**Date:** 2026-07-27  
**Constraint:** Behaviour-preserving hardenings only. No Phase 2C. CRM writers remain OFF.  
**Milestone packaging:** `docs/releases/INTERNAL_PILOT_RELEASE.md`

## Code modified

| File | Change |
|---|---|
| `lib/redis/bullmq-connection.test.ts` | Regression: producers must not use `{ url }` connection shape |
| `lib/performance/metrics-collector/queue.ts` | Use `createBullMqQueueConnection` |
| `lib/discovery-import/queue-connection.ts` | Return real BullMQ `ConnectionOptions` |
| `lib/discovery-import/cancel-import.ts` | Cancel jobs via shared connection options |
| `lib/discovery/acquisition-session.ts` | Enterprise acquisition remove uses shared connection |
| `features/portals/actions.ts` | Validate `external_link` with `parseOptionalSafeExternalUrl` |
| `features/portals/components/creator-deliverable-row.tsx` | Render via `SafeExternalLink` |
| `lib/supabase/storage.ts` | Reject empty / non-allowlisted MIME on entity uploads |
| `lib/supabase/storage-mime.test.ts` | **New** regression test |
| `app/api/quotations/[id]/export/route.ts` | `requireApiPermission(discovery.read)` + audit |
| `lib/observability/request-context.ts` | Optional `creatorId` / `influencerId` / `jobId` / `outcome` |
| `lib/observability/structured-logger.ts` | Emit new correlation fields |
| `.github/workflows/validate.yml` | CI: CRM 2B, BullMQ, storage MIME, auth-p1 |
| `package.json` | `soak:creator-crm-phase2b`, `test:storage-mime` |
| `scripts/soak-creator-crm-phase2b.ts` | Dev soak harness (writers toggled in-process only) |

## Documentation added / updated

| Path | Notes |
|---|---|
| `docs/production-readiness/*` | Canonical stabilisation pack (see README) |
| `docs/architecture/CREATOR_CRM_PHASE2B_DEV_SOAK_REPORT.md` | Phase 2B Dev soak evidence |
| `docs/architecture/CREATOR_CRM_PHASE2B_SIGN_OFF.md` | Status + Internal Pilot pointers |
| `docs/architecture/CREATOR_CRM_PHASE2A_DEV_SOAK_REPORT.md` | Superseding note (2B / Internal Pilot) |
| `docs/releases/INTERNAL_PILOT_RELEASE.md` | Milestone release summary |
| `docs/releases/INTERNAL_PILOT_VERIFICATION_REPORT.md` | Finalisation verification |

## Explicitly not changed

- No Phase 2C CRM wiring (VIO / Convert / Portal / filter / backfill)
- No feature-flag enablement
- No UI redesign / Discovery behaviour changes
- No `xlsx` replacement (documented architectural decision)
- No Sentry package install (documented; requires ops DSN + bundle decision)
- No HttpOnly cookie redesign
- No destructive schema migrations
