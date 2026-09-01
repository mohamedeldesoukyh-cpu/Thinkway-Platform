# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Combined performance report avatars, page breaks, and missing previews.

## Shipped 2026-09-01 — Facebook publication previews

Facebook Combined-report stills failed because lookaside images were fetched with an Instagram referer, plugin oEmbed is empty for reels, and some FB CDNs return `octet-stream`. OpenGraph runs first; Graph picture is used when `META_GRAPH_ACCESS_TOKEN` is set; lookaside retries a Facebook referer. No migrations.

## Shipped 2026-09-01 — Combined report avatars, page breaks, missing previews

Combined HTML is `srcDoc`, so Instagram/TikTok CDN avatars never load. Reports now embed avatars via `fetchCreatorAvatarImage`. Publication stills keep a display-quality fallback when the 640px Showcase floor has no still. Cards flex inside the A4 sheet so metrics cannot paint over the footer. No migrations.

## Shipped 2026-09-01 — Publication media + creator avatar original bytes

Showcase / PDF / PPTX publication stills and creator avatars embed original fetched bytes (no resize/recompress). Layout cover crop stays. Stored publication/avatar rows not rewritten. No migrations.

- Production: https://app.thinkwaymedia.com — `dpl_GYYBWJojDJ5mNPtCYg51oXWgxUAj` · `015cc7e7` (superseded by Combined report deploy above)
- Cherry-pick only; other develop work stays off Production

## Shipped 2026-08-31 (evening)

### Client Workspace Campaign tab (`ph____alaa` / TW-2026-0002)
Reel dots opened screenshots, unposted stories stole reel media (TBC still clickable), and TikTok Added value never appeared on the client Campaign tab (Performance already had it).

- Match leftover publications to slot **platform + story vs non-story**
- Durable posts open the **permalink**; stories open proof images only
- Extra-platform posts render in an **Added value** section (same `classifyPublicationValueScope` as Performance)
- Added-value posts also appear on the creator timeline as a **gold** track (after contracted types)
- Development: https://dev.thinkwaymedia.com
- Production: https://app.thinkwaymedia.com
- No database migrations

### Earlier today — quotation publication image source
Pixelation was the **source**, not CSS: stored TikTok EU origin covers 403, then a ~240px OG thumb was embedded and stretched. Quotation now fetches signed TikTok oEmbed origin covers, rejects bytes under 640px. Production `dpl_4D9DFVt7mqHxRPnE2eohK1dDhGVC`.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
