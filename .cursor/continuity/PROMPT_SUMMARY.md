# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Discovery pack rebuild (`docs/architecture/discovery-specs/`).

## Shipped 2026-09-06 — Pack publications wall-of-text + PR category

Publications tab dumped full Instagram captions in the 3-col `.tw-pubs` grid (no line-clamp; news pages like cairoscene). Fix: 2-line clamp in pack CSS + truncated captions in pack/gallery cards. **PR** is now a canonical category (`influencers.categories`); pack left-rail checkbox adds/removes `PR` alongside other tags; Filters quick chip + FTS/browse filter find PR pages. No migration. Develop only — Production not deployed.

## Shipped 2026-09-06 — Refresh metrics progress circle

Shared `RefreshMetricsProgressCircle` beside Refresh controls and on Search / Shortlist / exact-row cards. Live % from enrichment stage map (queued 18 → collecting 62 → 100); tones Done `#1D9E75` · Failed · Partial. Linger ~5s after terminal. Surfaces: `RefreshCreatorMenu` / `RefreshCreatorButton`, suite rows, shortlist banner. Skipped campaign workspace metrics-sync (different product action). No migrations.

## Shipped 2026-09-06 — Creator avatars after Refresh metrics

Avatar HTTP proxy no longer 404s low-res CDN / import crops when a profile upgrade is possible — serves usable bytes + `needsRefresh` (mirrors publication-preview). Similar creators rail now passes `avatarUrl`/`profileUrl` through `CreatorAvatarImage`. Client falls back to raw CDN before silhouette. Tests: `npm run test:media-proxy`.

## Shipped 2026-09-05 — Home & Executive pack dashboard

`/` and `/dashboard` now use the finance-suite pack from `docs/architecture/home-dashboard.html` (mast, page switcher, tiles, two-column cards/grids). Live data from `getHomeDashboardSnapshot` + `loadExecutiveDashboard`. Conflicts only when live figures disagree. Additive CSS: `app/styles/home-dashboard.css`. Frozen `discovery.css` untouched. Billing dirt left uncommitted.

## Shipped 2026-09-05 — Pack creator-details scrim (platform dim)

Portal host `.tw-cp-root` is a transparent fixed overlay so Search / Shortlist / Quotation stay visible under pack `.tw-scrim` (`rgba(11,15,26,.34)` + 1.5px blur). Opaque `.discovery-suite` page fill was hiding the platform behind the card.

## Shipped 2026-09-05 — Pack creator details tabs + Search chrome

Search · Shortlist · Quotation name click share `presentation="discoveryPack"`. Tab bodies now match `discovery.html` `creatorModal()`: Overview (`.tw-mgrid` / pricing / recent pubs), Contact (empty + enrichment), Publications (`.tw-pubs`), Confidence (`.tw-out` / `.tw-bar3` / categories / historical). Campaign/Studio stay `sheet`. Search card header uses pack Filters · Refresh metrics · + Add missing (`tw-dlg`); Filters is the pack `tw-dr` drawer. Flag image on the 84px profile avatar. Frozen `discovery.css` untouched. Billing dirt / probe scripts left uncommitted.

## Shipped 2026-09-05 — Quotation blank body (pass 5)

Root cause: body siblings after the masthead wrapper were clipped by nested DashboardShell/Discovery `overflow-hidden`. Fix matches shortlist: page outer `overflow-hidden` + workspace owns `overflow-y-auto`; metrics/lifecycle/creators render as **children inside** the same `discovery-suite` wrapper as the masthead (content that already painted). Sentinel line kept for Dev verify.

## Shipped 2026-09-04 — Discovery pack CLOSED

Pushed through `38523a9a` on `develop` (auto-deploys Dev). Module close: `npm run test:discovery-pack` green. Accepted deviations recorded in pack README. Manual Dev behavioural pass still needs a signed-in session (login gate).

## Shipped 2026-09-04 — Session 4b2 adapt D/E + Overlay F

Commit `26db1e38`. Spec Overlay D scratchpad model. Staged marking · Manual Platform/Tier · shared document-output + quotation adapter.

## Shipped 2026-09-04 — Session 4b selbar + calculator

Overlay B `.tw-selbar` (fixed, bottom 20px) + Overlay C pricing calculator (formula per mode, Client pays, three guards). Apply blocked when any line below cost. Deselect-all closes calculator. Live crawl: `npm run test:discovery-quotation-detail-4b`. Pure logic: `lib/quotations/quotation-pricing-calculator.ts`. Commit `3934f7b5`.

## Shipped 2026-09-04 — Session 4a quotation detail (partial)

Page 4a: `DiscoverySuiteGrid` `cols="quotation"` minW 1400 · lifecycle `tw-p` strip · client-review + approved block (GP 0 red) · filter chips `.z` · `+ Cost detail` · GP conflict note. Gate: `npm run test:discovery-quotation-detail-4a`. Commit `a94bafb6`.

## Shipped 2026-09-04 — Session 3 quotations list

Page 3 `/discovery/quotations`: `DiscoverySuiteGrid` `cols="quotations"` (track + minW 1300). Client `title=`; Client cost `F()` no currency in rows; masthead `Ccy EGP` once + Avg GP % tone `r`. Footer `N of M` + Lines + Client cost. Gate: `npm run test:discovery-quotations-page`. Commit `5648b956`.

## Shipped 2026-09-04 — Session 2 similar bands + live overlay crawl

Similar creators: Strong/Good match bands (no fake ordinal). Overlay crawl opens Edit URL / Combine / Add-creators live: `npm run test:discovery-shortlist-overlays`.

## Shipped 2026-09-04 — Session 2 grid engine + overlay gates

Shortlist detail paints `DiscoverySuiteGrid` `cols="shortlist"` (pack track + min-width 1360). Page 1 uses `cols="shortlists"`. Combine “cannot be undone”; Contact empty has **Run enrichment** button; platform switch locks `estimated_country`.

## Shipped 2026-09-04 — Session 1 + client-link foundation reopen

- Shortlists list `f8a76e4c`: pack track, Open-only Act, switch+dot. Acceptance **1100px** scroll; footer `N of M` + Creators `X of Y`.
- None vs Off: `.tw-live.none` grey; busy = switch opacity. `9b1ad84e`.
- Session 2 first pass: `042fc231` stats + modal (flex → grid conversion followed).

## Shipped 2026-09-04 — Vercel Turbopack `node:fs` on Shortlists

List imports `D`/`ini` from `lib/discovery/suite/helpers`. Barrel no longer re-exports class-coverage.

## Shipped 2026-09-04 — Discovery Session 0 foundation (FROZEN)

Pack: `docs/architecture/discovery-specs/`. Frozen CSS: `app/styles/discovery.css`. Helpers: `lib/discovery/suite/`. Gate: `npm run test:discovery-foundation`. Rule: `thinkway-discovery-css-readonly.mdc`. Commits: `cce992b3`, `8e41390e`.

## In progress 2026-09-04 — Discovery suite redesign (superseded by pack)

Prior hybrid suite CSS + page overrides paused. Rebuild constitution is discovery-specs pack (Session 0 above). Leave billing dirt uncommitted.

## In progress 2026-09-04 — Sidebar auto-hide tip

Unpinned nav no longer shows a 62px icon rail. Panel fully hides; only a center-edge pull tip remains. Hover left edge (or tip) peeks the 252px drawer; pin keeps it open. No migrations. Not on Production.

## In progress 2026-09-04 — Campaign display prefix Camp#

UI campaign numbers show `Camp#YYYY-N` / `Camp#YYYY-N-A` via `formatDocumentNumberForDisplay`. DB still stores `TW-YYYY-NNNN`. Lookup accepts Camp# → TW. Invoice Campaign No. uses the same display helper. No migrations. Not on Production.

Campaign details & PO governance now sits above Lifecycle Details as ops cards (same chrome as Health/Assignments). Removed collapse-table on Assignments, Workflow, Finance, Vendor IO, and Client IO Document workspace (kept Document & delivery details). Mini chrome scroll compensation so Vendor IO no longer jumps up while scrolling. KPI Revenue no longer ellipsis-clips. No migrations. Not on Production.

## In progress 2026-09-03 — Design spec remainder

Date SSOT `DD Mon YY` via `lib/design/format-design-date.ts`. Missing dates render `not set`. Zero money uses `#B6BECD`. Edit-mode revenue/cost tints. Selection calculator (4 modes, Apply via existing commercials action, mixed CCY blocked). Flying bar no longer sums mixed currencies. Finance suite 14px gutters + a11y. **Assignments register now uses shared CSS Grid `--cols`** for header, parent rows, child header, and child rows (sibling tracks; commercial save / selection / Edit→Save unchanged). No migrations. Not on Production.

## In progress 2026-09-03 — Campaign workspace HTML restyle (match pass)

Chrome through the tab rail stays frozen; only the body below tabs scrolls. Open Studio and View are white outline buttons. Stepper uses dots above labels (no icons/underline). Overview cards match pale HTML dash cards. Assignments creator cells show avatar + handle, money columns right-align, selected rows tint, nested ad lines have a blue rail. Creator name opens a centered split modal with Participation details tabs. Lifecycle OS, tabs, and actions preserved. No migrations. Not on Production.

## Shipped 2026-09-03 — Ungenerate then new invoice cancels pending

After un-generate, `/billing` and assignment Finance both offer **new vs existing**. Existing pending rebuilds that invoice number (with the draft %). A new invoice automatically cancels the old ungenerated one (`void`, shown as **Cancelled**). Assignments no longer stay stuck on Pending regeneration. Remaining stays in the billing queue. No migrations. Not on Production.

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
