# Production Deployment Checklist

**Thinkway Phase 0.2 — use before every production deploy**

---

## Pre-deploy

- [ ] All migrations applied to **production** Supabase (`supabase migration list` remote = local)
- [ ] Env vars set in Vercel Production (see `SECRETS_CHECKLIST.md`, `ENVIRONMENT_MATRIX.md`)
- [ ] `THINKWAY_ENV=production` set on Vercel
- [ ] `REDIS_URL` points to production Redis
- [ ] `CRON_SECRET` set (cron routes reject unauthenticated calls)
- [ ] Discovery worker deployed with matching env
- [ ] CI green on merge commit

## Deploy

- [ ] Deploy via Vercel git integration (ensures `VERCEL_GIT_COMMIT_SHA`)
- [ ] Note deploy URL and commit SHA

## Post-deploy verification

- [ ] `GET /api/version` → correct `gitSha`, `environment: production`
- [ ] `GET /api/health` → 200, `status: ok`
- [ ] `GET /api/ready` → 200, `database.connected: true`
- [ ] `GET /api/ready` → `worker.alive: true` (if Redis configured)
- [ ] `GET /api/build-info` → `productionReady: true` (when prod Supabase aligned)
- [ ] Smoke: login, open campaign workspace, AI chat responds
- [ ] Cron: verify Vercel cron jobs configured with `Authorization: Bearer $CRON_SECRET`

## Observability

- [ ] `SENTRY_DSN` set (optional but recommended)
- [ ] External uptime monitor on `/api/health` or `/api/version` (5 min interval)
- [ ] Vercel deploy notification enabled

## Sign-off

| Role | Name | Date |
|------|------|------|
| Deployer | | |
| Reviewer | | |
