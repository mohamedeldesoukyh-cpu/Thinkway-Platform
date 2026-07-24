# 25 — Post Go-Live Operations

## First 72 hours

- Watch Ops Center health score hourly  
- Watch failed login / CSRF / rate-limit counters  
- Watch enrichment DLQ and import failures  
- Freeze risky enrichment auto-flags  

## First 2 weeks

- Daily backup verification  
- Review Sentry issues triage SLA  
- Confirm cron success logs  
- UAT finance posting + IO generation on prod data samples  

## Cadence

| Cadence | Activity |
|---------|----------|
| Daily | Health score, worker, queues |
| Weekly | Alert noise review, DLQ cleanup policy |
| Monthly | Restore drill (staging), secret age review |
| Quarterly | Access review, dependency upgrades |

## Change management

Feature flags for enrichment; migrations via checklist; no direct prod SQL without dual control.

