# 22 — Incident Response

## Severity

| Sev | Examples | Response |
|-----|----------|----------|
| SEV-1 | Data breach, auth bypass, prod DB loss | Immediate page; exec + eng |
| SEV-2 | Full outage, finance corruption risk | 15m response |
| SEV-3 | Degraded Discovery/AI | Business hours |
| SEV-4 | Cosmetic / single-user | Ticket |

## Process

1. **Detect** — Ops Center alerts, Sentry, uptime, user report  
2. **Triage** — severity, blast radius (portal vs internal vs finance)  
3. **Contain** — revoke keys, disable flags, rollback, block IPs/rate limit  
4. **Eradicate** — patch, rotate secrets, restore clean data  
5. **Recover** — verify health score, smoke tests, re-enable traffic  
6. **Learn** — postmortem within 5 business days  

## Security-specific

- Assume breach if service role leaked → rotate immediately  
- Portal isolation failure → disable portal routes if needed  
- Preserve audit logs  

## Contacts

Maintain on-call rotation in team wiki (not stored in repo).

