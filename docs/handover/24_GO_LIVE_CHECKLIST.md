# 24 — Go-Live Checklist (Master)

## Infrastructure

- [ ] Dedicated production Supabase project (not thinkway-dev)
- [ ] Vercel Production project + custom domain + SSL
- [ ] DNS cutover plan
- [ ] Managed Redis (HA) with `REDIS_URL`
- [ ] Discovery worker host running against prod
- [ ] Cron jobs configured with `CRON_SECRET`

## Database

- [ ] All migrations applied (incl. P0 + P4 July 2026 set)
- [ ] FORCE/ENABLE RLS verified on finance privileged tables
- [ ] P4 storage policy verified
- [ ] Backups + PITR enabled; retention ≥ 30 days
- [ ] Restore drill logged

## Security

- [ ] MFA enforced for admin/finance/super_admin
- [ ] Secrets only in Vercel/worker env (not git)
- [ ] Service role not exposed to client
- [ ] CSP/CSRF/rate limit/headers confirmed on prod URL
- [ ] Workspace isolation smoke (portal → /finance denied)
- [ ] AI isolation smoke

## Monitoring / Operations

- [ ] `/operations` accessible to admin/ops only
- [ ] Health score populates
- [ ] Worker heartbeat green
- [ ] Queue table populated
- [ ] Alerts fire on intentional Redis stop (staging drill)
- [ ] Sentry (or equivalent) receiving events
- [ ] External uptime on `/api/health`

## Performance

- [ ] Discovery browse p95 within budget (see PERFORMANCE_GOVERNANCE)
- [ ] API ready probe < agreed SLO
- [ ] `npm run validate:performance` on release build

## Recovery / Deployment

- [ ] Rollback owner named
- [ ] Secret rotation procedure rehearsed
- [ ] `24_GO_LIVE_CHECKLIST` signed by Eng + Ops

