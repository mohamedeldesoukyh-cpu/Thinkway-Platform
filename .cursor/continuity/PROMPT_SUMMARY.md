# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Shortlist header button grouping (View / Share / one primary).

## Shortlist button layer (develop)
Title-row actions only: **Generate outputs** (quiet, with missing-input hover), **View** (CCY + cost toggles), **Share** (preview templates, all export formats, client link, send), **Open Studio**, **Complete brief** when inputs are missing, **+ Add creators** as the only primary. Creators row is count + client/brand. Bulk bar: Compare, Refresh metrics, Export CSV, Generate quotation, Submit N selected. No functions removed. Not on Production.

## In progress — Creator Workspace post analysis
Each live post/reel/video gets a dedicated **Performance analysis** on the campaign Overview and on the deliverable card: verdict vs the creator’s own recent average, agreed fee split across contracted posts, CPV, and specific advice. Uses `lib/creator-insights` (not ECI). Creator fee only — no GP / client budget. No new nav tab.

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
