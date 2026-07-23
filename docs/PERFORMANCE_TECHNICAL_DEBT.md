# Performance — Remaining Technical Debt

Governance (budgets, CI, dashboard, standards) is in place. The items below are **known debt**, not blockers for the governance program.

---

## High priority

| Item | Notes |
|---|---|
| **Per-route JS attribution** | Turbopack/App Router does not yet expose stable CI-friendly route→chunk maps. Tracked routes use global largest-chunk gates + RUM. Invest when Next exposes durable app-build manifests. |
| **RUM wiring** | `performance/monitoring/rum-slos.json` is defined; Speed Insights / `web-vitals` not yet installed/wired (intentionally skipped to avoid product behavior change). |
| **API percentile pipeline** | P50/P95/P99 SLOs are documented; need structured logging + aggregation (Vercel/log drain or OpenTelemetry) for continuous API trend on the dashboard. |
| **SQL continuous monitoring** | Rely on Supabase advisors / `pg_stat_statements`; no automated CI EXPLAIN suite yet beyond Discovery browse RPC harness. |

---

## Medium priority

| Item | Notes |
|---|---|
| **Campaign + platform-v6 CSS on all dashboard routes** | Shared operational table classes still pull large CSS into the dashboard shell. Further split needs careful class inventory. |
| **Creator search workspace size** | Largest client source (~72 KB) — candidate for further island splits when budgets approach soft limits. |
| **Duplicate dependency audit** | Manual rule today; add lockfile duplicate detector for heavy packages (charts, PDF, date libs) as a soft CI warn. |
| **Optional CI secrets** | Discovery RPC measure runs only when Supabase secrets are configured on the GitHub repo. |

---

## Low priority / DX

| Item | Notes |
|---|---|
| **`.next/dev` Turbopack cache growth** | Local disk bloat (can reach multi-GB). Document periodic `Remove-Item -Recurse .next` / clean scripts; not a production regression. |
| **Production typecheck debt** | Unrelated TS debt (e.g. campaign-outputs) can block full `tsc` / build without skips — fix independently so perf CI always runs on green typecheck. |
| **Stamped report history** | CI uploads latest only; long-term trend store (S3/artifact retention or committed sparkline) not yet built. |

---

## Explicitly out of scope for governance

- Product feature changes, Discovery ranking, billing, auth  
- Broad re-optimization without a budget breach  
- Redesigning operational workspaces for “perf aesthetics”

When debt is cleared, update this file and tighten soft budgets in `performance/budgets.json` if the new floor is stable.
