# Feature Flag Guide

Server-only flags unless prefixed `NEXT_PUBLIC_`.

## Creator CRM

| Flag | Default | Scope | Effect |
|---|---|---|---|
| `CREATOR_CRM_WRITERS_ENABLED` | **ON** (unset) | Server | Explicit `false`/`0`/`off` disables CRM DB writes |
| `CREATOR_CRM_FILTER_ENABLED` / `NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED` | **ON** (unset) | Vendors list | Explicit false shows full identity inventory (`?inventory=all` also works) |

### Production / Preview policy

- Commercial CRM completion defaults writers + CRM-only list **ON** when env vars are unset.
- Rollback: set `CREATOR_CRM_WRITERS_ENABLED=false` and/or `CREATOR_CRM_FILTER_ENABLED=false`.
- Apply migration `20260727090000_commercial_crm_completion.sql` before relying on multi-bank / requirements tables.

### Implementation

- `lib/creators/crm/feature-flag.ts`
- Gate inside `lib/creators/crm/ensure-commercial-creator.ts`

### Disable values

`false`, `0`, `off`, `no` (case-insensitive) disable. Empty / unset → ON.

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
