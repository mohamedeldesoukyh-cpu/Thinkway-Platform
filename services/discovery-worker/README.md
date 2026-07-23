# Thinkway Discovery Worker

Independent Node.js microservice for public-signal influencer discovery.

## Stack

- **BullMQ** + **Redis** — job queues
- **Playwright** — conservative public page crawling
- **Puppeteer-core** — optional hook for custom browser binaries
- **Supabase** — PostgreSQL + storage (service role)
- **OpenAI** — niche/location classification (optional)

## Queues

| Queue | Purpose |
|-------|---------|
| `discovery-run` | Hashtag, competitor, location, trend discovery |
| `discovery-enrich` | Profile enrichment pipeline (metrics → AI scores) |
| `discovery-refresh` | Auto-refresh due profiles |
| `discovery-scheduler` | Cron trigger every 6 hours |

## Run locally

```bash
# Redis
docker compose -f docker-compose.discovery.yml up -d

# Worker (from repo root)
cp services/discovery-worker/.env.example services/discovery-worker/.env
cd services/discovery-worker && npm install && cd ../..
npm run discovery:worker:dev
```

Production start (`npm run discovery:worker`) runs TypeScript via `tsx` (no `dist/` build).

**Railway (canonical):**
1. Root Directory = `/`
2. Builder = Dockerfile (repo-root `Dockerfile` via `railway.toml`)
3. Set vars from `.env.example` — at minimum `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, managed `REDIS_URL`
4. Start command = `npm run discovery:worker`

Do not use Nixpacks/Railpack against root `package.json` alone.

## Enrichment stages

`discovered` → `basic_enriched` → `metrics_enriched` → `ai_scored` → `verified`

Refresh tiers: **top** (daily), **medium** (weekly), **inactive** (monthly).

## Anti-bot

- Randomized delays between requests
- Retry with backoff
- Optional proxy rotation (`DISCOVERY_PROXY_URLS`)
- Captcha detection aborts crawl (no aggressive bypass)

## Future OAuth

`discovered_profiles.influencer_id` links promoted vendors. OAuth tokens can merge into `influencer_platform_accounts` without replacing public crawl data.
