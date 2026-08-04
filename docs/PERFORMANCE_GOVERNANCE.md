# Thinkway Performance Governance Guide

**Status:** Active (post Phases 1–4)  
**Owner:** Engineering  
**Goal:** Performance is continuously enforced in CI/CD — not periodically optimized.

This program does **not** change product functionality. It adds budgets, gates, reports, monitoring standards, and an internal engineering dashboard.

---

## 1. Performance budgets

Canonical config: [`performance/budgets.json`](../performance/budgets.json)  
Frozen comparison baseline: [`performance/baseline.json`](../performance/baseline.json)  
**Current floor:** Release 2.3 Stabilization (`8eebce9c`) — see [`PERFORMANCE_BASELINE_REPORT_R2_3.md`](./PERFORMANCE_BASELINE_REPORT_R2_3.md)

| Category | Metrics | Soft / hard |
|---|---|---|
| Bundle | Largest JS, largest CSS, total JS/CSS, assets ≥100KB, JS file count | See budgets.json |
| Source | Root globals CSS KB, client module count, largest client source file | See budgets.json |
| Regression | Growth % vs baseline (largest JS/CSS, total JS) | See budgets.json |
| Discovery browse | RPC required; wall ms (when Supabase secrets present) | API/SQL SLOs |
| Media proxy | Harness p95 + warm external request count | API SLOs |
| Routes | Tracked major routes (JS/CSS/hydration/nav via RUM + global gates) | `performance/routes/route-budgets.json` |
| RUM | LCP, INP, CLS, TTFB, FCP, long tasks, memory | `performance/monitoring/rum-slos.json` |
| API | P50/P95/P99, payload size, RPC latency | `performance/monitoring/api-slos.json` |
| SQL | Slow queries, seq scans, missing indexes, RPC timings | `performance/monitoring/sql-slos.json` |

**Soft** = warn in CI / dashboard. **Hard** = fail the build.

---

## 2. CI validation

Workflow: [`.github/workflows/validate.yml`](../.github/workflows/validate.yml)

After `npm run build`:

1. `npm run check:performance-budgets` — fails on hard budget / regression breaches  
2. `npm run report:performance` — writes `performance/reports/latest.json` + `.md`  
3. Uploads report artifact  
4. Optional: Discovery browse RPC measure (when Supabase secrets configured)  
5. Media proxy harness

Local:

```bash
npm run build
npm run validate:performance
```

Update baseline only after intentional, reviewed gains:

```bash
npm run report:performance -- --write-baseline
```

---

## 3. Bundle monitoring

- Collector: `scripts/lib/collect-performance-metrics.mjs`
- Check: `scripts/check-performance-budgets.mjs`
- Report: `scripts/generate-performance-report.mjs`
- Artifacts: `performance/reports/latest.json`, `latest.md`, `latest-check.json`
- Stamped history files (`report-*.json`) are gitignored; CI uploads latest

Reports compare against previous `latest.json` when present, else `baseline.json`, and highlight Δ KB / %.

---

## 4. Route performance

Tracked surfaces (see `performance/routes/route-budgets.json`):

Dashboard · Discovery · Campaign Studio · AI Studio · Outputs/Campaigns · Presentation/Reports · Media Planner · Login

**CI today:** global largest chunk + client/CSS source gates (Turbopack route graphs are not stable enough for hard per-route JS attribution).  
**RUM next:** per-route LCP/INP/CLS/TTFB/navigation against `rum-slos.json`.

---

## 5. API monitoring

Standards live in `performance/monitoring/api-slos.json`.

Measure P50/P95/P99, slow endpoints, large payloads, RPC latency.  
CI harnesses: `measure:discovery-browse-pool`, `measure:media-proxy`.

---

## 6. Database monitoring

Standards live in `performance/monitoring/sql-slos.json`.

Track slow queries, missing indexes, sequential scans, large joins, RPC timings.  
Discovery browse must remain on the indexed RPC path (`source: rpc`).

---

## 7. Real user monitoring (RUM)

Targets in `performance/monitoring/rum-slos.json`.

Collect: LCP, INP, CLS, TTFB, FCP, navigation, long tasks, memory.  
**Status:** planned (provider: Vercel Speed Insights / `web-vitals`). No client wiring in this governance pass (avoids product UI/behavior change).

---

## 8. Engineering dashboard

Internal: **`/system/performance`** (sidebar → Administration → Performance)

Shows: performance score, bundle budgets, trend vs baseline, source/route gate, API/SQL/RUM SLO status, violations, largest assets.

Data sources: committed budgets/baseline + last CI/local report JSON.

---

## 9. Documentation map

| Doc | Purpose |
|---|---|
| This file | Governance overview + CI |
| [`PERFORMANCE_ENGINEERING_STANDARDS.md`](./PERFORMANCE_ENGINEERING_STANDARDS.md) | Coding / lazy / client / bundle / CSS rules + checklist |
| [`PERFORMANCE_TECHNICAL_DEBT.md`](./PERFORMANCE_TECHNICAL_DEBT.md) | Remaining debt outside this governance pass |
| Phase docs | Browse SQL, avatar proxy, frontend nav, CSS architecture |

---

## Success criteria

- Hard budget breaches fail CI  
- Soft breaches visible in dashboard + CI logs  
- Bundle report generated on every production build in CI  
- Engineers have a single checklist before merge  
- Further gains are incremental under budgets — not ad-hoc “optimization seasons”
