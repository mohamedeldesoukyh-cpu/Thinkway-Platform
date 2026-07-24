# API Classification Matrix

Source of truth: `lib/security/workspace-classification-registry.ts` (`API_ROUTE_CLASSIFICATIONS`).  
Unclassified authenticated API calls return **403** `API_UNCLASSIFIED`.

## Classes

| Class | Meaning |
|-------|---------|
| `public` | No session required |
| `authenticated` | Session required (unused for current APIs; reserved) |
| `client_workspace` | Portal-only (no current dedicated API routes; portal uses Server Actions) |
| `internal_workspace` | Staff JWT + permissions |
| `admin_only` | Admin / privileged diagnostics |
| `service_only` | Cron secret / workers — not user JWT |

## Inventory

### Public

| Path | Notes |
|------|-------|
| `/api/health` | Liveness |
| `/api/version` | Build version |
| `/api/build-info` | Build metadata |
| `/api/ready` | Public `{status:"ok"}`; detail via secret (P1) |

### Service only

| Path | Auth |
|------|------|
| `/api/cron/publication-metrics` | `Authorization: Bearer $CRON_SECRET` |
| `/api/cron/campaign-performance-monitor` | same |

### Admin only

| Path |
|------|
| `/api/admin/queues` |
| `/api/admin/campaign-performance/dashboard` |
| `/api/admin/campaign-performance/health` |
| `/api/discovery/diagnostics` |

### Internal workspace

| Prefix / path |
|---------------|
| `/api/ai/*` |
| `/api/discovery/*` (except diagnostics) |
| `/api/operations/*` |
| `/api/campaigns/*` |
| `/api/clients/*` |
| `/api/creators/*` |
| `/api/vendors/*` |
| `/api/quotations/*` |
| `/api/shortlists/*` |
| `/api/invoices/*` |
| `/api/client-ios/*` |
| `/api/vendor-ios/*` |
| `/api/reports/*` |

## Completeness rule

`npm run test:appsec-p4` walks `app/api/**/route.ts` and fails if any path is missing from the registry.

## Adding a new API

1. Create `app/api/.../route.ts`.
2. Add an exact template entry to `API_ROUTE_CLASSIFICATIONS` with dynamic segments as `[id]`.
3. If portal must never call it, ensure prefix is under `PORTAL_BLOCKED_API_PREFIXES` or class is `internal_workspace` / `admin_only` / `service_only`.
4. Re-run `npm run test:appsec-p4`.
