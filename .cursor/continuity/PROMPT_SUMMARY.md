# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Manual Refresh Metrics false-failure toast.

## Shipped 2026-08-31

### Refresh Metrics (`f3c01635`)
First Refresh Metrics click no longer toasts "Creator refresh failed" while Apify is still running. Poll window is 4 minutes; timeout while queued/collecting is not treated as failure.

- Development: https://dev.thinkwaymedia.com
- Production: https://app.thinkwaymedia.com — `dpl_4q4eoczADb8EmKjv8RFpa4c55sUy`

### Showcase photos (`6b391daa`)
Preview/export measures fetched images and upgrades tiny Instagram thumbs. Showcase avatars compress at 512px / q86.

### Earlier today
- Shortlist Duplicate (row ⋮ + selection bar); Production has no `discovery_shortlists.currency`
- Hide-cost quotations show Total Investment only; HTML download on preview toolbar

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
