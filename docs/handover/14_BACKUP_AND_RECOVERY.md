# 14 — Backup & Recovery

## Objectives

| Tier | RTO | RPO |
|------|-----|-----|
| Database | 4h | 24h (PITR if enabled) |
| Storage | 8h | 24h |
| App (Vercel) | 2h | 0 |
| Overall | 24h | 24h |

## Procedures (summary)

### Database restore
Supabase Dashboard → Backups → restore to new project or PITR → re-point Vercel env → verify migrations.

### Storage restore
Rehydrate from backup / mirrored bucket; re-apply storage policies (incl. P4).

### Redis rebuild
Provision new Redis → set `REDIS_URL` → restart worker → queues rebuild empty (jobs not durable across wipe unless Redis persistence configured).

### Worker recovery
Restart process; confirm heartbeat in Operations Center / `/api/ready`.

### Secret / API key rotation
Rotate in provider → update Vercel + worker env → redeploy → invalidate old keys.

### Deployment rollback
Vercel → Deployments → Promote previous.

Detailed runbooks: `docs/BACKUP_AND_RECOVERY.md`, `docs/BACKUP_DRILL_PLAN.md`, `docs/handover/21_RUNBOOK.md`.

## Certification note

A **logged restore drill** on the production-class project remains a mandatory gate for unconditional GO.

