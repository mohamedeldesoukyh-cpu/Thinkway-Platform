# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Invoice detail restyle to match finance-suite.html `invd`.

## Shipped 2026-09-03 — Invoice detail finance-suite restyle

`/billing/invoices/[id]` now matches `finance-suite.html` Invoice detail: page title `Invoice {number}`, identity card, finance governance bar, 6 KPI cards, segmented Line items / Collections / Approvals / Audit. Un-generate, record collection, and approve/reject stay wired. No left nav copy. No migrations. Not on Production.

## In progress 2026-09-03 — Partial invoice remaining SSOT

INV-2026-19 (60%) was marked fully invoiced and left `/billing`. Queue remaining now uses invoice line items, not max(operational, lines). Assignment 60% slices split onto deliverables/posts instead of billing 100% remaining. Status is partially invoiced while remaining > 0. No migrations. Not on Production.

## In progress 2026-09-03 — Campaign-row Bill % + hover titles

Billing queue campaign (main) row has editable Bill %. It cascades to every line. Hover titles on expand, select, Invoice, open-campaign, and Bill %. No migrations. Not on Production.

## Shipped 2026-09-03 — Billing table campaign number + unified type

Invoices and Collections show Campaign No. Campaign names wrap. All `/billing` table body cells match the Invoice column (11px, medium, tabular-nums, left). Headers are centered. Queue, Overview, Aging, Approvals, and Vendor payments use the same type. No migrations. Not on Production.

## Shipped 2026-09-02 — Restrict billing queue “fully” rules

Fully achieved / Invoiced now require remaining ≈ 0. A 10% or 60% invoice stays Partially invoiced and stays in the queue. Queue membership is remaining to invoice, not assignment eligibility. No migrations. Not on Production.

## Shipped 2026-09-02 — Assignments invoice confirm sync

Assignments Generate invoice uses the same confirm dialog and `useOperationalInvoiceCreate` path as Campaign Billing and `/billing`. Amounts stay remaining-100% unless Campaign Billing Invoice % is set. Regenerated invoices still open the regenerate dialog first. No migrations. Not on Production.

## Shipped 2026-09-02 — Invoice confirm before generate

Clicking Invoice on `/billing` no longer puts every row into Generating. Confirm dialog shows total, already invoiced, this invoice, remaining, Proceed/Cancel. Bulk selection shows a line table. Invoice button is Thinkway green. No migrations. Not on Production.

## Shipped 2026-09-02 — Billing v3 page chrome match

`/billing` page header, padding, vendor payments card, and Filter/Sort/Settings now follow `billing-v3.html`. Generic shell title bar hidden. Thinkway green (not mock blue). No currency switcher, Create payment batch, or mock footnotes. No migrations. Not on Production.

## Shipped 2026-09-02 — Finance suite text wrap

Overflowing copy on finance-suite pages wraps instead of clipping: headers, KPI labels/values, card titles, table heads/cells, tiles, notes, sidebar nav labels. Buttons and status pills stay single-line. No migrations. Not on Production.

## Shipped 2026-09-02 — Vendor payments by assignment

Billing & finance Vendor payments lists one creator assignment per row, grouped by campaign. Card headers match billing-v3 (title, subtitle, Filter/Sort/Settings). Vendor cost from `agreed_fee` (or “not exposed”). No fake Create payment batch. No migrations. Not on Production.

## Shipped 2026-09-02 — Finance suite exact header match

Finance / collections / treasury / planning / reports / vendor IO / move / reassignment / links now use the mock page header (`.tw-hd`): 19px title, 12px subtitle, Export + Actions. Titles and descriptions match `finance-suite.html`. Generic shell title bar hidden. `tw-*` primitives. Existing tabs and table Filter/Sort/Settings kept. `FinanceSuiteShell` is imported from `finance-suite-shell` (not the client barrel) so `next/headers` stays server-only. No migrations. Not on Production.

## Shipped 2026-09-02 — Finance suite restyle

PO tracker, invoices, VAT, FX, periods, posting, credit/debit notes, aging, credit limit, collections, treasury, planning, reports hub, vendor IO, move, reassignment, and link generator restyled to match `finance-suite.html`. Functions and workspace tabs preserved. Route-scoped `finance-suite.css`. No migrations. Not on Production.

## Shipped 2026-09-02 — Billing workspace v3 restyle

Billing & finance (`/billing`) visual redesign from `billing-v3.html` without dropping functions: 4 hero + 5 secondary KPIs, underline tabs, queue assignment rows sharing parent columns, Overview by client/currency/status, invoice currency subtotals, collection days past due, A/R aging client matrix, approvals grouped by invoice, vendor cost strip. Thinkway green (not mock blue). No currency conversion. No migrations. Not on Production.

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
