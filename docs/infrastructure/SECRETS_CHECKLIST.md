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
| `META_GRAPH_ACCESS_TOKEN` | If Meta metrics | Server |
| `YOUTUBE_API_KEY` | If YouTube metrics | Server |

## Discovery worker (same project secrets)

| Secret | Required |
|--------|----------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `REDIS_URL` | Yes |

## Local / CLI schema validation (Development)

| Secret | Required | Notes |
|--------|----------|-------|
| `SUPABASE_DB_PASSWORD` | For `supabase db query --linked` / migration probes | Database password for the linked Dev project — **never commit**. See backlog: `BACKLOG_DEV_SCHEMA_VALIDATION_CREDENTIALS.md` |

## Verification

- [ ] No secrets in git history (`.env`, `.env.local` gitignored)
- [ ] Vercel env scoped: Production ≠ Preview where projects differ
- [ ] Service role key never exposed to client bundles
- [ ] `CRON_SECRET` length ≥ 32 random bytes
- [ ] Dev CLI schema probes succeed when `SUPABASE_DB_PASSWORD` is set (infra backlog)

## Sentry

Set `SENTRY_DSN` in Vercel. Optional: `SENTRY_ENVIRONMENT=production`.

Without DSN, `lib/observability/error-reporter.ts` no-ops (structured logs only).

## Rotation procedure

1. Generate new secret in provider dashboard
2. Update Vercel + worker env
3. Redeploy app + worker
4. Revoke old secret
5. Verify `/api/ready` and critical paths
