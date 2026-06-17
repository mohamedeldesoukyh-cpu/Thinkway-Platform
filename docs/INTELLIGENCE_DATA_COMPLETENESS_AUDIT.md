# Intelligence Data Completeness Audit

> **Generated:** 2026-06-16 · **Scope:** Read-only investigation of `/intelligence` field gaps (empty country/tier, match 0%, KPI zeros, empty-state banner, statement timeout).  
> **No code changes** were made for this report.  
> **Companion:** [`INTELLIGENCE_UI_DIAGNOSTIC.md`](./INTELLIGENCE_UI_DIAGNOSTIC.md) (query-timeout / contradictory UI).

---

## Executive summary

| User observation | Root cause | Data actually present? |
| --- | --- | --- |
| **Country empty (all rows)** | Influencer tab reads `int_influencers` rows linked from **campaign sheets** (7,344 identities). Those ETL records never receive `country` — only **Database** sheet rows do. Top-25 tab rows are 100% campaign-path. | Yes — **7,846 / 15,191** `int_influencers` rows have `country` (from Database sheet `Country` column), but **only 1** of 7,344 campaign-linked rows does. |
| **Tier empty (all rows)** | Same split: `tier` is mapped from Database sheet `Influencer Type` only. Campaign-path influencers have no tier. | Yes — **6,265** rows have `tier`; **0** campaign-linked rows. |
| **Match score 0% (all rows)** | UI shows `int_influencers.match_confidence` on campaign-linked rows. Entity resolution ran against **5** operational `public.influencers` + **9** handles; only **2** warehouse rows matched (handle hits at 0.97). Campaign ETL calls `resolveInfluencer(name, null)` — no username → no handle match → fuzzy name almost never hits 5 masters. | Confidence is correctly stored as **0** for 15,189 / 15,191 rows — not a UI bug. |
| **Vendors KPI = 0** | Q2 exact head count on `int_influencers` **times out** under authenticated parallel load; `count ?? 0` → **0**. Warehouse has **15,191** rows. | Data loaded; KPI is a **failed count query**. |
| **Campaign Lines KPI = 0** | Q1 exact head count on `int_campaigns` **times out** (same pattern). Warehouse has **27,364** rows. | Data loaded; KPI is a **failed count query**. |
| **Empty-state banner** | `dataAvailable` gates only on Q1 count (`queries.ts` line 154). Q1 timeout ⇒ banner despite other data. | Misleading false negative — see UI diagnostic. |
| **Statement timeout** | PostgreSQL `statement_timeout` on Q1 and/or Q2 when eight queries run in `Promise.all` under RLS. | Performance/query-shape issue, not missing data. |

**Headline:** Warehouse data is loaded and largely complete in source tables. The UI gaps are **(1) ETL identity split** — campaign vs Database influencer dimensions never merge, so the tab shows the sparse campaign slice — and **(2) near-empty operational masters** for entity resolution — plus **(3) count-query timeouts** masquerading as zero KPIs.

---

## 1. Total records (read-only DB counts)

Queried 2026-06-16 via `supabase.schema('intelligence')` with service role (credentials not printed). Same project as the app.

| Table | Row count | Notes |
| --- | ---: | --- |
| `historical_campaigns_raw` | **27,364** | Raw Excel campaign sheets (2023–2026) |
| `historical_influencers_raw` | **8,379** | Raw Excel **Database** sheet |
| `int_campaigns` | **27,364** | Harmonized campaign facts (1:1 with raw campaigns) |
| `int_influencers` | **15,191** | Warehouse influencer dimension |
| `int_benchmarks` | **253** | Benchmark mart — matches UI KPI |

Counts align with [`INTELLIGENCE_LOAD_REPORT.md`](./INTELLIGENCE_LOAD_REPORT.md) post-ETL validation.

---

## 2. `int_influencers` field population

### 2.1 Warehouse column stats (full table scan)

| Field | Populated | Null / empty | % populated |
| --- | ---: | ---: | ---: |
| `country` | **7,846** | **7,345** | 51.6% |
| `tier` | **6,265** | **8,926** | 41.2% |
| `resolved_influencer_id` | **2** | **15,189** | 0.01% |
| `match_confidence > 0` | **2** | **15,189** | 0.01% |

**Average `match_confidence`:** 0.00013 (essentially zero).

**Provenance split (derived):**

| Source path | Row count | Has `country` / `tier` / `username`? |
| --- | ---: | --- |
| **Campaign sheet** ETL (`fromCampaignOnly` — no country, tier, or username) | **7,345** | No |
| **Database sheet** ETL (`fromDatabase` — at least one of country, tier, username) | **7,846** | Yes |

Note: 7,345 + 7,846 = 15,191 — the two paths produce **disjoint** dimension rows (no merge).

### 2.2 Campaign-linked influencers (what the UI tab actually uses)

`int_campaigns.int_influencer_id` references **7,344** unique influencer IDs. Stats for those rows:

| Field | Populated among campaign-linked |
| --- | ---: |
| `country` | **1** |
| `tier` | **0** |
| `match_confidence = 0` | **7,344** (100%) |

**Top-25 simulation** (same logic as `queries.ts` Q6 + aggregation, PostgREST cap 1,000 rows):

| Metric | Value |
| --- | ---: |
| Rows fetched | 1,000 |
| Unique influencers in sample | 431 |
| Top 25 with null `country` | **25 / 25** |
| Top 25 with null `tier` | **25 / 25** |
| Top 25 with `match_confidence = 0` | **25 / 25** |

This matches the user report: every visible influencer row shows **—** for country/tier and **0%** match.

### 2.3 Source columns (ETL / harmonize)

#### Database sheet → `int_influencers`

ETL path: `scripts/intelligence-etl/run.ts` lines 503–538.

| Excel column (Database sheet) | Warehouse column | Raw payload coverage |
| --- | --- | ---: |
| `Country` | `country` | **8,377 / 8,379** rows in `historical_influencers_raw.payload` |
| `Influencer Type` | `tier` | **6,579 / 8,379** rows |
| `Nationality` | `nationality` | (stored, not shown in UI) |
| `Platform` | `platform` | Database rows |
| `Username` | `username` | Database rows |
| `Influencer NEW name` / `Influencer OLD Name` | `display_name_raw` / `legacy_name` | Database rows |

Sample raw payload keys include: `Country`, `Influencer Type`, `Platform`, `Username`, `Category`, `Nationality`, `Gender`, etc.

#### Campaign sheets → `int_influencers`

ETL path: `run.ts` lines 479–500 (harmonized campaign rows).

| Excel column (campaign sheets) | Warehouse column | Notes |
| --- | --- | --- |
| `INFLUENCER` (via `harmonize.ts` → `influencer_name_raw`) | `display_name_raw` | Only field used for identity |
| `Channel` | `platform` | Set on campaign-path record |
| — | `country`, `tier` | **Not mapped** — never written |

Campaign influencer source key: `` `${influencer_name_raw}|` `` (name only, no username).  
Database influencer source key: `` `${display}|${username}` `` (different namespace).

Because `int_campaigns.int_influencer_id` resolves via the **campaign** key (`influencerMap.get(\`${name}|\`)`), facts join to campaign-path rows that lack country/tier even when a richer Database-sheet row exists for the same person under a different key.

### 2.4 Sample populated values (Database path)

| `display_name_raw` | `country` | `tier` |
| --- | --- | --- |
| Teach Me Vogue | UAE | Macro |
| Abdelrahma TTashkandri | Saudi Arabia | Macro |
| Triq Alharbi | Saudi Arabia | Macro |
| Tarek Yehia | Saudi Arabia | Macro |
| Taraf Mohamed | Saudi Arabia | Macro |

---

## 3. Entity resolution

### 3.1 Match statistics

| Criterion | Count |
| --- | ---: |
| **Matched** (`resolved_influencer_id IS NOT NULL` OR `match_confidence > 0`) | **2** |
| **Unmatched** | **15,189** |
| `match_confidence = 0` | **15,189** |
| `match_confidence` in (0, 0.5) | 0 |
| `match_confidence` in [0.5, 0.9) | 0 |
| `match_confidence ≥ 0.9` | **2** |

### 3.2 Operational master data (entity resolution inputs)

Read from `public` schema at audit time:

| Master table | Row count |
| --- | ---: |
| `public.influencers` | **5** |
| `public.influencer_platform_accounts` | **9** |
| `intelligence.entity_resolution_overrides` | **0** |

The two successful matches (0.97 confidence) are **handle hits** against `influencer_platform_accounts`:

| `display_name_raw` | `match_confidence` | Match type |
| --- | ---: | --- |
| Shimaa saber montaser zakaria | 0.97 | Handle → operational influencer |
| Amir Youssef Kamel Ibrahim | 0.97 | Handle → operational influencer |

### 3.3 Why UI shows Match 0%

**Query path** (`features/intelligence/queries.ts`):

```94:100:features/intelligence/queries.ts
      db
        .from("int_campaigns")
        .select(
          "int_influencer_id, cost_usd, margin_pct, int_influencers(display_name_raw, username, platform, country, tier, match_confidence)"
        )
        .not("int_influencer_id", "is", null)
        .limit(8000),
```

Aggregation copies joined influencer confidence:

```183:183:features/intelligence/queries.ts
          match_confidence: Number(inf.match_confidence ?? 0),
```

**Render path** (`intelligence-influencers-tab.tsx`):

```55:57:features/intelligence/components/intelligence-influencers-tab.tsx
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {Math.round(row.match_confidence * 100)}%
                </td>
```

**Resolution logic** (`lib/intelligence/entity-resolution/matchers.ts` → `resolveInfluencer`):

1. Check `entity_resolution_overrides` → 0 overrides.
2. If `username` provided → exact handle match (threshold 0.97) → **9 handles, 2 hits** (Database path only).
3. Else fuzzy `displayName` vs `public.influencers` (threshold **0.84**) → **5 candidates**, campaign names rarely match.

Campaign ETL always calls `resolveInfluencer(masters, row.influencer_name_raw, **null**)` — step 2 is skipped. Historical Excel names do not fuzzy-match the 5 operational records, so `match_confidence` stays **0** and `resolved_influencer_id` stays **null**.

The UI displays **`int_influencers.match_confidence`**, not `int_campaigns.match_confidence` (which aggregates client + brand + influencer + campaign confidence per line). Even campaign-level confidence would be low, but the tab never reads it.

---

## 4. KPI queries — why Campaign Lines and Vendors show 0

Confirmed against [`INTELLIGENCE_UI_DIAGNOSTIC.md`](./INTELLIGENCE_UI_DIAGNOSTIC.md) and live timing.

### 4.1 Q1 — Campaign Lines = 0

| Property | Value |
| --- | --- |
| **Supabase call** | `db.from("int_campaigns").select("id", { count: "exact", head: true })` |
| **Maps to** | `stats.totalCampaignLines` (label **Campaign lines**) |
| **Actual warehouse count** | **27,364** |
| **UI shows 0 because** | Query errors with `canceling statement due to statement timeout`; `campaignCount.count` is `null` → `count ?? 0` |

### 4.2 Q2 — Vendors = 0

| Property | Value |
| --- | --- |
| **Supabase call** | `db.from("int_influencers").select("id", { count: "exact", head: true })` |
| **Maps to** | `stats.totalInfluencers` (label **Vendors**) |
| **Actual warehouse count** | **15,191** |
| **UI shows 0 because** | Same timeout + null coercion pattern as Q1 |

**Important:** **Vendors** counts `int_influencers` dimension rows, **not** `historical_influencers_raw` (8,379) and not operational `public.influencers` (5).

### 4.3 Empty-state banner

```154:154:features/intelligence/queries.ts
      dataAvailable: (campaignCount.count ?? 0) > 0,
```

Q1 failure alone triggers **"No intelligence data loaded yet"** even when Q3/Q5/Q6 return data — the contradictory state documented in the UI diagnostic.

### 4.4 Timing evidence (service role, 2026-06-16)

| Query | Sequential time | Result |
| --- | ---: | --- |
| Q1 (`int_campaigns` count) | **87 ms** | 27,364 |
| Q2 (`int_influencers` count) | **195 ms** | 15,191 |
| Q1 + Q2 + Q3 + Q6 parallel | **286 ms** | All succeed |

Timeouts occur under **authenticated RLS** when all **eight** queries run concurrently (three hitting `int_campaigns`), not when service role runs counts in isolation. See UI diagnostic § "Which query timed out".

---

## 5. Timeout query — exact PostgREST shape

### 5.1 Failing queries (high confidence)

**Q1 — exact campaign line count**

```http
GET /rest/v1/int_campaigns?select=id
Prefer: count=exact
Range: 0-0
```

Supabase JS equivalent:

```typescript
db.from("int_campaigns").select("id", { count: "exact", head: true })
```

**Q2 — exact vendor dimension count**

```http
GET /rest/v1/int_influencers?select=id
Prefer: count=exact
Range: 0-0
```

Supabase JS equivalent:

```typescript
db.from("int_influencers").select("id", { count: "exact", head: true })
```

**Error surfaced:** `canceling statement due to statement timeout` → appended to `data.warnings`.

### 5.2 Contributing concurrent load (same page request)

| ID | Table | Operation |
| --- | --- | --- |
| Q1 | `int_campaigns` | Exact `COUNT(*)` |
| Q3 | `int_campaigns` | `SELECT revenue_usd … LIMIT 5000` (effective 1,000) |
| Q6 | `int_campaigns` ⋈ `int_influencers` | Join `LIMIT 8000` (effective 1,000) |
| Q2 | `int_influencers` | Exact `COUNT(*)` |

Three concurrent accessors on `int_campaigns` under `intelligence.can_read_intelligence()` RLS increase plan time beyond the API statement timeout (~8s).

### 5.3 Existing indexes (reference)

From `20260623010000_intelligence_warehouse.sql`:

- `int_campaigns`: `source_sheet`, `market_entity`, `channel`, `int_influencer_id`, `period_year`
- `int_influencers`: unique identity index on `(display_name_raw, username, platform)` — no standalone count-friendly index

Exact `COUNT(*)` on full tables does not benefit meaningfully from FK/filter indexes.

### 5.4 Recommended optimizations (documentation only)

| Priority | Recommendation | Rationale |
| --- | --- | --- |
| **P0** | Replace live exact counts with **cached counts** (materialized view, `intelligence.stats` table updated post-ETL, or `pg_stat_user_tables.n_live_tup` via RPC) | Eliminates timeout on Q1/Q2; fixes KPI zeros and banner |
| **P0** | On count **error**, display **"—"** / **Unavailable**, not **0** | Prevents implying empty warehouse |
| **P1** | **Serialize** or dedupe `int_campaigns` reads on first paint (single query with subselects) | Reduces parallel contention |
| **P1** | Push revenue sum to SQL (`sum(revenue_usd)`) instead of fetching 1,000 rows | Cuts Q3 scan cost |
| **P2** | If counts must stay live, consider `COUNT(id)` via security-definer RPC with `statement_timeout` bump for intelligence schema only | Narrower than raising global API timeout |

Index-only optimizations alone are **unlikely** to fix exact-count timeouts under parallel RLS load; the fix is query-shape / caching.

---

## 6. Data completeness vs UI — reconciliation matrix

| UI element | Data source | Warehouse state | UI gap cause |
| --- | --- | --- | --- |
| Influencer names | Q6 → `int_influencers.display_name_raw` | 7,344 campaign-linked | Working |
| Platform | Q6 → `int_influencers.platform` | Populated on campaign path | Working |
| Country | Q6 → `int_influencers.country` | 7,846 rows globally; **1** campaign-linked | **ETL identity split** — tab uses campaign-path rows |
| Tier | Q6 → `int_influencers.tier` | 6,265 rows globally; **0** campaign-linked | **ETL identity split** |
| Match % | Q6 → `int_influencers.match_confidence` | 2 non-zero globally; **0** campaign-linked | **Sparse operational masters** + campaign ETL passes `username: null` |
| Hist. revenue | Q3 partial sum | ~$85M total in warehouse; KPI uses first 1,000 rows | Partial (PostgREST cap) but non-zero |
| Median margin | Q4 partial median | Data present | Working (subset) |
| Benchmark slices | Q5 count | 253 | Working |
| Vendors KPI | Q2 count | 15,191 | **Q2 timeout → 0** |
| Campaign lines KPI | Q1 count | 27,364 | **Q1 timeout → 0** |
| Empty banner | Q1 `dataAvailable` | Data present | **Q1 timeout → false** |

---

## 7. Recommended data fixes (documentation only)

These address **completeness** (country/tier/match), separate from query-timeout fixes in §5.4.

| # | Fix | Impact |
| --- | --- | --- |
| 1 | **Merge influencer identity** — unify campaign `` `name\|` `` and Database `` `name\|username` `` keys; enrich campaign-path rows from Database sheet by normalized name/handle | Country/tier appear on tab rows |
| 2 | **Propagate Database attributes** onto campaign-linked `int_influencers` via post-ETL UPDATE join on normalized display name + platform | Backfill without re-ingest |
| 3 | **Grow operational `public.influencers`** or add `entity_resolution_overrides` for high-volume historical names | Raises match_confidence above 0% |
| 4 | Pass campaign **username/handle** into `resolveInfluencer` when available from harmonized row | Enables handle matching (0.97 path) |
| 5 | Consider surfacing **`int_campaigns.match_confidence`** (aggregate) or a blended score in the tab | Aligns match column with line-level resolution |

---

## 8. Files traced

| File | Role |
| --- | --- |
| `docs/INTELLIGENCE_UI_DIAGNOSTIC.md` | Prior timeout / KPI-zero analysis |
| `features/intelligence/queries.ts` | Q1–Q8; `match_confidence` / country / tier payload |
| `features/intelligence/components/intelligence-influencers-tab.tsx` | Renders country, tier, match % |
| `features/intelligence/components/intelligence-workspace.tsx` | KPI labels; empty-state banner |
| `lib/intelligence/entity-resolution/matchers.ts` | `resolveInfluencer`, master loading |
| `scripts/intelligence-etl/run.ts` | Database vs campaign influencer registration |
| `lib/intelligence/parsers/harmonize.ts` | Campaign sheet field mapping |
| `supabase/migrations/20260623010000_intelligence_warehouse.sql` | Schema, indexes, RLS |

---

## Root cause (one line)

**Country, tier, and match % are empty in the UI because the influencer tab joins campaign-derived `int_influencers` rows (never enriched from the Database sheet) with near-zero entity-resolution confidence against 5 operational masters; KPI zeros and the empty-state banner are failed exact-count queries (Q1/Q2 timeout), not missing warehouse data.**
