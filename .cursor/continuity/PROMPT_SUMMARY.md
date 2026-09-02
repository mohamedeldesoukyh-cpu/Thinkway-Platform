# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Inline invoice generation on Campaign Finance operational billing — Invoice %, To Be Invoiced, Remaining on the table; no sidebar.

## In progress — Inline operational invoice draft (2026-09-02)

Generate invoice from the operational billing table on Campaign Finance and Billing & finance (`/billing`). Invoice % defaults to 100%. Campaign (main) line % cascades to assignments; mixed assignment % rolls up. Spec: `docs/capabilities/PARTIAL_ASSIGNMENT_INVOICE_SPEC.md`. No migrations. Not on Production.

## Shipped 2026-09-02 — Partial assignment invoice engine

One assignment can be billed across unlimited invoices up to remaining. Remaining is recomputed from invoice line items. Invoice HTML shows Campaign No. (`TW-YYYY-NNNN`) plus name. No migrations. Not on Production.

## Shipped 2026-09-01 — Facebook publication previews

Facebook Combined-report stills failed because lookaside images were fetched with an Instagram referer, plugin oEmbed is empty for reels, and some FB CDNs return `octet-stream`. OpenGraph runs first; Graph picture is used when `META_GRAPH_ACCESS_TOKEN` is set; lookaside retries a Facebook referer. No migrations.

## Shipped 2026-09-01 — Facebook publication previews

Facebook Combined-report stills failed because lookaside images were fetched with an Instagram referer, plugin oEmbed is empty for reels, and some FB CDNs return `octet-stream`. OpenGraph runs first; Graph picture is used when `META_GRAPH_ACCESS_TOKEN` is set; lookaside retries a Facebook referer. No migrations.

## Shipped 2026-09-01 — Combined report avatars, page breaks, missing previews

Combined HTML is `srcDoc`, so Instagram/TikTok CDN avatars never load. Reports now embed avatars via `fetchCreatorAvatarImage`. Publication stills keep a display-quality fallback when the 640px Showcase floor has no still. Cards flex inside the A4 sheet so metrics cannot paint over the footer. No migrations.

- Develop: `1a8d63d9`
- Production `main` cherry-pick: `d62b48ac`
- Production: https://app.thinkwaymedia.com — `dpl_EviVzHLYpuzzukGPFcMtghbtEYcA` · READY · Supabase `ienowhwfyxoqtzbgltno` aligned

## Shipped 2026-09-01 — Publication media + creator avatar original bytes

Showcase / PDF / PPTX publication stills and creator avatars embed original fetched bytes (no resize/recompress). Layout cover crop stays. Stored publication/avatar rows not rewritten. No migrations.

- Develop original commits: `e8fb2a9e` · `1e142fde` · `3b243eec`
- Production `main` cherry-picks: `71938f02` · `0af430c7` · `015cc7e7`
- Cherry-pick only; shortlist button layer and Creator Workspace post analysis stay off Production

## Shipped 2026-09-01 — Add Assignment creator-only lines

Add Assignment no longer invents EGP 500, and a creator can be saved without platforms or agreed content (add-value lines). Platforms/content can be added later.

- No database migrations. Cherry-pick only; other develop work stays off Production.

## Shortlist button layer (develop)
Title-row actions only: **Generate outputs** (quiet, with missing-input hover), **View** (CCY + cost toggles), **Share** (preview templates, all export formats, client link, send), **Open Studio**, **Complete brief** when inputs are missing, **+ Add creators** as the only primary. Creators row is count + client/brand. Bulk bar: Compare, Refresh metrics, Export CSV, Generate quotation, Submit N selected. No functions removed. Not on Production.

## Creator Workspace post analysis (develop)
Each live post/reel/video gets a dedicated **Performance analysis** on the campaign Overview and on the deliverable card: verdict vs the creator’s own recent average, agreed fee split across contracted posts, CPV, and specific advice. Uses `lib/creator-insights` (not ECI). Creator fee only — no GP / client budget. No new nav tab. Not on Production.

## Shipped 2026-08-31 (evening)

### Client Workspace Campaign tab (`ph____alaa` / TW-2026-0002)
Reel dots opened screenshots, unposted stories stole reel media (TBC still clickable), and TikTok Added value never appeared on the client Campaign tab (Performance already had it).

- Match leftover publications to slot **platform + story vs non-story**
- Durable posts open the **permalink**; stories open proof images only
- Extra-platform posts render in an **Added value** section (same `classifyPublicationValueScope` as Performance)
- Added-value posts also appear on the creator timeline as a **gold** track (after contracted types)
- No database migrations

### Earlier today — quotation publication image source
Pixelation was the **source**, not CSS: stored TikTok EU origin covers 403, then a ~240px OG thumb was embedded and stretched. Quotation now fetches signed TikTok oEmbed origin covers, rejects bytes under 640px.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
