# Production Deployment Guide

## Environments

| Env | Supabase | App | Workers |
|---|---|---|---|
| Development | `hsxrewjcbvmbkqdlzjhs` | Vercel Preview (`develop`) | Dev Redis / worker |
| Production | `ienowhwfyxoqtzbgltno` | `https://app.thinkwaymedia.com` | Prod Redis / worker |

**Never** point Production app env at Development Supabase/Redis (or vice versa). See `docs/infrastructure/ENVIRONMENT_MATRIX.md` and `docs/security/REDIS_ISOLATION_VALIDATION_2026-07-26.md`.

## Deploy flow (summary)

1. Merge to `develop` → Preview validation.
2. Apply migrations to **Development** first; validate soak/tests.
3. Promote to Production only with explicit approval (`docs/RELEASE_WORKFLOW.md`).
4. Apply Production migrations with allow-listed project ref guards.
5. Redeploy Vercel Production + restart/redeploy workers if queue/schema changed.
6. Run post-deploy health: `/api/health`, Ops Center, worker heartbeat.

## Required Production secrets (non-exhaustive)

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
- `SUPABASE_SERVICE_ROLE_KEY` (server/worker only — never `NEXT_PUBLIC_*`)
- `REDIS_URL` (correct host for that environment)
- `CRON_SECRET`, `READY_API_SECRET`, `INVITE_TOKEN_SECRET`
- Optional: `SENTRY_DSN` (recommended; currently not wired in package)

## Must remain OFF on Production

- `CREATOR_CRM_WRITERS_ENABLED` — **unset or false**
- `NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED` — unset until Phase 5+ UX approval

## Related

- `docs/DEPLOYMENT.md`, `docs/DEPLOYMENT_GUIDE.md`
- `docs/infrastructure/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/handover/12_DEPLOYMENT_GUIDE.md`
