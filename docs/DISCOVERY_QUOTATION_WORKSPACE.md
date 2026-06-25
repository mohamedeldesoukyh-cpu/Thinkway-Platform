# Phase 2.5 — Discovery, Shortlist & Client Quotation Workspace

Status: foundation + quotation vertical slice implemented on `feature/shortlist-v2`.
Reporting currency = **EGP**. Apify enrichment and the client portal UI are out of scope
(schema-ready only). Migrations are **NOT auto-applied** — push command at the bottom.

## 1. Foundation

### Migration
`supabase/migrations/20260703010000_quotations_commercial.sql` (additive, idempotent):

- **Commercial fields on `discovery_shortlist_items`**: `commercial_input_mode`
  (enum `commercial_input_mode`), `cost`, `cost_currency`, `gp_pct`, `gp_value`,
  `revenue`, `fx_rate_to_egp`, `cost_egp`, `revenue_egp`, `gp_value_egp`,
  `deliverables` (jsonb), `commercial_updated_at`.
- **`quotations`**: `serial_number` (QT-YYYY-NNNN), `name`, `status`
  (enum `quotation_status`), nullable `shortlist_id` / `client_id` / `brand_id` /
  `campaign_header_id`, `owner_id`/`created_by`/`approved_by`, `currency` (EGP),
  EGP totals (`total_cost_egp`, `total_revenue_egp`, `total_gp_value_egp`,
  `total_gp_pct`), `notes`, `terms`, signature block, client-portal-readiness
  columns (`client_visible`, `client_shared_at`, `client_shared_by`,
  `client_approval_status`, `client_comment`), `is_archived`, timestamps.
- **`quotation_items`**: links to influencer/profile + `source_shortlist_item_id`,
  snapshot fields (`creator_name`, `platform`, `handle`, `followers`,
  `engagement_rate`, `country_code`, `deliverables`), commercials in original
  currency + EGP-converted, `sort_order`.
- **`discovery_saved_filters`** + **`discovery_recent_searches`** (user-scoped,
  jsonb filter payloads) for spec §3.
- **Serial**: `generate_quotation_serial()` wraps the existing
  `next_document_number('QT-'||YYYY, 4)`; trigger `assign_quotations_serial`
  assigns on insert. Serials never reused, reset yearly, retained forever.
- **RLS**: mirrors `discovery_shortlists` patterns (owner OR `discovery.read/write/admin`)
  + `service_role`.

### FX reuse (no new FX system)
- Tables: `public.md_currencies`, `public.md_exchange_rates`.
- Resolution: `public.resolve_effective_exchange_rate(from, to, as_of)` RPC,
  wrapped server-side in `lib/commercial/fx-server.ts#resolveRateToEgp`.
- Currencies offered: **EGP (default), USD, AED, SAR, EUR, GBP** (`COMMERCIAL_CURRENCIES`).

### Types
`types/database.ts` extended with `Json`, `CommercialInputMode`, `QuotationStatus`,
the new `discovery_shortlist_items` commercial columns, and `quotations`,
`quotation_items`, `discovery_saved_filters`, `discovery_recent_searches` table types.

## 2. Commercial engine (pure, unit-tested)

`lib/commercial/commercial-engine.ts#computeCommercials(input)` — 3 modes:

| Mode | Inputs | Outputs |
|------|--------|---------|
| `cost_gp_pct` | Cost + GP% | Revenue, GP Value |
| `cost_revenue` | Cost + Revenue | GP%, GP Value |
| `cost_gp_value` | Cost + GP Value | Revenue, GP% |

Formulas: `Revenue = Cost / (1 - GP%)`, `GP Value = Revenue − Cost`,
`GP% = GP Value / Revenue`. Edge handling: GP% guarded to `[0, 100)` (100%+ rejected),
negative cost/revenue rejected, zero-cost/zero-revenue safe (no divide-by-zero),
money rounded to 2dp / percentages to 4dp, warnings for negative-GP cases.

## 3. FX aggregation (pure)

`lib/commercial/fx-aggregation.ts`: `toEgp(amount, rate)` (identity fallback when
rate missing), `aggregateEgpTotals(lines)` → EGP totals + **blended** GP%
(total GP / total revenue, not a naive average), `formatDualCurrency` → "500 USD / 25,000 EGP".

`features/quotations/quotation-engine.ts#normalizeCommercialLine` ties the commercial
engine + FX together into the persisted line shape; `computeQuotationTotals` aggregates.

## 4. Quotation serial helper
`features/quotations/serial.ts` validates/parses `QT-YYYY-NNNN` and guards against
collision with `TW-`/`SL-` spaces. Generation is Postgres-only.

## 5. Quotation engine + server actions
`features/quotations/actions.ts`:
- `createBlankQuotation` (manual, spec §9C)
- `createQuotationFromSelection` (temporary workspace from Discovery selection — spec §10)
- `createQuotationFromShortlist` (carries per-item commercials — spec §7)
- `addItemsToQuotation`
- `updateQuotationItemCommercials` (autosave per line — recomputes header totals)
- `updateQuotationHeader` (autosave name/notes/terms/links)
- `removeQuotationItem`, `archiveQuotation`

All gated by `discovery.write` / `discovery.admin`. FX resolved + snapshotted on write.

## 6. Export engine (reuses existing infra)
`app/api/quotations/[id]/export/route.ts?format=preview|excel|word|pdf`:
- **Preview / Word / PDF**: branded HTML (`export/quotation-html.ts`) — Word served as
  `.doc` (HTML, no new deps), PDF via existing `renderHtmlToPdf` (puppeteer).
- **Excel**: `export/quotation-excel.ts` reuses
  `lib/reports/document/excel-report-builder.ts#buildStyledExcelBuffer`.
- Pure document model: `export/quotation-document.ts` (creator table, EGP summary,
  notes, T&Cs, signatures). Matches VIO/CIO/Invoice quality + Thinkway palette (#1D9E75).

## 7. UI
- **Sidebar**: "Client Quotations" under Discovery (both sidebars + sub-nav).
- **List**: `/discovery/quotations` — serial, name, client/brand, status, creators,
  EGP revenue, GP%. "New Quotation" dialog (manual).
- **Workspace**: `/discovery/quotations/[id]` — EGP totals strip, export buttons,
  per-creator commercial editor (mode/cost/currency + dependent field) with **debounced
  autosave** (`lib/hooks/use-debounced-autosave.ts`) and saving/saved indicators, dual
  currency display, notes/terms autosave.
- **Entry points**: "Generate Quotation" on the shortlist workspace; "Generate Quotation"
  + quick-stats (selected / followers / est. reach / avg ER) in the Discovery search bulk bar.

## 8. Tests
- `npm run test:commercial-engine` — 3 modes, all edge cases, FX conversion, EGP aggregation.
- `npm run test:quotation-engine` — line normalization + EGP totals (mixed currencies).
- `npm run test:quotation-serial` — QT serial format + collision guards.
- `npm run test:quotations` — runs all three.

## 9. Deferred (next phase)
- Deep Discovery UX redesign (§1) beyond bulk-bar quick stats; right-side flyout panel
  persisted across pages (§2) — current selection actions live in the search bulk bar.
- Saved-filters / recent-searches UI (§3) — tables + RLS shipped; UI pending.
- Shortlist workspace tab split (Overview/Creators/Commercial/Quotation/Audit/Activity, §4)
  — Commercial autosave action shipped (`commercial-actions.ts`); tabbed UI pending.
- Client portal UI (§12) — schema-ready only.

## Push command (run by user — NOT auto-applied)

```bash
supabase db push
```
