# Production Rollout Checklist

Use with [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) and [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md).

## Pre-flight

- [ ] `develop` green: CI validate (includes CRM Phase 2B, BullMQ connection, auth-p1)
- [ ] Migrations applied + verified on **Development**
- [ ] No pending Phase 2C+ CRM wiring in the release
- [ ] `CREATOR_CRM_WRITERS_ENABLED` unset on Production **and** Preview (unless timed Dev soak)
- [ ] Redis / Supabase env matrix verified for Production
- [ ] `CRON_SECRET`, `READY_API_SECRET`, `INVITE_TOKEN_SECRET` present on Production
- [ ] Worker image/config matches Production Redis + Supabase ref

## Deploy

- [ ] Production migration allow-list / project-ref guard used
- [ ] Vercel Production deploy
- [ ] Worker restart/redeploy if queue or schema changed
- [ ] `/api/health` + Ops Center healthy
- [ ] Worker heartbeat fresh

## Smoke (Production)

- [ ] Login + privileged MFA path (if applicable)
- [ ] Discovery Browse + Search (no CRM rows created)
- [ ] Open campaign workspace + assignment path succeeds
- [ ] Quotation export (permissioned) works
- [ ] Portal login smoke (creator/client) if portals in scope
- [ ] Confirm zero unexpected CRM activations (`creator_crm_activation_events` count stable)

## Post-deploy

- [ ] Watch error logs / Ops Center for 30–60 minutes
- [ ] Confirm no Discovery browse `legacy` fallback spike
- [ ] Confirm queues draining (not stuck on localhost Redis)

## Rollback triggers

- Auth outage, RLS lockout, queue total stall, data corruption risk, accidental CRM writers ON
- Prefer env disable + redeploy over schema downgrade; use paired CRM rollback only if CRM migration itself is the fault
