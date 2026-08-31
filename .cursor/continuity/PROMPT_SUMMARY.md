# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace Campaign tab publication matching and Added value.

## Shipped 2026-08-31 (evening)

### Client Workspace Campaign tab (`ph____alaa` / TW-2026-0002)
Reel dots opened screenshots, unposted stories stole reel media (TBC still clickable), and TikTok Added value never appeared on the client Campaign tab (Performance already had it).

- Match leftover publications to slot **platform + story vs non-story**
- Durable posts open the **permalink**; stories open proof images only
- Extra-platform posts render in an **Added value** section (same `classifyPublicationValueScope` as Performance)
- Added-value posts also appear on the creator timeline as a **gold** track (after contracted types)
- Development: https://dev.thinkwaymedia.com · `2bb9ac77`
- Production: https://app.thinkwaymedia.com — `dpl_3ikP57zJhEtiZt61cx6Tidr244QB`
- No database migrations

### Earlier today — quotation publication image source
Pixelation was the **source**, not CSS: stored TikTok EU origin covers 403, then a ~240px OG thumb was embedded and stretched. Quotation now fetches signed TikTok oEmbed origin covers, rejects bytes under 640px. Production `dpl_4D9DFVt7mqHxRPnE2eohK1dDhGVC`.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
