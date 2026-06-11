# Discovery ↔ Creator Browser Integration — Test Plan

Run **before commit**. Do not commit until these pass.

## 1. Database

```bash
supabase db push
```

Verify tables/columns:

- `discovered_profiles.thinkway_score`, `source_confidence`, `metric_confidence`
- `discovery_shortlist_items.influencer_id`, `unified_id` (nullable `profile_id`)
- Indexes: `discovered_profiles_browse_idx`, `discovery_shortlists_campaign_idx`

## 2. Redis + workers

```bash
docker compose -f docker-compose.discovery.yml up -d redis
cd services/discovery-worker && npm install && npm run dev
```

Set root `.env`: `REDIS_URL=redis://127.0.0.1:6379`

Enqueue from `/discovery` or campaign **Run discovery** → confirm `discovery_jobs` rows update.

## 3. Unified search performance

- Open campaign → **Assignments** → **Open browser**
- Filter: platform + min followers + min Thinkway score
- Expect: merged internal + discovery counts in subtitle
- Target: < 2s response with empty/small dataset

## 4. Creator Browser UX

- [ ] Source badges: Internal, Public Discovery, OAuth Verified, Imported
- [ ] Thinkway score + confidence dots on metrics
- [ ] Compare mode (select 2–3 creators)
- [ ] Bulk add to campaign shortlist
- [ ] Export shortlist CSV
- [ ] Detail sheet → similar creators + history placeholder

## 5. Campaign matching

- Campaign assignments → **AI Match Creators** → run brief
- Rows in `discovery_campaign_matches` for campaign id
- Match scores show niche / engagement / authenticity / ROI

## 6. Assignment flow

- Internal creator → **Assign to line** works (existing flow)
- Public discovery only → shortlist message, no direct assign

## 7. Build

```bash
npm run build
```
