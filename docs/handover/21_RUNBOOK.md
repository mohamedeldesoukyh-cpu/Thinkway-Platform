# 21 — Operational Runbooks

## Redis Down

1. Confirm from Ops Center / `checkRedisHealth`  
2. Check managed Redis status & `REDIS_URL`  
3. Failover / provision new Redis if needed  
4. Restart worker + Vercel redeploy if env changed  
5. Expect empty queues unless persistence restored  

## Supabase Down

1. Status page + `/api/health`  
2. Pause non-critical workers  
3. Communicate RTO; restore from backup if data corruption  
4. Re-verify RLS migrations after restore  

## Worker Crash

1. Ops Center worker card / heartbeat age  
2. Inspect process logs; restart worker  
3. Check DLQ (`creator-enrichment-dlq`)  
4. Re-queue failed jobs if safe  

## Queue Stuck

1. Ops Center Queues tab — waiting/active/oldest  
2. Scale/restart worker; inspect poison jobs  
3. Clean failed jobs with approved scripts only  

## AI Provider Failure

1. Ops AI tab / provider status page  
2. Rotate/repair API key  
3. Disable nonessential AI features if prolonged  

## Storage Failure

1. Storage adapter status  
2. Bucket policies; service role for workers  
3. Restore objects from backup  

## Deployment Failure

1. Vercel deploy logs  
2. Rollback previous deployment  
3. Fix forward; never force-push main without approval  

## Database Restore

Follow `14_BACKUP_AND_RECOVERY.md` + `docs/BACKUP_AND_RECOVERY.md`.

## Security Incident

Follow `22_INCIDENT_RESPONSE.md`.

