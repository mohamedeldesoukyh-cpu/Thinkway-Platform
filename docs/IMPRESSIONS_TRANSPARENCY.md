# Impressions transparency

How Thinkway resolves **impressions** for Campaign Performance: provider data, forecast formulas, UI badges, and platform limitations.

## Resolution priority

Same pattern as reach forecasting:

1. **Manual** — user-entered or imported (`impressions_source = manual`)
2. **Actual** — value from metrics provider (`impressions_source = actual`, `actual_impressions` populated)
3. **Forecast** — estimated when provider impressions are unavailable (`impressions_source = forecast`)
4. **Null** — no basis to estimate

When provider impressions arrive after a forecast, `impressions` + `impressions_source` switch to **actual**; `forecast_impressions` is retained for audit.

Implementation: `lib/performance/impressions-forecast-engine.ts`, integrated in `merge-metrics.ts` and `persist.ts`.

## Forecast formulas

| Content type | Formula | Basis |
|--------------|---------|--------|
| Instagram reel | `views × 1.15` | Video views from provider |
| Instagram post (and carousel/photo defaults) | `reach × 1.25` | **Effective reach** (actual, forecast, or manual) |
| TikTok video | `views × 1.10` | Video play count from provider |

IG post forecasts use the same resolved reach shown in the grid (including follower-based reach forecast when provider reach is missing).

## Database columns

| Column | Type | Notes |
|--------|------|--------|
| `impressions` | numeric | Display value (actual, forecast, or manual) |
| `impressions_source` | text | `actual` \| `forecast` \| `manual` |
| `actual_impressions` | numeric | Provider-reported impressions when available |
| `forecast_impressions` | numeric | Formula estimate; kept when actual replaces forecast |

Migration: `supabase/migrations/20260630150000_impressions_forecasting.sql`

## UI transparency

Badges mirror reach (grid, publication workspace, detail drawer, KPI strip, exports):

| Source | Badge | Color |
|--------|-------|-------|
| Actual | Actual | Green |
| Forecast | Forecast | Amber |
| Manual | Manual | Blue |

Tooltips explain provider vs formula basis. Forecast tooltips include the formula (e.g. `views × 1.10`).

Component: `features/campaigns/components/performance/impressions-display.tsx`

## Provider investigation — does Apify return impressions?

### Instagram (`clockworks/instagram-scraper` or configured actor)

| Field | Returned? | Notes |
|-------|-----------|--------|
| `impressions` | **Rarely / effectively no** for public scrape | Not exposed on public post pages for most content types. Mapper reads `row.impressions` if present, but typical Apify IG payloads do not include it. |
| `reach` | **Rarely / effectively no** | Same limitation; reach forecasting fills the gap. |
| `videoPlayCount` / `playCount` | **Yes** (reels) | Used for views. |
| `likesCount`, `commentsCount`, edge counts | **Often** | Core engagement metrics. |

**API limitations:** Instagram Graph API can return impressions/reach for owned/business content with proper permissions. Public Apify scraping does not replicate Insights API data. Hidden likes, private accounts, and story-only URLs further limit fields.

### TikTok (`clockworks/tiktok-scraper`)

| Field | Returned? | Notes |
|-------|-----------|--------|
| `impressions` | **No** | Not in actor output; mapper does not expect it. |
| `playCount` | **Yes** | Mapped to `views`. |
| `text` | **Yes** | Post caption (see content extraction). |
| `hashtags[]` | **Yes** | Objects with `name`. |
| `detailedMentions` / `textExtra` | **Sometimes** | Mention metadata; `mentions[]` is often empty. |
| `textLanguage` | **Yes** | Language code only (not used for metrics). |

**API limitations:** TikTok Display/Research APIs require approved product access. Public scrape yields play count and engagement, not platform-native impressions. Thinkway forecasts TikTok impressions from views (`× 1.10`).

### Facebook (Apify mapper)

`impressions` and `reach` fields are mapped when present; availability depends on post type and actor.

## Public scraping limits (summary)

- **Impressions and reach are platform-insight metrics**, not shown on public post pages for IG/TikTok in most cases.
- Scrapers return **views/plays, likes, comments, shares**, and **caption/hashtags** where the page exposes them.
- Thinkway **never treats missing provider impressions as zero**; it forecasts or leaves null.
- Forecast values are **clearly badged** and excluded from “actual” KPI subtotals.

## Verification

```bash
npm run test:impressions-forecast-engine
npm run test:reach-forecast-engine
npm run test:content-normalizer
npm run test:metrics-collector
```

Live Apify smoke (content + metrics):

```bash
npm run test:apify-platform -- https://www.tiktok.com/@apifyoffice/video/7200360993149553925
npm run test:apify-platform -- https://www.instagram.com/reel/<id>/
```

After migration, re-sync a publication and confirm:

- Grid **Impr.** column shows value + source badge
- Publication workspace **Impressions** card shows formula tooltip when forecasted
- KPI strip shows Actual / Forecast impression breakdown

## Related docs

- `docs/PUBLICATION_CONTENT_EXTRACTION.md` — caption/hashtag pipeline
- Reach forecasting migration: `20260630130000_reach_forecasting.sql`
