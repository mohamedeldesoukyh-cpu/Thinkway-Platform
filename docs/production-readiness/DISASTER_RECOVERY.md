# Disaster Recovery (Index)

Full strategy: `docs/BACKUP_AND_RECOVERY.md`, `docs/BACKUP_DRILL_PLAN.md`,  
`docs/security/DISASTER_RECOVERY_DRILL_2026-07-26.md`, `docs/handover/14_BACKUP_AND_RECOVERY.md`.

## Objectives (program)

| Tier | RTO | RPO |
|---|---|---|
| Database | ~4 hours | ≤24 hours (daily) / better with PITR |
| Storage | ~8 hours | ≤24 hours |
| Application (Vercel) | ~2 hours | 0 (git) |
| Overall | ≤24 hours | ≤24 hours |

## Production must-haves

- [ ] Dedicated Production Supabase project with backups enabled
- [ ] Enable **PITR** on Production if plan allows (called out as currently off in DR drill — billing decision)
- [ ] Pre-migration snapshot / confirm backup before Production `db push`
- [ ] Redis / worker redeploy procedure documented per environment
- [ ] Dual-env secret matrix verified (no cross-wiring)

## Restore order (high level)

1. Restore PostgreSQL (PITR or daily backup).
2. Verify RLS / critical migrations applied.
3. Restore Storage buckets if needed.
4. Point Production app + workers at restored project (careful cutover).
5. Smoke: auth, Discovery browse, campaign open, queue heartbeat.
6. Keep CRM writers **OFF**.

## CRM note

CRM tables are additive and optional. Restoring an older backup without CRM migrations is fine while writers remain OFF; re-apply migrations before any future writers enablement.
