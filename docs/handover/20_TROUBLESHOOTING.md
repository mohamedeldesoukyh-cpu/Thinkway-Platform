# 20 — Troubleshooting

| Symptom | Check |
|---------|-------|
| 401 on all pages | Supabase URL/keys; cookie domain; Auth outage |
| Portal user sees internal UI | P4 middleware/gate; clear cookies; verify `client_users` |
| Queues empty / worker dead | `REDIS_URL`, worker process, heartbeat age in Ops Center |
| Ready degraded | DB/storage/redis probes; Apify budget |
| AI failures | `OPENAI_API_KEY`, provider status, Ops AI tab |
| Finance RLS denials | P0 migrations applied? role permissions? MFA AAL2? |
| CSRF 403 | Origin/Referer; `CSRF_ALLOWED_ORIGINS`; `NEXT_PUBLIC_APP_URL` |
| Cron 401 | `CRON_SECRET` mismatch |
| Slow Discovery | Redis, DB indexes, Apify budget, browse pool metrics |

Escalate using `22_INCIDENT_RESPONSE.md`.

