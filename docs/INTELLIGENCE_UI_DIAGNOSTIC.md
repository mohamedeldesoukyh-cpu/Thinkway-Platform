# Intelligence UI Diagnostic — Contradictory State

> **Generated:** 2026-06-16 · **Scope:** Read-only investigation of `/intelligence` contradictory UI (partial data + zero KPIs + empty-state banner + statement timeout).  
> **No code changes** were made for this report.

---

## Executive summary

| Observation | Explanation |
| --- | --- |
| **Benchmark slices = 253** | Q5 (`int_benchmarks` head count, 253 rows) succeeds — small table, fast exact count. |
| **Influencer tab populated** | Q6 (`int_campaigns` + join, `limit(8000)`) succeeds — PostgREST returns up to **1,000** rows; server aggregates top 25 influencers. |
| **Hist. revenue populated (non-zero)** | Q3 (`int_campaigns.revenue_usd`, `limit(5000)`) succeeds — sums first **1,000** non-null revenue rows (~$3.7M partial, not full $85M warehouse total). |
| **Campaign lines = 0** | Q1 (`int_campaigns` exact head count) **errors** → `count` is `null` → coerced to `0`. |
| **Vendors = 0** | Q2 (`int_influencers` exact head count) **errors** → same coercion. Label **Vendors** maps to `int_influencers` count, **not** `historical_influencers_raw`. |
| **"No intelligence data loaded yet" banner** | `dataAvailable` is `(campaignCount.count ?? 0) > 0` — only Q1 drives this flag; Q1 failure ⇒ banner even when other queries return data. |
| **"canceling statement due to statement timeout"** | PostgreSQL `statement_timeout` on one or more failed queries (almost certainly Q1 and/or Q2). Message surfaced via `data.warnings`. |

**Root cause:** The page fires **eight parallel queries** (`Promise.all`) against large `intelligence` tables. **Exact-count head requests** on `int_campaigns` (~27k rows) and `int_influencers` (~15k rows) compete with **three other concurrent scans** of `int_campaigns` (Q1, Q3, Q6) under **authenticated RLS**. Count queries exceed the DB/API statement timeout and return errors; limited `SELECT`s on the same tables complete and populate KPIs/tabs — producing the contradictory UI.

**Warehouse data is present** (verified read-only with service role). This is a **query-shape / timeout / partial-failure handling** issue, not missing ETL data.

---

## Request flow

```
app/(dashboard)/intelligence/page.tsx
  └─ IntelligenceWorkspaceLoader
       └─ getIntelligenceWorkspace(tab)          ← features/intelligence/queries.ts
            └─ createSupabaseServerClient()        ← anon key + user session cookies (authenticated)
            └─ intelligenceDb(supabase)            ← supabase.schema("intelligence")
            └─ Promise.all([ Q1…Q8 ])
       └─ <IntelligenceWorkspace data={…} />       ← features/intelligence/components/intelligence-workspace.tsx
            ├─ KPI carousel (from data.stats)
            ├─ empty-state banner (data.stats.dataAvailable)
            ├─ warnings strip (data.warnings)
            └─ Tabs (pure props — no additional fetches):
                 ├─ IntelligenceInfluencersTab   ← data.topInfluencers
                 ├─ IntelligenceBenchmarksTab    ← data.benchmarks
                 └─ IntelligenceMarginTab        ← data.marginAlerts
```

**Auth context:** `createSupabaseServerClient()` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the logged-in user's JWT (`lib/supabase/server.ts`). All intelligence reads go through RLS policy `intelligence.can_read_intelligence()` (requires authenticated internal user with `intelligence.read` or `campaigns.read`).

**Tab components do not execute queries** — they only render props from the server payload.

---

## Every query executed by `/intelligence`

All queries live in `getIntelligenceWorkspace()` (`features/intelligence/queries.ts`, lines 79–116), run once per page load inside `Promise.all`.

| ID | Supabase call | Table(s) | Operation | Limits / filters | UI mapping | Error handling |
| --- | --- | --- | --- | --- | --- | --- |
| **Q1** | `.from("int_campaigns").select("id", { count: "exact", head: true })` | `int_campaigns` | Exact row count (no rows returned) | Full table | KPI **Campaign lines** (`stats.totalCampaignLines`); **`stats.dataAvailable`** | Error → warning; `count ?? 0` |
| **Q2** | `.from("int_influencers").select("id", { count: "exact", head: true })` | `int_influencers` | Exact row count | Full table | KPI **Vendors** (`stats.totalInfluencers`) | Error → warning; `count ?? 0` |
| **Q3** | `.from("int_campaigns").select("revenue_usd").not("revenue_usd", "is", null).limit(5000)` | `int_campaigns` | Row fetch + JS sum | Non-null revenue; **effective max 1,000 rows** (PostgREST default) | KPI **Hist. revenue** (`stats.totalRevenueUsd`) | Error → warning; partial sum if rows returned |
| **Q4** | `.from("int_margin_history").select("margin_pct").not("margin_pct", "is", null).limit(5000)` | `int_margin_history` | Row fetch + JS median | Non-null margin; effective max 1,000 rows | KPI **Median margin** (`stats.medianMarginPct`) | Error → warning |
| **Q5** | `.from("int_benchmarks").select("id", { count: "exact", head: true })` | `int_benchmarks` | Exact row count | Full table (253 rows) | KPI **Benchmark slices** (`stats.benchmarkSliceCount`) | Error → warning; `count ?? 0` |
| **Q6** | `.from("int_campaigns").select("int_influencer_id, cost_usd, margin_pct, int_influencers(…)").not("int_influencer_id", "is", null).limit(8000)` | `int_campaigns` ⋈ `int_influencers` | Join + in-memory aggregation | Has influencer FK; effective max 1,000 rows | **Influencer Intelligence** tab (`topInfluencers`, top 25 by line count) | Error → warning; empty tab if no rows |
| **Q7** | `.from("int_benchmarks").select(…).order("sample_size", { ascending: false }).limit(50)` | `int_benchmarks` | Row fetch | Top 50 by sample size | **Campaign Benchmarking** tab (`benchmarks`) | Error → warning |
| **Q8** | `.from("int_margin_history").select(…, int_campaigns(…)).eq("below_threshold_15pct", true).order("margin_pct").limit(40)` | `int_margin_history` ⋈ `int_campaigns` | Join fetch | Sub-15% margin; 40 rows | KPI **< 15% lines** (`stats.lowMarginLineCount`); **Margin Protection** tab | Error → warning |

### Post-query logic (`queries.ts`)

```typescript
// Missing schema → full empty payload (all zeros, migration warning)
if (errors.some((e) => isMissingIntelligenceTableError(e?.message))) {
  return emptyPayload(tab, ["Intelligence schema not migrated yet…"]);
}

// Any other errors → warnings only; partial data still returned
if (errors.length > 0) {
  warnings.push(...errors.map((e) => e?.message ?? "Unknown query error"));
}

stats.dataAvailable = (campaignCount.count ?? 0) > 0;  // Q1 only
```

`isMissingIntelligenceTableError()` matches messages containing `intelligence` + (`does not exist` | `Could not find the table` | `schema cache`). A **timeout does not** trigger full empty payload — it triggers partial success.

---

## Which query timed out

**User-visible error:** `canceling statement due to statement timeout` — standard PostgreSQL `statement_timeout` (Supabase API/PostgREST default is typically **8s** per statement).

**Queries implicated (high confidence):**

| Query | Why it times out | Evidence |
| --- | --- | --- |
| **Q1** — `int_campaigns` exact count | Full-table `COUNT(*)` with RLS; **third concurrent** `int_campaigns` access in the same `Promise.all` (with Q3, Q6) | Drives **Campaign lines = 0** and **empty-state banner** |
| **Q2** — `int_influencers` exact count | Full-table exact count on ~15k rows under RLS, parallel with Q4/Q8 on `int_margin_history` | Drives **Vendors = 0** |

**Queries that succeed in the contradictory state:**

| Query | Why it succeeds |
| --- | --- |
| **Q5** | `int_benchmarks` has only **253** rows — count completes quickly → KPI shows **253**. |
| **Q3, Q6** | `LIMIT` + index-friendly plans return first page quickly (PostgREST caps at **1,000** rows regardless of `.limit(5000/8000)`). |
| **Q7** | 50-row fetch on small table. |
| **Q4, Q8** | `int_margin_history` limited selects; Q8 returns 40 rows. |

**Read-only verification (2026-06-16, service role, same project `.env`):**

- Sequential Q1: **864 ms**, count **27,364** — succeeds without timeout when not contending with parallel authenticated RLS load.
- Parallel `Promise.all` (service role, 3 runs): all 8 queries succeed in **227–336 ms** total — no timeout when RLS is bypassed.
- Unauthenticated anon (no JWT): all counts **0**, no timeout — RLS denies rows silently.

The timeout manifests under **authenticated** page load when count queries contend with parallel limited selects on the same large tables — not when service role runs counts in isolation.

---

## Why campaign lines = 0

1. **Q1** is the sole source of `stats.totalCampaignLines` (`campaignCount.count ?? 0`).
2. On statement timeout, PostgREST returns `error.message = "canceling statement due to statement timeout"` and **`count` is unset (`null`)**.
3. Nullish coalescing yields **`0`**.
4. The warehouse actually contains **27,364** campaign lines (see DB counts below).

This is **not** a filter returning zero rows — it is a **failed count query** displayed as zero.

---

## Why vendors = 0

1. KPI label **Vendors** maps to `stats.totalInfluencers` (`intelligence-workspace.tsx`, line 55–57).
2. That value comes **only from Q2**: `int_influencers` exact head count — **not** from `historical_influencers_raw`, not from Q6 aggregation, not from operational `public.influencers`.
3. Q2 failure (timeout) ⇒ `influencerCount.count ?? 0` ⇒ **Vendors = 0**.
4. Warehouse has **15,191** rows in `int_influencers`; **8,379** in `historical_influencers_raw`.

The influencer **tab** can still show rows because Q6 builds `topInfluencers` from `int_campaigns` joined to `int_influencers` (limited row fetch), independent of Q2's count.

---

## Why the empty-state banner still appears

**Condition** (`intelligence-workspace.tsx`, lines 104–115):

```tsx
{!data.stats.dataAvailable ? ( /* "No intelligence data loaded yet" */ ) : null}
```

**`dataAvailable` is set in one place** (`queries.ts`, line 154):

```typescript
dataAvailable: (campaignCount.count ?? 0) > 0,
```

| Scenario | Banner | Other KPIs/tabs |
| --- | --- | --- |
| Q1 succeeds, count > 0 | Hidden | Normal |
| Q1 fails (timeout), Q3/Q5/Q6 succeed | **Shown** | Partial data visible — **contradictory state** |
| `isMissingIntelligenceTableError` on any query | Full `emptyPayload` — banner + all zeros + migration message | Nothing |
| Authenticated user lacks RLS permission | All queries return 0, no timeout | All zeros, no partial data |

The banner text references migration/ETL, but in this incident **ETL has loaded data** — the banner is a **misleading false negative** because `dataAvailable` gates only on Q1's count, not on benchmarks, revenue, or tab row presence.

---

## Actual DB counts (read-only)

Queried via `supabase.schema('intelligence')` with **service role** JWT from local `.env` (credentials not printed). Same project as the app.

| Table | Row count | Notes |
| --- | ---: | --- |
| `historical_campaigns_raw` | **27,364** | Raw Excel ingest |
| `historical_influencers_raw` | **8,379** | Raw influencer sheet |
| `int_campaigns` | **27,364** | Warehouse campaign lines |
| `int_influencers` | **15,191** | Resolved influencer dimension |
| `int_benchmarks` | **253** | Benchmark mart — matches UI KPI |

Counts align with [`INTELLIGENCE_LOAD_REPORT.md`](./INTELLIGENCE_LOAD_REPORT.md) post-ETL validation. Data is loaded; UI zeros are query failures, not empty tables.

**Unauthenticated anon key:** all intelligence table counts return **0** (RLS — expected).

---

## Secondary findings (not causing the main contradiction but relevant)

### PostgREST 1,000-row cap

Despite `.limit(5000)` / `.limit(8000)`, read-only tests returned **1,000 rows** for Q3, Q4, and Q6. **Hist. revenue** and **median margin** KPIs are computed from a **subset** of warehouse data unless pagination is added.

### Parallel load on `int_campaigns`

In one page load, **three queries** hit `int_campaigns` simultaneously:

- Q1 — full exact count  
- Q3 — revenue row scan  
- Q6 — join scan  

This contention increases timeout risk for Q1 under RLS + remote latency.

### RLS policy (reference)

```sql
-- intelligence.can_read_intelligence()
auth.uid() IS NOT NULL
AND public.is_internal_user()
AND (has_permission('intelligence.read') OR has_permission('campaigns.read'))
```

User must be logged in as an internal role with read permission. Partial data proves RLS **allows reads**; timeout is a performance/plan issue on count, not total denial.

---

## Reproduction checklist

1. Log in as internal user with `intelligence.read` or `campaigns.read`.
2. Open `/intelligence` (any tab — data is fetched once server-side).
3. Observe amber warnings strip with `canceling statement due to statement timeout`.
4. Observe KPIs: Campaign lines **0**, Vendors **0**, Benchmark slices **253**, Hist. revenue **non-zero**.
5. Observe dashed **"No intelligence data loaded yet"** banner above KPI carousel.
6. Influencer and Benchmark tabs show tables; counts in KPI strip disagree with tab content.

---

## Recommended fixes (documentation only — not implemented)

1. **Do not use exact head counts** for large tables in parallel with row scans — use cached stats, materialized counts, or a single aggregated query.
2. **Set `dataAvailable`** from any successful warehouse signal (e.g. `benchmarkCount > 0 || topInfluencers.length > 0`), not Q1 alone.
3. **On count error**, show **"—"** or **"Unavailable"** instead of **0** to avoid implying empty warehouse.
4. **Paginate** revenue/margin sums or push aggregation to SQL (`sum(revenue_usd)`).
5. **Serialize or dedupe** `int_campaigns` access — avoid three concurrent queries on first paint.

---

## Files traced

| File | Role |
| --- | --- |
| `app/(dashboard)/intelligence/page.tsx` | Server page; calls `getIntelligenceWorkspace` |
| `features/intelligence/queries.ts` | All 8 Supabase queries + stats/tab payload |
| `features/intelligence/components/intelligence-workspace.tsx` | KPIs, banner, warnings, tab shell |
| `features/intelligence/components/intelligence-influencers-tab.tsx` | Renders `topInfluencers` only |
| `features/intelligence/components/intelligence-benchmarks-tab.tsx` | Renders `benchmarks` only |
| `features/intelligence/components/intelligence-margin-tab.tsx` | Renders `marginAlerts` only |
| `lib/intelligence/client.ts` | `intelligenceDb()`, `isMissingIntelligenceTableError()` |
| `lib/supabase/server.ts` | Authenticated server client (anon key + session) |
| `supabase/migrations/20260623010000_intelligence_warehouse.sql` | Schema, RLS, permissions |

---

## Root cause (one line)

**Q1 (`int_campaigns` exact count) and Q2 (`int_influencers` exact count) hit PostgreSQL statement timeout when run in parallel with other heavy intelligence queries under authenticated RLS; failures coerce to KPI zero and trigger the empty-state banner via `dataAvailable`, while limited SELECT queries succeed and populate other KPIs and tabs.**
