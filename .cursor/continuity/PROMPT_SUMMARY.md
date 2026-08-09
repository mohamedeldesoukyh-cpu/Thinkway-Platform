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

## Shortlist / Quotation export quality — SHIPPED

- Commit: `f33bef57` — workspace selection SSOT · Preview chrome · PDF/PPTX layout
- Live smoke (Liwa): Selection · Preview · PDF · PPTX — **PASS**

## Hotfix — Quotation PPTX won't open in PowerPoint — SHIPPED

- Fix: `b95b72fd` — PNG icons + SVG guard
- Prod: aliased to https://app.thinkwaymedia.com

## Hotfix — Commercial Workspace Save reverts (priced deliverables) — SHIPPED

- **SSOT:** Quotation **line** Master columns are authoritative (`COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md`)
- **Cause:** Line Save left stale priced deliverables; remount preferred deliverable rollup over saved line
- **Fix commits:** `0e74e6b7` · `dffa31de` (Json cast)
- Prefer line Master on remount · strip deliverable commercials in same UPDATE · pending-diff cost/revenue always checked · rebuild drafts when no unsaved changes
- Regression: `lib/quotations/quotation-commercial-ssot-save-regression.test.ts`
- Preview: `dpl_BxySjuxkLi3SrUfStgN2JRTJCd8f` → https://dev.thinkwaymedia.com — Dev DB smoke **PASS**
- Production: `dpl_52DcUDavbMQnK4wCTfTnbPHfhnAe` → https://app.thinkwaymedia.com
- Prod UI smoke `QT-2026-0009-V2`: edit cost 21000→21111 · Save · hard remount · BASE COST **972,311** · CW shows **21111** — **PASS**

## Prior closed

**Apify Manual Refresh:** CLOSED · Production PASS (`937dd503`)  
**Studio + Creator Detail progressive load:** on `develop`

## Dev infra (separate)

Railway Dev worker crash — `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`
