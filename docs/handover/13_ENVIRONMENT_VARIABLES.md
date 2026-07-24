# 13 — Environment Variables

## Required (production)

| Variable | Secret | Purpose |
|----------|:------:|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server/worker only |
| `REDIS_URL` | **Yes** | BullMQ / heartbeat |
| `CRON_SECRET` | **Yes** | Cron auth |
| `READY_API_SECRET` | **Yes** | Ready detail |
| `OPENAI_API_KEY` | **Yes** | AI / classification |
| `THINKWAY_ENV=production` | No | Log labeling |
| `STRUCTURED_LOGS=1` | No | JSON logs |

## Strongly recommended

`SENTRY_DSN`, `INVITE_TOKEN_SECRET`, `CSRF_ALLOWED_ORIGINS`, `NEXT_PUBLIC_APP_URL`, Apify/Resend/SMTP keys as needed.

## Enrichment flags

See `.env.example` — keep auto enrichment off until budgets validated.

Full matrix: `docs/infrastructure/ENVIRONMENT_MATRIX.md`, `docs/infrastructure/SECRETS_CHECKLIST.md`.

