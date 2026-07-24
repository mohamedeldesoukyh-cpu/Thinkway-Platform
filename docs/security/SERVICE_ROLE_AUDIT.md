# Service Role Audit (P4)

## Principle

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It must never appear in:

- Client Components / browser bundles  
- `NEXT_PUBLIC_*` env vars  
- User-controlled Server Action paths that accept arbitrary SQL/table targets  

## Factory

`lib/supabase/admin.ts` → `createSupabaseAdminClient()`

- Marked `import "server-only"` (P4)
- Throws if key missing
- Session persistence disabled

## Approved call-site categories

| Category | Examples | Risk control |
|----------|----------|--------------|
| Cron Route Handlers | `app/api/cron/*` | `CRON_SECRET` before admin client |
| Admin health | `app/api/admin/campaign-performance/health` | Admin auth in route |
| Background workers | `services/discovery-worker`, enrichment | Offline process; entity-scoped jobs |
| Privileged repositories | CIP elevated updates, discovery-import cleanup | Server Actions already behind internal permissions + P4 portal deny |
| Ops scripts | `scripts/*` | Local/CI only; not exposed as HTTP |

## Static guarantees (`test:appsec-p4`)

1. Admin module contains `server-only`.
2. No `"use client"` file imports `createSupabaseAdminClient` or `SUPABASE_SERVICE_ROLE_KEY`.
3. `.env.example` documents `SUPABASE_SERVICE_ROLE_KEY` without `NEXT_PUBLIC_` prefix.

## User-controlled path review

| Path | Uses service role? | Safe? |
|------|-------------------|-------|
| Portal Server Actions | No | Yes |
| Finance Server Actions | No (user JWT + RLS) | Yes |
| Discovery import actions | Yes (file processing / cleanup) | Gated by discovery permissions + portal actor deny |
| CIP elevated repository | Yes | Internal-only callers; brand_id changes remain a least-privilege residual |
| AI tool executors | No — user JWT via `tool-auth` | Yes |

## Residual risk

- Any new Server Action that calls `createSupabaseAdminClient()` without `requirePermission` + portal deny would reintroduce risk. Prefer user-scoped clients unless bypass is mandatory.
- Workers hold the service key in process env — protect Redis and worker hosts equivalently to the DB.
