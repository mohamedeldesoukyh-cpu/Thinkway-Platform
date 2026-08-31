# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Shortlist Duplicate (list menu + selection bar) plus quotation preview/export fixes.

## In progress / shipping

### Shortlist Duplicate
Row ⋮ menu and selection-bar overflow: **Duplicate** copies the shortlist (creators, commercial, collapse groups, client/brand/campaign, currency, hide-cost flags) into a new **draft** with a new serial. Does not copy quotations, client links, or approval state.

### Quotation preview/export (develop)
- Higher-res publication images (prefer `displayUrl`, upgrade tiny CDN thumbs, compress 1080).
- Hide cost and fees = **Total Investment** only in preview/HTML/Word/PDF/PPTX (Excel stays internal).
- HTML download added next to Word / PDF / Excel / PPTX.

## Production release (2026-08-31)

- Host: https://app.thinkwaymedia.com
- Creator Workspace previously shipped on Production.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
