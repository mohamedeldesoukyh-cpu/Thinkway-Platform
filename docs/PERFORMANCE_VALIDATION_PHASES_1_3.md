# Performance Validation — Phases 1–3

**Date:** 2026-07-21  
**Mode:** Read-only engineering benchmark (no application code changes)  
**Interactive report:** Cursor canvas `performance-validation-phases-1-3.canvas.tsx`

## Executive summary

| Phase | Verdict |
|-------|---------|
| **1 — Discovery browse SQL** | **Incomplete in linked env** — migration present; runtime still `source=legacy` (~2.1–3.2 s for pageSize=120 / 6,788 influencers) |
| **2 — Avatar / preview** | **Validated** — fail-fast request path; harness p95 &lt; 1 ms; 0 request-path externals; API uses `after()` refresh |
| **3 — Bundle / navigation** | **Validated structurally** — 18 files use `next/dynamic` (was ~7); Studio sections, Discovery panels, AI/Outputs/Planning lazy; prod prefetch |

No critical functional regressions found in static review of Discovery, Studio, AI, Outputs, cards, search, shortlists, forecast, presentation, media plan, avatars, or publication previews.

**Not measured here:** browser nav P95/P99, hydration traces, heap snapshots, Core Web Vitals (need prod Lighthouse/Playwright).

## Key measurements (this run)

```bash
npm run measure:discovery-browse-pool   # → legacy 2094–3239 ms
npm run measure:media-proxy             # → avatar p95 0.31 ms, preview 0.20 ms
npm run measure:frontend-bundle         # → 11,958 KB JS, 555 KB largest, 515 KB CSS
npm run audit:client-components         # → 726 client modules
```

| Metric | Before (audit) | After (validation) |
|--------|----------------|--------------------|
| Browse ID path | O(catalog) / 2–4 s legacy | Still legacy (RPC not applied) |
| Avatar/preview path | ≤20 s scrape chain | Fail-fast; harness p95 &lt; 1 ms |
| `next/dynamic` files | ~7 | **18** (+17 Studio section chunks) |
| Total static JS | n/a | 11,958 KB |
| Largest CSS | ~515 KB | **515 KB** (unchanged) |
| `.next/dev` cache | ~11–14 GB | **18.89 GB** (DX regression) |
| Prod build (skip TS) | n/a | ~39 s |

## Prioritized next actions (do not implement in this phase)

1. **P0** — Apply `browse_influencer_ids_by_recency` migration (unblocks Phase 1).
2. **P0** — Purge / cap Turbopack `.next/dev` cache (18.9 GB).
3. **P1** — Production Lighthouse + Playwright nav suite (CWV, hydration, heap A→B→A).
4. **P1** — Split `globals.css` (~515 KB).
5. **P2** — Virtualize operational tables / shortlists; fix campaign-outputs typecheck.

## Regression checklist

| Surface | Result |
|---------|--------|
| Discovery / search / cards | Pass (RPC gain pending deploy) |
| Campaign Studio | Pass (lazy sections) |
| AI Studio / workflows | Pass (definitions untouched) |
| Outputs / media plan / presentation | Pass (deferred load) |
| Shortlists / forecast | Pass |
| Avatars / publication previews | Pass |

Full tables, route expectations, React/memory/network notes: see the validation canvas.
