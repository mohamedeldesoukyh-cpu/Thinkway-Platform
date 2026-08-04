# Secrets Checklist

**Never commit secrets. Rotate on staff departure or suspected leak.**

---

## Vercel (Production)

| Secret | Required | Scope |
|--------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public |
| `REDIS_URL` | Yes (queues) | Server |
| `CRON_SECRET` | Yes | Server |
| `OPENAI_API_KEY` | If AI enabled | Server |
| `SENTRY_DSN` | Recommended | Server |
| `APIFY_TOKEN` | If enrichment | Server |
| `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` | Yes for live Apify acquisition | Server — positive integer; `0` fail-closes |
| `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY` | Yes for live Apify acquisition | Server — positive integer; `0` fail-closes |
| `META_GRAPH_ACCESS_TOKEN` | If Meta metrics | Server |
| `YOUTUBE_API_KEY` | If YouTube metrics | Server |

## Discovery worker (same project secrets)

| Secret | Required |
|--------|----------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `REDIS_URL` | Yes |
| `APIFY_TOKEN` | Yes for creator enrichment |
| `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` | Yes — positive; worker must not rely on `server-only` admin imports for budget reads |
| `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY` | Yes — positive |

## Local / CLI schema validation (Development)

| Secret | Required | Notes |
|--------|----------|-------|
| `SUPABASE_DB_PASSWORD` | For `supabase db query --linked` / migration probes | Database password for the linked Dev project — **never commit**. See backlog: `BACKLOG_DEV_SCHEMA_VALIDATION_CREDENTIALS.md` |

## Vercel (Preview / Development)

| Secret | Required | Scope |
|--------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (Dev service_role JWT) | Server — admin / CIP elevated / ready detail |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (Dev project) | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (Dev anon) | Public |
| `REDIS_URL` | Yes (Development Redis) | Server |
| `CRON_SECRET` | Yes | Server |
| `OPENAI_API_KEY` | Yes (Intelligence / Studio) | Server |
| `APIFY_TOKEN` | Yes for Discovery refresh | Server |
| `DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY` | Yes (positive) for live refresh | Server — Preview (`develop`) + Development |
| `DISCOVERY_APIFY_MAX_CREDITS_PER_DAY` | Yes (positive) for live refresh | Server — Preview (`develop`) + Development |

After any Preview secret change: **redeploy develop** and run [`DEVELOPMENT_DEPLOYMENT_READINESS_CHECKLIST.md`](./DEVELOPMENT_DEPLOYMENT_READINESS_CHECKLIST.md). Existing deployments do not receive new env vars; confirm `dev.thinkwaymedia.com` aliases the new deployment.

## Verification

- [ ] No secrets in git history (`.env`, `.env.local` gitignored)
- [ ] Vercel env scoped: Production ≠ Preview where projects differ
- [ ] Preview has Dev `SUPABASE_SERVICE_ROLE_KEY` (not Production key)
- [ ] Service role key never exposed to client bundles
- [ ] `CRON_SECRET` length ≥ 32 random bytes
- [ ] Dev CLI schema probes succeed when `SUPABASE_DB_PASSWORD` is set (infra backlog)
- [ ] Development Deployment Readiness checklist passed after Preview env or alias changes

## Sentry

Set `SENTRY_DSN` in Vercel. Optional: `SENTRY_ENVIRONMENT=production`.

Without DSN, `lib/observability/error-reporter.ts` no-ops (structured logs only).

## Rotation procedure

1. Generate new secret in provider dashboard
2. Update Vercel + worker env
3. Redeploy app + worker
4. Revoke old secret
5. Verify `/api/ready` and critical paths
