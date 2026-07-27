# Production Readiness & Enterprise Stabilisation

**Sprint:** Production Readiness (post Phase 2B)  
**Date:** 2026-07-27  
**Constraint:** No Phase 2C+ CRM, no feature-flag enablement, no product behaviour expansion.

This folder is the **canonical index** for production readiness artefacts produced in the stabilisation sprint. Deeper historical material remains under `docs/handover/`, `docs/security/`, and `docs/infrastructure/`.

| Document | Purpose |
|---|---|
| [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) | Platform layers & hierarchy |
| [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) | Deploy / dual-env guide |
| [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) | Pre-prod security gates |
| [FEATURE_FLAG_GUIDE.md](./FEATURE_FLAG_GUIDE.md) | Flags (CRM writers OFF) |
| [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) | Incident / ops pointers |
| [DATABASE_OVERVIEW.md](./DATABASE_OVERVIEW.md) | Schema / RLS / migrations |
| [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md) | Redis / BullMQ topology |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | DR / backup pointers |
| [PRODUCTION_ROLLOUT_CHECKLIST.md](./PRODUCTION_ROLLOUT_CHECKLIST.md) | Go-live checklist |
| [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md) | **Final sprint report (Go/No-Go)** |
| [CHANGELOG_STABILISATION.md](./CHANGELOG_STABILISATION.md) | Files modified this sprint |
| [Internal Pilot Release](../releases/INTERNAL_PILOT_RELEASE.md) | Milestone release summary (post-stabilisation) |
| [Internal Pilot Verification](../releases/INTERNAL_PILOT_VERIFICATION_REPORT.md) | Finalisation verification results |

**Architecture invariant (non-negotiable):**

```
Identity → Discovery → Commercial CRM (optional, writers OFF by default)
```
