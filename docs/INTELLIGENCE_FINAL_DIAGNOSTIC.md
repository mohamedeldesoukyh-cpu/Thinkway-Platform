# Intelligence Final Diagnostic

> **Generated:** 2026-06-16 · **Scope:** Post-fix read-only investigation of remaining `/intelligence` issues: yellow timeout banner and Match % = 0%.  
> **No code changes** were made for this report.  
> **Sources:** [`INTELLIGENCE_FIX_IMPLEMENTATION_PLAN.md`](./INTELLIGENCE_FIX_IMPLEMENTATION_PLAN.md), [`INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md`](./INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md), live warehouse queries (service role, credentials not printed).

---

## Executive summary

| Issue | Status after P1–P4 fixes | Root cause (this investigation) |
| --- | --- | --- |
| **KPIs** (revenue, campaign lines, vendors, benchmarks) | **Working** — user-confirmed $85.1M, 27,364 lines, 11,504 vendors, 253 benchmarks | RPCs `get_workspace_counts` / `get_campaign_financial_totals` succeed under authenticated RLS |
| **Country / Tier / Handles** | **PASS** — merge enriched campaign-linked rows | ETL identity merge remaps `int_campaigns.int_influencer_id` to enriched `int_influencers` |
| **Yellow timeout banner** | **Still present** | One of four remaining PostgREST table queries in `Promise.all` exceeds `statement_timeout`; error appended to `warnings` |
| **Match % = 0%** | **Still present** | Warehouse stores `match_confidence = 0` on all 7,203 campaign-linked influencers; UI correctly reads `int_influencers.match_confidence` — sparse operational masters (5 vendors, 9 handles), not a join bug |

**Timeout query (highest confidence):** **Q4 — `int_margin_history` margin fetch** (`marginRows` in `queries.ts`).  
**Match %:** Data issue — only **2 / 11,504** warehouse rows have `match_confidence > 0`; **0** among campaign-linked IDs shown in the influencer tab.

---

## 1. Timeout investigation

### 1.1 Post-fix query inventory

`getIntelligenceWorkspace()` (`features/intelligence/queries.ts`) now runs **six** parallel queries (Q1/Q2/Q3/Q5 head counts and row-sum removed; replaced by RPCs).

| ID | Supabase call | Table(s) | Operation | Limits / filters | UI mapping | Tab-specific? |
| --- | --- | --- | --- | --- | --- | --- |
| **Q-RPC1** | `.schema("intelligence").rpc("get_workspace_counts")` | `int_campaigns`, `int_influencers`, `int_benchmarks` | `COUNT(*)` ×3 inside SECURITY DEFINER | None (full counts) | KPI **Campaign lines**, **Vendors**, **Benchmark slices** | Shared |
| **Q-RPC2** | `.schema("intelligence").rpc("get_campaign_financial_totals")` | `int_campaigns` | `SUM(revenue_usd, cost_usd, gp_usd)` SECURITY DEFINER | Full table aggregate | KPI **Hist. revenue** | Shared |
| **Q4** | `.from("int_margin_history").select("margin_pct").not("margin_pct", "is", null).limit(5000)` | `int_margin_history` | Row fetch + JS median | Non-null `margin_pct`; **effective max 1,000 rows** (PostgREST default) | KPI **Median margin** | Shared |
| **Q6** | `.from("int_campaigns").select("…, int_influencers(…)").not("int_influencer_id", "is", null).limit(8000)` | `int_campaigns` ⋈ `int_influencers` | Join + in-memory aggregation | Has influencer FK; effective max **1,000 rows** | **Influencer Intelligence** tab (`topInfluencers`, top 25) | Influencers tab data only; query runs on every page load |
| **Q7** | `.from("int_benchmarks").select(…).order("sample_size").limit(50)` | `int_benchmarks` | Row fetch | 50 rows | **Campaign Benchmarking** tab | Benchmarks tab data only; query runs on every page load |
| **Q8** | `.from("int_margin_history").select(…, int_campaigns(…)).eq("below_threshold_15pct", true).order("margin_pct").limit(40)` | `int_margin_history` ⋈ `int_campaigns` | Join fetch | Sub-15% margin; 40 rows | KPI **< 15% lines**; **Margin Protection** tab | Margin tab data only; query runs on every page load |

**Tab routing:** `app/(dashboard)/intelligence/page.tsx` calls `getIntelligenceWorkspace(tab)` once. Tab components (`intelligence-influencers-tab.tsx`, `intelligence-benchmarks-tab.tsx`, `intelligence-margin-tab.tsx`) render props only — **no additional fetches per tab**. The timeout is triggered on **shared workspace load**, not by switching tabs.

### 1.2 Warning source

```143:145:features/intelligence/queries.ts
    if (errors.length > 0) {
      warnings.push(...errors.map((e) => e?.message ?? "Unknown query error"));
    }
```

```98:101:features/intelligence/components/intelligence-workspace.tsx
      {data.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {data.warnings.join(" · ")}
```

Any failed query in the `Promise.all` bundle surfaces `canceling statement due to statement timeout` in the amber strip. Partial successes still return data (KPIs, tabs).

### 1.3 Which query times out

**Ruled out (user-confirmed working KPIs):**

| Query | Why ruled out |
| --- | --- |
| **Q-RPC1** | Campaign lines **27,364** and vendors **11,504** display correctly — RPC returned counts |
| **Q-RPC2** | Hist. revenue **$85.1M** displays correctly — RPC returned sum |
| **Q7** | Benchmarks **253** slices in KPI and tab — count from RPC; 50-row fetch is trivial |

**Remaining suspects:**

| Query | Timeout likelihood | Evidence |
| --- | --- | --- |
| **Q4 — `int_margin_history` margin fetch** | **Highest** | Full-table scan: **27,347** rows, **27,220** with non-null `margin_pct`; **no index on `margin_pct`** (only partial index on `below_threshold_15pct = true`). Filter `.not("margin_pct", "is", null)` cannot use the threshold index. Under authenticated RLS this is the heaviest remaining scan. |
| **Q6 — `int_campaigns` ⋈ `int_influencers` join** | **Medium** | **27,364** campaign rows; join embed + FK filter. Competes with Q-RPC1/Q-RPC2 (both also touch `int_campaigns`) and Q8 (join on `int_campaigns`) in the same `Promise.all`. |
| **Q8 — margin alerts join** | **Low** | Uses `below_threshold_15pct = true` (partial index), `limit(40)` — small result set. |
| **Q7 — benchmarks** | **Very low** | 253-row table, `limit(50)`. |

**Exact PostgREST shape — primary timeout candidate (Q4):**

```http
GET /rest/v1/int_margin_history?select=margin_pct&margin_pct=not.is.null&limit=5000
```

Supabase JS equivalent:

```typescript
db.from("int_margin_history").select("margin_pct").not("margin_pct", "is", null).limit(5000)
```

**Secondary candidate (Q6):**

```http
GET /rest/v1/int_campaigns?select=int_influencer_id,cost_usd,margin_pct,int_influencers(display_name_raw,username,platform,country,tier,match_confidence)&int_influencer_id=not.is.null&limit=8000
```

### 1.4 Execution timing (read-only, service role, 2026-06-16)

Service role bypasses RLS — timings establish a **floor**, not authenticated ceiling. Authenticated RLS + parallel contention is where timeouts occur (per [`INTELLIGENCE_UI_DIAGNOSTIC.md`](./INTELLIGENCE_UI_DIAGNOSTIC.md)).

| Query | Sequential | Parallel (6-way) | Rows returned | Table size | Error |
| --- | ---: | ---: | ---: | ---: | --- |
| Q-RPC1 `get_workspace_counts` | 800 ms | 235 ms | 0* | 27,364 / 11,504 / 253 | — |
| Q-RPC2 `get_campaign_financial_totals` | 238 ms | 90 ms | 0* | 27,364 campaigns | — |
| **Q4** `marginRows` | **418 ms** | **93 ms** | **1,000** | **27,347** (`27,220` non-null margin) | — |
| **Q6** `topInfluencerCampaigns` | **291 ms** | **304 ms** | **1,000** | **27,364** campaigns | — |
| Q7 `benchmarks` | 137 ms | 306 ms | 50 | 253 | — |
| Q8 `marginAlerts` | 459 ms | 263 ms | 40 | 27,347 margin rows | — |
| **Parallel total** | — | **~306 ms** | — | — | **No timeout** |

\*RPCs return **empty arrays** under service role because `intelligence.can_read_intelligence()` requires `auth.uid()` (authenticated internal user). Under logged-in UI sessions, RPCs return data (confirmed by working KPIs).

**Paired stress (service role):**

| Pair | Solo | Paired |
| --- | ---: | ---: |
| Q4 + Q6 | 207 ms / 123 ms | 323 ms / 104 ms |

No timeout under service role even under contention. Under **authenticated** load, Q4's unindexed `margin_pct` scan on ~27k rows is the query most likely to exceed Supabase's ~8s `statement_timeout` when running beside three other `int_campaigns` accessors (Q-RPC1 count, Q-RPC2 sum, Q6 join, Q8 join).

### 1.5 Concurrent `int_campaigns` load (post-fix)

Even after removing Q1/Q2/Q3 head counts, one page load still hits `int_campaigns` **four times** in parallel:

1. Q-RPC1 — `COUNT(*)` (SECURITY DEFINER)
2. Q-RPC2 — `SUM(revenue_usd)` (SECURITY DEFINER)
3. Q6 — join select (RLS)
4. Q8 — join select, 40 rows (RLS)

`int_margin_history` is hit **twice**: Q4 (broad scan) and Q8 (indexed, narrow).

### 1.6 Tab attribution

| Tab | Contributes to timeout? |
| --- | --- |
| **Influencer Intelligence** | Indirect — Q6 runs on every load regardless of active tab |
| **Campaign Benchmarking** | Indirect — Q7 runs on every load; unlikely to timeout |
| **Margin Protection** | Indirect — Q8 runs on every load; unlikely to timeout |
| **Shared workspace / KPI strip** | **Direct** — Q4 (median margin KPI) is the primary timeout suspect; Q-RPC1/Q-RPC2 already fixed KPI zeros |

**Conclusion:** Yellow banner is a **shared workspace load** issue, not caused by selecting a specific tab. Most likely failing query: **Q4 (`int_margin_history` margin fetch)**; runner-up: **Q6 (campaign ⋈ influencer join)**.

---

## 2. Match % investigation

### 2.1 Warehouse statistics (read-only, 2026-06-16)

Post-merge `int_influencers` (**11,504** rows, down from 15,191 pre-merge):

| Metric | Count | % of total |
| --- | ---: | ---: |
| Total `int_influencers` rows | **11,504** | 100% |
| `match_confidence > 0` | **2** | 0.02% |
| `resolved_influencer_id IS NOT NULL` | **2** | 0.02% |
| `match_confidence = 0` | **11,502** | 99.98% |
| **Average `match_confidence`** | **0.000169** | — |

**Campaign-linked slice** (unique `int_influencer_id` referenced by `int_campaigns`):

| Metric | Count |
| --- | ---: |
| Unique campaign-linked influencer IDs | **7,203** |
| With `match_confidence > 0` | **0** |
| With `resolved_influencer_id` set | **0** |
| With `country` populated | **3,546** |
| With `tier` populated | **2,885** |

Merge **fixed enrichment** (country/tier) but **did not raise match confidence** on campaign-linked rows.

### 2.2 Top 10 rows by `match_confidence`

| `display_name_raw` | `username` | `country` | `tier` | `match_confidence` | `resolved_influencer_id` |
| --- | --- | --- | --- | ---: | --- |
| Amir Youssef Kamel Ibrahim | amiryoussef.official | Egypt | — | **0.97** | set |
| Shimaa saber montaser zakaria | shimaasaber | Egypt | — | **0.97** | set |

Only these two rows have non-zero confidence. Both are **Database-sheet** identities with usernames; handle match against `public.influencer_platform_accounts` (threshold 0.97 in `resolveInfluencer`).

### 2.3 Operational master data (entity resolution inputs)

| Table | Row count |
| --- | ---: |
| `public.influencers` | **5** |
| `public.influencer_platform_accounts` | **9** |
| `intelligence.entity_resolution_overrides` | **0** |

### 2.4 UI render path

**Query (Q6)** joins `int_influencers.match_confidence`:

```104:110:features/intelligence/queries.ts
      db
        .from("int_campaigns")
        .select(
          "int_influencer_id, cost_usd, margin_pct, int_influencers(display_name_raw, username, platform, country, tier, match_confidence)"
        )
        .not("int_influencer_id", "is", null)
        .limit(8000),
```

Aggregation copies joined confidence once per influencer bucket:

```184:184:features/intelligence/queries.ts
          match_confidence: Number(inf.match_confidence ?? 0),
```

**Render:**

```55:57:features/intelligence/components/intelligence-influencers-tab.tsx
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {Math.round(row.match_confidence * 100)}%
                </td>
```

**Top-25 simulation** (same 1,000-row Q6 sample, sorted by line count):

| Check | Result |
| --- | ---: |
| Top 25 with `match_confidence = 0` | **25 / 25** |
| Top 25 with `country` populated | **25 / 25** |
| Top 25 with `tier` populated | **25 / 25** |
| Top 25 `match_pct` displayed | **0%** for all |

**UI is not using the wrong column** — it reads `int_influencers.match_confidence`. The join does not drop confidence; warehouse values are genuinely zero on campaign-linked rows.

**Not used:** `int_campaigns.match_confidence` (per-line aggregate of client + brand + influencer + campaign resolution from ETL). Even that field would be low given sparse masters, but the tab never reads it.

### 2.5 ETL — when `match_confidence` is set

| Stage | File / function | Behavior |
| --- | --- | --- |
| Database sheet registration | `run.ts` ~L611 | `resolveInfluencer(masters, display, username)` — handle path enabled when username present |
| Campaign-only registration | `run.ts` ~L661 | `resolveInfluencer(masters, name, **null**)` — no handle match |
| Enrichment reuse | `run.ts` ~L645–658 | Campaign key reuses enriched ID; does not copy confidence from keeper at registration time |
| Per-campaign line | `run.ts` ~L698–723 | `resolveInfluencer(masters, name, influencerUsername)` when enriched match found; stores aggregate on **`int_campaigns.match_confidence`**, not influencer row |
| Post-merge | `influencer-merge.ts` ~L174–184 | Re-runs `resolveInfluencer` on **kept** rows with username; `match_confidence = max(existing, resolved)` |
| Warehouse merge (incremental) | `run.ts` ~L351 | Same `mergeInfluencerDimensions` on reload |

**Why merge pass did not fix match %:**

1. **Sparse operational masters** — only 5 `public.influencers` and 9 handles; fuzzy name match (threshold 0.84) almost never hits; handle match requires exact normalized username in `influencer_platform_accounts`.
2. **Only 2 handle hits** in the entire warehouse — both Database-path rows with known usernames (`amiryoussef.official`, `shimaasaber`).
3. **Top-25 influencers** are high-volume **campaign-linked** identities; after merge they inherit country/tier from Database sheet but still lack usernames on many rows and do not fuzzy-match the 5 operational vendors.
4. **Campaign-path rows** that were merged into enriched keepers get `resolveInfluencer` re-run on the keeper (with username if present on keeper). Most keepers still resolve to confidence **0** because historical Excel names ≠ 5 operational display names.

### 2.6 Match % root cause (one line)

**Match % shows 0% because `int_influencers.match_confidence` is stored as 0 on all 7,203 campaign-linked warehouse rows — entity resolution has almost nothing to match against (5 operational vendors, 9 handles, 0 overrides), not because the UI reads the wrong field or the merge failed.**

---

## 3. Reconciliation with user-confirmed PASS items

| Check | Diagnostic alignment |
| --- | --- |
| Revenue $85.1M | Q-RPC2 `get_campaign_financial_totals` working; warehouse sum ~$85,149,050 |
| Campaign lines 27,364 | Q-RPC1 campaigns count working |
| Benchmarks 253 | Q-RPC1 benchmarks count working |
| Vendors 11,504 (post-merge) | Q-RPC1 influencers count working; merge reduced 15,191 → 11,504 |
| Country / Tier / Handles PASS | 3,546 / 2,885 campaign-linked enriched; top-25 all show country/tier in simulation |
| Influencer merge PASS | Merge remapped FKs; deduplicated identities |
| Timeout banner | Q4 (or Q6) still fails under authenticated parallel load |
| Match % 0% | Expected given 2/11,504 non-zero confidence globally, 0/7,203 campaign-linked |

---

## 4. Recommended fixes (documentation only)

### 4.1 Timeout (P5)

| Priority | Fix | Rationale |
| --- | --- | --- |
| **P0** | Replace **Q4** JS median with RPC `get_margin_median()` (or extend `get_campaign_financial_totals`) — `percentile_disc` on `int_margin_history.margin_pct` inside SECURITY DEFINER | Eliminates 27k-row RLS scan; same pattern as P2/P4 RPC fix |
| **P1** | Add index `CREATE INDEX … ON int_margin_history (margin_pct) WHERE margin_pct IS NOT NULL` | Speeds Q4 if row fetch must remain |
| **P1** | Push **Q6** top-influencer aggregation to SQL RPC (`GROUP BY int_influencer_id ORDER BY count DESC LIMIT 25`) | Removes 1,000-row join fetch + JS aggregation; reduces `int_campaigns` RLS contention with RPCs |
| **P2** | Split `Promise.all` into two phases: RPCs first, then table fetches — or serialize Q4 after RPCs | Reduces parallel pressure on large tables |
| **P2** | On timeout, show **which query failed** in warnings (query label prefix) | Faster future diagnosis |

### 4.2 Match % (P6)

| Priority | Fix | Rationale |
| --- | --- | --- |
| **P0** | **Grow operational vendor masters** (`public.influencers` + `influencer_platform_accounts`) toward historical name/handle coverage | Only durable way to raise `match_confidence` above 0% at scale |
| **P1** | Populate **`entity_resolution_overrides`** for high-volume historical identities | Immediate 1.0 confidence for known mappings without fuzzy guesswork |
| **P1** | Extract handles from campaign harmonized rows when `INFLUENCER` column contains `@handle` | Enables 0.97 handle path for campaign-only rows |
| **P2** | Surface **`int_campaigns.match_confidence`** (line-level aggregate) or `max(line confidence)` per influencer in Q6/RPC | Aligns match column with multi-entity resolution already computed at ETL |
| **P3** | Lower fuzzy threshold or add phonetic/normalized-Arabic name matching | Higher false-positive risk; only with human review queue |

### 4.3 Re-ETL / migration

| Change | Action |
| --- | --- |
| New median/join RPCs | Apply migration; **no re-ETL** |
| Index on `margin_pct` | Apply migration; **no re-ETL** |
| Operational vendor growth / overrides | **No ETL** — ops data entry |
| ETL handle extraction / override seeding | **Re-ETL or SQL patch** on `int_influencers.match_confidence` |

---

## 5. Files traced

| File | Role |
| --- | --- |
| `features/intelligence/queries.ts` | Post-fix six-query bundle; warnings; match_confidence in Q6 aggregation |
| `features/intelligence/components/intelligence-workspace.tsx` | Amber warnings strip; KPI carousel |
| `features/intelligence/components/intelligence-influencers-tab.tsx` | Match % render (`× 100`, rounded) |
| `supabase/migrations/20260624010000_intelligence_workspace_stats.sql` | `get_workspace_counts`, `get_campaign_financial_totals` RPCs |
| `supabase/migrations/20260623010000_intelligence_warehouse.sql` | Schema, RLS, indexes (no `margin_pct` index) |
| `scripts/intelligence-etl/run.ts` | Database vs campaign registration; merge; per-line `match_confidence` on campaigns |
| `lib/intelligence/entity-resolution/influencer-merge.ts` | Post-merge `resolveInfluencer` + confidence max |
| `lib/intelligence/entity-resolution/matchers.ts` | `resolveInfluencer` handle (0.97) / fuzzy (0.84) logic |
| `docs/INTELLIGENCE_FIX_IMPLEMENTATION_PLAN.md` | P1–P4 fix plan (implemented) |
| `docs/INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md` | Pre-fix audit (counts partially superseded by merge) |

---

## Appendix — quick reference

| Question | Answer |
| --- | --- |
| **Which query times out?** | **Q4** — `int_margin_history` `.select("margin_pct").not("margin_pct", "is", null).limit(5000)` (runner-up: **Q6** join) |
| **Which tab causes it?** | None specifically — all six queries run on shared workspace load |
| **Warnings source?** | Yes — `errors` from `Promise.all` → `warnings` array → amber banner |
| **`match_confidence > 0` count** | **2** / 11,504 |
| **Average `match_confidence`** | **0.000169** |
| **`resolved_influencer_id` not null** | **2** / 11,504 |
| **Campaign-linked `match_confidence > 0`** | **0** / 7,203 |
