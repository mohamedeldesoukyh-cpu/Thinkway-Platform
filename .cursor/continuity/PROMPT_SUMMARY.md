# Prompt Summary — Current Sprint

**Branch:** `feature/discovery-search-shortlist-fix` (from `develop`)  
**Focus:** Discovery creator search accuracy/speed + bulk shortlist add

## In progress — Creator search + shortlist bulk add

- Paste profile URL → extract `@handle`, exact match only (no fuzzy wrong creators)
- Name-only search stays hybrid (suggestions OK)
- Fixed `parseProfileInput` treating bare words (`travel`, `reem`) as Instagram profiles
- Search debounce 700→280ms; exact lookup uses equality + smaller page
- Bulk shortlist: one server action + chunked insert (fixes 24 selected → ~12 saved)
- Tests: intent engine + parse-profile-url — PASS
- Not committed / not shipped yet

## Shortlist / Quotation export quality (ready to ship)

- Creator selection before Preview/Export; SSOT = workspace table selection (no sessionStorage)
- Selection summary before confirm: creator count · commercial totals · est. reach/ER
- Quotation `items` filter parity for Preview · PDF · PPTX (totals recalculate)
- Preview chrome: thumbnails · zoom · prev/next · creator/page counts
- Adaptive layout: full descriptions/notes · no zoom-scale shrink · PPTX measured text heights
- Commercial notes section on Quotation HTML + PPTX
- Validation: `npx tsx scripts/validate-shortlist-quotation-export-quality.ts` → **75/75 PASS** (incl. 50 creators)
- Report: `docs/architecture/SHORTLIST_QUOTATION_EXPORT_QUALITY_REPORT.md`

## Prior closed

**Apify Manual Refresh:** CLOSED · Enterprise Ready · Production PASS (`937dd503`)  
**Studio + Creator Detail progressive load:** on `develop`

## Dev infra (separate)

Railway Dev worker crash — `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`
