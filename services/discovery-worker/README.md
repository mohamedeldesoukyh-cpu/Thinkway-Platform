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

# Worker
cd services/discovery-worker
cp .env.example .env
npm install
npm run dev
```

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
