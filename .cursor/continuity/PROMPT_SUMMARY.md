# Prompt Summary — Current Sprint

**Branch:** `feature/discovery-search-shortlist-fix` (from `develop`)  
**Focus:** Discovery creator search accuracy/speed + bulk shortlist add

## SHIPPED — Combine creators search + crash

- Slow picker: lightweight `browseUnifiedCreatorsForPickerAction` (no backfill/ECI)
- Crash after combine: try/catch + DNA cleanup + safer reassign; remove duplicate from list

## SHIPPED — Creator search + shortlist bulk add

- Commits: `3388b4df` / `77e0f821` on `develop` · `f5662b15` / `896a94af` on `main`
- Paste profile URL → `@handle` exact match only; name search keeps suggestions
- Fixed bare-word false Instagram parse; faster debounce; bulk shortlist insert
- Prod: `dpl_Cd1hS4C7F81z6cRCV6nGkxb8wy1j` → https://app.thinkwaymedia.com
- Dev: pushed to `develop` (auto Preview)

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
