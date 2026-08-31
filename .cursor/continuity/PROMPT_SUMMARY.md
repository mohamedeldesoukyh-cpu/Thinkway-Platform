# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Quotation preview publication photo quality.

## Shipped 2026-08-31

### Publication photos (`7c3fb621` / Production `1d79e428`)
Recent publication tiles were posterized because truncated JPEG upgrades were re-encoded. Preview now rejects incomplete buffers and prefers complete stored screenshots.

- Development: https://dev.thinkwaymedia.com
- Production: https://app.thinkwaymedia.com — `dpl_AB6WoY1tvSKpGgJm7MesaThbbQ8B`
- No database migrations

### Quotation preview (`a7810f70`)
Followers as K/M; sharper avatars; unified quotation palette.

### Refresh Metrics (`f3c01635`)
First Refresh Metrics click no longer toasts "Creator refresh failed" while Apify is still running.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
