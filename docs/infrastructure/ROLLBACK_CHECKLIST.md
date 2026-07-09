# Rollback Checklist

**Use when a production deploy causes regressions**

---

## Immediate (0–15 min)

- [ ] Roll back Vercel deployment to last known-good commit (Dashboard → Deployments → Promote previous)
- [ ] Confirm `GET /api/version` shows previous `gitSha`
- [ ] Confirm `GET /api/ready` returns healthy
- [ ] Notify team in ops channel

## If database migration was applied

- [ ] **Do not** run destructive down migrations in prod without review
- [ ] Assess whether rollback requires forward-fix migration instead
- [ ] Document affected migration filename and decision in incident log

## Worker rollback

- [ ] Redeploy discovery-worker to matching commit
- [ ] Verify heartbeat: `/api/ready` → `worker.alive: true`
- [ ] Check queue failed counts: `/api/admin/queues`

## Validation after rollback

- [ ] Login and critical path smoke test
- [ ] Check Sentry/Vercel logs for error rate drop
- [ ] Confirm cron jobs succeeding

## Post-incident

- [ ] Root cause documented
- [ ] Fix forward-tested on staging
- [ ] Update `PRODUCTION_DEPLOYMENT_CHECKLIST.md` if gap found
