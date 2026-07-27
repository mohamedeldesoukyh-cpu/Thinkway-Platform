# Feature Flag Guide

Server-only flags unless prefixed `NEXT_PUBLIC_`.

## Creator CRM

| Flag | Default | Scope | Effect |
|---|---|---|---|
| `CREATOR_CRM_WRITERS_ENABLED` | **OFF** | Server | When false/unset, `ensureCommercialCreator` performs **zero** CRM DB writes |
| `CREATOR_CRM_FILTER_ENABLED` / `NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED` | **OFF** | List UX (Phase 5+) | When OFF, Vendors list stays legacy full list |

### Production / Preview policy (Internal Pilot)

- **Never enable** `CREATOR_CRM_WRITERS_ENABLED` on Production without an explicit enablement ticket and soak evidence.
- Development Preview may enable writers only for a timed soak window, then **remove** the env var immediately.
- As of Internal Pilot packaging (2026-07-27): Production and Preview have **no** `CREATOR_CRM_*` env vars set (writers and filter both OFF by default).

### Implementation

- `lib/creators/crm/feature-flag.ts`
- Gate inside `lib/creators/crm/ensure-commercial-creator.ts`

### Truthy values

Only `1`, `true`, `yes` (case-insensitive) enable a flag. Empty / unset / `false` / `0` → OFF.

## Other operational env (not product flags)

| Var | Notes |
|---|---|
| `STRUCTURED_LOGS` | Force JSON logs outside production |
| `SENTRY_DSN` | Error reporting (SDK not installed yet — see readiness report) |
| `CRON_SECRET` / `READY_API_SECRET` | Protect cron / ready detail |

## Related

- `.env.example`
- `docs/architecture/CREATOR_CRM_PHASE2B_SIGN_OFF.md`
- `docs/architecture/CREATOR_CRM_PHASE2B_DEV_SOAK_REPORT.md`
