# Thinkway Discovery Engine

Hybrid public-signal influencer discovery without paid social APIs.

## Architecture

```
┌─────────────────┐     enqueue jobs      ┌──────────────────┐
│  Next.js app    │ ──────────────────────► │  Redis (BullMQ)  │
│  /discovery UI  │                         └────────┬─────────┘
└────────┬────────┘                                  │
         │ read/search                               │ workers
         ▼                                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                         │
│  discovered_profiles · profile_metrics · profile_ai_scores │
│  discovery_sources · profile_relationships · shortlists    │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ Playwright crawl + OpenAI classify
┌────────┴────────┐
│ discovery-worker │  (independent Node microservice)
└─────────────────┘
```

## Discovery methods

| Method | Entry | Output |
|--------|-------|--------|
| Hashtag | `#fashion`, `#beauty`, Arabic tags | Usernames + source hashtag |
| Competitor | Seed influencer username | Suggested accounts, mentions graph |
| Location | UAE / KSA / Egypt queries | Country, city, language (AI) |
| Trend | TikTok sounds / viral hashtags | Participating creators |

## Enrichment pipeline

Stages: `discovered` → `basic_enriched` → `metrics_enriched` → `ai_scored` → `verified`

Extracts public metrics: followers, engagement, bio, hashtags, email-in-bio, posting frequency.

**Authenticity heuristic** — follower/engagement ratio, spikes, repetitive comments.

**AI classification** (OpenAI, optional) — niche, luxury level, brand fit, audience persona.

## Auto refresh

| Tier | Followers | Schedule |
|------|-----------|----------|
| top | 500K+ | Daily |
| medium | 50K–500K | Weekly |
| inactive | &lt;50K | Monthly |

## Search

PostgreSQL `tsvector` on `discovered_profiles` — filter by platform, country, category, followers, engagement, language, keywords.

## OAuth future

`discovered_profiles.influencer_id` links promoted vendors. OAuth tokens can enrich `influencer_platform_accounts` without replacing crawl data.

## Deploy

1. Apply migration: `supabase db push` (includes `20260611010000_discovery_engine.sql`)
2. Start Redis: `docker compose -f docker-compose.discovery.yml up -d redis`
3. Configure worker: `services/discovery-worker/.env`
4. Run worker: `npm run discovery:worker`
5. Set `REDIS_URL` on Vercel for job enqueue from dashboard

## Permissions

- `discovery.read` — search and view profiles
- `discovery.write` — shortlists, promote profiles
- `discovery.admin` — run crawlers (granted to admin roles by default)
