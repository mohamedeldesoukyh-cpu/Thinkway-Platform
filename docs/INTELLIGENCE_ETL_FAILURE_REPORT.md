# Intelligence ETL Failure Report

> Generated 2026-06-15. **ETL paused** — do not re-run until blockers below are addressed.  
> Related: [`INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md`](./INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md) · [`INTELLIGENCE_FINAL_RECONCILIATION.md`](./INTELLIGENCE_FINAL_RECONCILIATION.md) · [`INTELLIGENCE_PRELOAD_AUDIT.md`](./INTELLIGENCE_PRELOAD_AUDIT.md)

---

## Executive summary

| Item | Status |
| --- | --- |
| **ETL outcome** | **FAILED** — exited before any warehouse inserts |
| **Failure phase** | Pre-load truncate (`INTELLIGENCE_ETL_TRUNCATE=1`) |
| **Root error** | `truncate historical_campaigns_raw: canceling statement due to statement timeout` |
| **Post-failure warehouse state** | All intelligence tables **empty** (0 rows) — verified read-only |
| **`docs/INTELLIGENCE_LOAD_REPORT.md`** | **Not created** (load never completed) |
| **Subagent transcript** | [`31a66dff-1dc3-468b-bb5f-268e832bd498`](agent-transcripts) — only 2 lines; planning started, ETL interrupted before post-load work |

---

## 1. Pre-load counts (before / during failed run)

Captured in [`INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md`](./INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md) immediately before the live ETL attempt. **First load** — warehouse was empty.

| Table | Pre-load count |
| --- | ---: |
| `historical_campaigns_raw` | 0 |
| `historical_influencers_raw` | 0 |
| `int_campaigns` | 0 |
| `int_clients` | 0 |
| `int_brands` | 0 |
| `int_influencers` | 0 |
| `int_pricing_history` | 0 |
| `int_margin_history` | 0 |
| `int_benchmarks` | 0 |

**Financial totals (pre-load):** revenue $0 · cost $0 · GP $0

---

## 2. Current warehouse state (post-failure, read-only)

Queried 2026-06-15 via service role (`supabase.schema('intelligence')`, count-only, no keys exposed).

| Table | Current count |
| --- | ---: |
| `historical_campaigns_raw` | 0 |
| `historical_influencers_raw` | 0 |
| `int_campaigns` | 0 |
| `int_clients` | 0 |
| `int_brands` | 0 |
| `int_influencers` | 0 |
| `int_pricing_history` | 0 |
| `int_margin_history` | 0 |
| `int_benchmarks` | 0 |

**Financial totals (post-failure):** revenue $0 · cost $0 · GP $0

**Conclusion:** No partial load. Failure occurred during truncate, before Excel parse → upsert pipeline ran.

---

## 3. Raw rows successfully loaded

| Layer | Expected (preload audit) | Actually loaded |
| --- | ---: | ---: |
| `historical_campaigns_raw` | 27,364 | **0** |
| `historical_influencers_raw` | 8,379 | **0** |

No raw or warehouse rows were inserted.

---

## 4. Failed operations (ETL log)

Source: `.etl-run.log` (local run output)

```
[intelligence-etl] Reading c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx
[intelligence-etl] Truncating warehouse tables…
[intelligence-etl] Failed: Error: truncate historical_campaigns_raw: canceling statement due to statement timeout
    at truncateWarehouse (scripts/intelligence-etl/run.ts:144)
    at async main (scripts/intelligence-etl/run.ts:253)
```

### What happened

1. ETL started with **`INTELLIGENCE_ETL_TRUNCATE=1`** (log shows “Truncating warehouse tables…”).
2. `truncateWarehouse()` issues PostgREST `DELETE … WHERE id != '00000000-…'` per table in FK-safe order (see `run.ts` lines 131–145).
3. Deletes for tables 1–8 likely completed (all were already empty).
4. **Last table** in the delete sequence — `historical_campaigns_raw` — hit Supabase **statement timeout** and aborted the entire run.
5. Excel read had not yet started; no upserts were attempted.

### Not observed in this run

- Insert/upsert errors
- Batch failures on `int_campaigns`, `int_pricing_history`, etc.
- Parser or harmonizer exceptions (dry-run and final reconciliation passed 5/5 checks)

---

## 5. Permission failures (42501, RLS, schema exposure)

| Check | Result |
| --- | --- |
| `42501` permission denied | **Not observed** — failure was timeout, not auth |
| RLS blocking service role | **Not observed** — ETL uses JWT service role (bypasses RLS) |
| Schema not exposed to PostgREST | **Not observed** — counts query succeeded on all 9 tables |
| Grants migration | `20260623020000_intelligence_schema_grants_fix.sql` exists; schema is readable/writable by `service_role` |

If UI users see empty `/intelligence` after a future successful load, check `intelligence.read` permission and `intelligence.can_read_intelligence()` — that is a **consumer** issue, not the cause of this ETL failure.

---

## 6. Entity resolution dependencies

`loadLiveMasters()` in `lib/intelligence/entity-resolution/matchers.ts` performs **read-only** parallel SELECTs:

| Source schema | Table | Purpose |
| --- | --- | --- |
| `public` | `groups` | Resolve historical group name → `resolved_group_id` |
| `public` | `clients` | Resolve legal entity name → `resolved_client_id` |
| `public` | `brands` | Resolve brand name (scoped to client) → `resolved_brand_id` |
| `public` | `influencers` | Fuzzy match display name → `resolved_influencer_id` |
| `public` | `influencer_platform_accounts` | Exact handle match → `resolved_influencer_id` |
| `public` | `campaign_headers` | Camp# / name → `resolved_header_id` |
| `public` | `campaign_lines` | Code# suffix → `resolved_line_id` |
| `intelligence` | `entity_resolution_overrides` | Manual admin overrides (confidence = 1) |

**Writes:** ETL never writes to operational tables. Resolved IDs are stored only on `intelligence.int_*` rows as nullable `resolved_*_id` + `match_confidence`.

**Failure mode:** In live (non–dry-run) mode, `loadMastersForRun()` does **not** fall back to empty masters — a failed master load throws and aborts ETL. Dry-run has try/catch → `EMPTY_MASTERS`.

---

## 7. Duplicate influencer identity examples

From [`INTELLIGENCE_PRELOAD_AUDIT.md`](./INTELLIGENCE_PRELOAD_AUDIT.md) (dry-run, no DB). Detection rules:

- **Campaign sheets:** `normalizeName(INFLUENCER)|` (no username on line rows)
- **Database sheet:** `normalizeName(display)|normalizeHandle(username)`
- **ETL warehouse dedup:** `influencerIdentityKey` = `display|username|platform` (lowercased trim) via `registerInfluencerDimension()` in `run.ts`

These are **expected duplicates at line grain** (same influencer, many campaign lines) — not insert failures.

| # | Normalized key | Row count | Notes |
| --- | --- | ---: | --- |
| 1 | `sarah alrashdan\|` | 400 | Campaign-sheet lines; empty username segment |
| 2 | `bashayer hamad\|` | 358 | High-volume KSA creator across years |
| 3 | `arwa aldahlaan\|` | 342 | Top revenue influencer (~$3.05M) |
| 4 | `fatma el eteiby\|` | 309 | Repeated line-level entries |
| 5 | `saudi stores\|` | 271 | Aggregated “store” vendor name |

**Warehouse impact:** 3,163 duplicate *keys* collapse to **15,509** `int_influencers` dimension rows (vs 27,364 campaign lines). ETL `influencerIdentityMap` merges identities sharing `display|username|platform`.

---

## 8. Fixes already applied (pre-ETL)

| Fix | Location | Effect |
| --- | --- | --- |
| **Header normalization** | `lib/intelligence/parsers/header-normalize.ts` | 2023 `" Revenue ($) ROI "` whitespace variant maps correctly; revenue restored from $0 → **~$23.2M** for 2023 |
| **parseMoney trailing `$`** | `lib/intelligence/parsers/money.ts` | Parses `799$`, `1,333$`, trailing spaces; tests in `intelligence-parsers.test.ts` |
| **Schema grants fix** | `supabase/migrations/20260623020000_intelligence_schema_grants_fix.sql` | `GRANT USAGE/SELECT/ALL` on `intelligence` for PostgREST + service_role ETL |
| **Influencer identity dedup** | `scripts/intelligence-etl/run.ts` | `registerInfluencerDimension()` + `influencerIdentityMap` prevents duplicate `int_influencers` for same display/handle/platform |
| **Margin percent clamp** | `scripts/intelligence-etl/run.ts` | `clampWarehousePercent()` avoids numeric overflow on `margin_pct` / `markup_pct` |
| **Final reconciliation sign-off** | `docs/INTELLIGENCE_FINAL_RECONCILIATION.md` | 5/5 checks passed; READY FOR ETL |

**Parser/harmonizer status:** 0 critical revenue/cost parse failures. 1,421 non-blocking margin/markup format issues (computed fallback).

---

## 9. Remaining blockers

| Priority | Blocker | Detail |
| --- | --- | --- |
| **P0** | Truncate statement timeout | `DELETE` via PostgREST on `historical_campaigns_raw` timed out even though warehouse was empty. Unnecessary on first load. |
| **P0** | Wrong truncate flag for first load | Snapshot doc said truncate not required; ETL was run with `INTELLIGENCE_ETL_TRUNCATE=1` anyway. |
| **P1** | Truncate implementation | Row-by-row `DELETE` through API is slower and more timeout-prone than SQL `TRUNCATE` (see go-live checklist Option B). |
| **P1** | Large upsert volume untested live | ~110k total rows (27k campaigns + 26k pricing + 8k raw influencers) — may hit timeouts on insert if statement limits are tight. |
| **P2** | Entity resolution hard dependency | Live ETL requires successful read of 7 `public.*` tables; no empty-master fallback (unlike dry-run). |
| **P2** | No load validation report | `INTELLIGENCE_LOAD_REPORT.md` not generated; financial reconciliation vs warehouse not performed. |

---

## Entity resolution: why operational masters are queried

Historical Excel stores **free-text names** (`INFLUENCER`, `Client Name`, `Brand`, `Camp#`). Thinkway’s operational DB stores **canonical UUID masters** with billing, assignments, and live KPIs.

Entity resolution bridges the two so Intelligence can answer:

- “Does this historical line match a **live campaign line**?” (`resolved_header_id`, `resolved_line_id`)
- “Is this historical vendor the **same person** as our live influencer record?” (`resolved_influencer_id`)
- “Which **legal entity / brand** does this historical spend belong to?” (`resolved_client_id`, `resolved_brand_id`)

Architecture explicitly requires confidence-scored links and **never writes back** to operational tables ([`THINKWAY_INTELLIGENCE_ARCHITECTURE.md`](./THINKWAY_INTELLIGENCE_ARCHITECTURE.md) §6.3).

---

## Can operational dependencies be removed?

| Dependency | Required for load? | Required for full product value? |
| --- | --- | --- |
| `public.clients`, `brands`, `groups` | **No** — warehouse stores `*_name_raw` regardless | **Yes** — client/brand drill-down to live ops |
| `public.influencers`, `influencer_platform_accounts` | **No** — `int_influencers` is self-contained | **Yes** — vendor profile ↔ live assignment comparison |
| `public.campaign_headers`, `campaign_lines` | **No** — facts load with `source_line_id` | **Yes** — “this deal vs historical benchmark” on live campaigns |
| `intelligence.entity_resolution_overrides` | **No** | **Yes** — manual match corrections |

**Code change needed to remove runtime dependency:** Mirror dry-run behavior — wrap `loadLiveMasters()` in try/catch and use `EMPTY_MASTERS` on failure. Warehouse rows would load with `resolved_*_id = null` and `match_confidence = 0`. No schema change required (`resolved_*` columns are already nullable).

---

## Can the Intelligence Warehouse load independently?

**Yes — for historical analytics standalone.**

The warehouse is designed as a **physically isolated `intelligence` schema**. Facts and dimensions are derived entirely from Excel:

| Data | Source |
| --- | --- |
| Raw JSONB payloads | Excel sheets |
| `int_clients`, `int_brands`, `int_influencers` | Harmonized strings + ETL-generated UUIDs |
| `int_campaigns`, margin, pricing, benchmarks | Harmonized campaign lines + Database sheet |

Operational linkage is an **enrichment layer**, not a load prerequisite. Dashboards labeled “Historical (Rev−Cost)” work without resolved IDs.

**Recommended path for independent first load:**

1. **Do not set** `INTELLIGENCE_ETL_TRUNCATE` — tables are empty ([`INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md`](./INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md)).
2. Run `npm run intelligence:etl` (no truncate step).
3. Optionally add empty-master fallback so a missing/unreachable `public.*` read does not block load.
4. Run entity resolution as a **second pass** once operational masters are stable, or populate `entity_resolution_overrides` over time.

---

## Expected vs actual (when load succeeds)

Reference from [`INTELLIGENCE_FINAL_RECONCILIATION.md`](./INTELLIGENCE_FINAL_RECONCILIATION.md) and preload audit:

| Metric | Excel harmonized | Warehouse (actual) | Variance |
| --- | ---: | ---: | ---: |
| Campaign lines | 27,364 | 0 | 100% |
| Revenue (USD) | $85,149,050 | $0 | 100% |
| Cost (USD) | $65,913,972 | $0 | 100% |
| GP (USD) | $19,235,078 | $0 | 100% |
| Margin % | 22.6% | — | — |

All validations **FAIL** until a successful ETL completes.

---

## Top blockers (action list)

1. **Skip truncate on first load** — warehouse is empty; `INTELLIGENCE_ETL_TRUNCATE=1` caused unnecessary DELETE and timeout.
2. **Replace API DELETE truncate with SQL `TRUNCATE`** for future reloads (see go-live checklist Option B), or increase statement timeout for service role.
3. **Verify Supabase statement timeout** — empty-table DELETE should not timeout; investigate locks, pooler settings, or run truncate in SQL Editor before ETL.
4. **Re-run ETL without truncate** when approved — expect ~6–14 min per go-live estimates.
5. **Generate `INTELLIGENCE_LOAD_REPORT.md`** after successful run with ±1% financial reconciliation.

---

## Recommendation: independent load

**Proceed with a standalone historical load** (no operational writes, optional entity resolution):

```powershell
# First load — do NOT set INTELLIGENCE_ETL_TRUNCATE
cd c:\thinkway-platform
npm run intelligence:etl
```

- **Entity resolution:** Defer or use empty masters; historical benchmarks and influencer intelligence work on `int_*` tables alone.
- **Operational linkage:** Add in Phase 2 when comparing historical vs live campaigns matters; not required to populate the warehouse.
- **Truncate:** Use only before **reload** when tables contain data; prefer SQL `TRUNCATE` over PostgREST bulk DELETE to avoid timeouts.

---

## References

- ETL runner: `scripts/intelligence-etl/run.ts`
- Entity resolution: `lib/intelligence/entity-resolution/matchers.ts`
- Schema client: `lib/intelligence/client.ts`
- Architecture: `docs/THINKWAY_INTELLIGENCE_ARCHITECTURE.md` §6.1–6.5
- Go-live / rollback: `docs/INTELLIGENCE_GO_LIVE_CHECKLIST.md`
- Pre-ETL sign-off: `docs/INTELLIGENCE_FINAL_RECONCILIATION.md`
