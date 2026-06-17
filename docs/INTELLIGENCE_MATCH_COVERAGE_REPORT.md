# Intelligence Match Confidence Coverage Report

> **Generated:** 2026-06-16 · **Scope:** Read-only analysis of entity-resolution match coverage on `intelligence.int_influencers` vs operational `public` masters.  
> **No application code changes.** Supporting artifacts: `scripts/intelligence-match-coverage.ts`, `scripts/sql/match-coverage-*.sql`.  
> **Sources:** Live Supabase queries (`npx supabase db query --linked`), [`matchers.ts`](../lib/intelligence/entity-resolution/matchers.ts), [`influencer-merge.ts`](../lib/intelligence/entity-resolution/influencer-merge.ts), [`run.ts`](../scripts/intelligence-etl/run.ts), [`INTELLIGENCE_FINAL_DIAGNOSTIC.md`](./INTELLIGENCE_FINAL_DIAGNOSTIC.md), [`INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md`](./INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md).

---

## 1. Executive summary

**Match confidence coverage is 0.02% (2 / 11,504 warehouse influencers).** Entity resolution is working as coded; the ceiling is set by **sparse operational masters** (5 vendors, 9 platform handles, 0 overrides), not by a warehouse or UI bug.

Both successful matches are **exact normalized handle hits** at confidence **0.97** against `public.influencer_platform_accounts`. Fuzzy display-name matching (threshold **0.84**) against the five operational display names yields **zero** additional matches — historical Excel names are full legal names (e.g. `Amir Youssef Kamel Ibrahim`) while operational records use short names (e.g. `Amir Youssef`). **All 7,203 campaign-linked influencers shown in the Intelligence tab have `match_confidence = 0`**, including high-volume rows that now carry usernames after the identity merge.

Simulating the full matcher logic (handle path ∪ fuzzy name path) produces the **same 0.02%** — no uplift beyond what is already stored.

---

## 2. Warehouse counts

Live query against `intelligence.int_influencers` (post-merge, 2026-06-16).

| Metric | Count | % of 11,504 |
| --- | ---: | ---: |
| **Total influencers** | **11,504** | 100.00% |
| **`match_confidence > 0`** | **2** | **0.02%** |
| **Non-null / non-empty `username`** | **7,760** | 67.46% |
| **Non-null / non-empty `country`** | **7,846** | 68.20% |
| **Non-null / non-empty `tier`** | **6,265** | 54.46% |

### Provenance split (Database path vs campaign-path sparse)

Derived using the same rule as `isEnrichedInfluencer()` in [`influencer-merge.ts`](../lib/intelligence/entity-resolution/influencer-merge.ts): enriched if **any** of `country`, `tier`, or `username` is populated.

| Path | Count | % of total | Description |
| --- | ---: | ---: | --- |
| **Database sheet path** (enriched) | **7,846** | 68.20% | Registered from Excel **Database** sheet; source key `{display\|username}` |
| **Campaign-path sparse** (no country/tier/username) | **3,658** | 31.80% | Registered from campaign sheets only; source key `{name\|}` |

After identity merge, many campaign facts point at enriched keeper rows — hence campaign-linked rows can show country/tier/username even though they originated on the campaign path.

### Campaign-linked slice (`int_campaigns.int_influencer_id`)

| Metric | Count | % of 7,203 linked |
| --- | ---: | ---: |
| **Unique campaign-linked influencer IDs** | **7,203** | 100% |
| **`match_confidence > 0`** | **0** | **0%** |
| **Has `username`** | **3,541** | 49.16% |
| **Has `country`** | **3,546** | 49.23% |
| **Has `tier`** | **2,885** | 40.05% |

---

## 3. Operational master baseline

| Table | Count |
| --- | ---: |
| `public.influencers` | **5** |
| `public.influencer_platform_accounts` (handle rows) | **9** |
| `intelligence.entity_resolution_overrides` | **0** |

### Operational vendors and handles (live)

| Operational `display_name` | Handles |
| --- | --- |
| Amir Youssef | `amiryoussef.official` |
| Hussien Elmaghraby | `maaghrabyy`, `maghraaby` |
| Salma Mashhou | `mashhoursalma` |
| Shimaa Saber | `shimaasaber`, `shimasaber8` |
| Yousef Ayman | `yorokfreestyle` |

Only **`amiryoussef.official`** and **`shimaasaber`** appear in the warehouse with matching normalized usernames.

---

## 4. Top reasons influencers failed matching

### 4.1 Matcher logic (`resolveInfluencer`)

From [`matchers.ts`](../lib/intelligence/entity-resolution/matchers.ts) lines 138–165:

1. **Override lookup** — key `normalizeName(display)|normalizeHandle(username)` in `entity_resolution_overrides` → confidence **1.0** (0 overrides exist).
2. **Handle path** — normalize username; also try display name if it starts with `@`. Exact match against `influencer_platform_accounts.handle` → confidence **0.97**.
3. **Fuzzy name path** — `bestFuzzyMatch(displayName, operational influencers, minScore **0.84**)` → confidence = similarity score.

Normalization ([`normalize.ts`](../lib/intelligence/entity-resolution/normalize.ts)):

- **Name:** trim, lowercase, strip `@#`, collapse whitespace, remove non-letter/number punctuation.
- **Handle:** trim, lowercase, strip leading `@`.

### 4.2 ETL — when username is passed vs null

| Stage | Location | `resolveInfluencer` call |
| --- | --- | --- |
| Database sheet registration | `run.ts` ~L611 | `(display, **username**)` — handle path enabled |
| Campaign-only registration | `run.ts` ~L661 | `(name, **null**)` — handle path disabled |
| Per-campaign line aggregate | `run.ts` ~L698–702 | `(name, enrichedUsername)` — username from enrichment lookup when campaign name matches Database row |
| Post-merge re-resolution | `influencer-merge.ts` ~L174–184 | `(display_name_raw, username)` on **kept** rows; `match_confidence = max(existing, resolved)` |

Campaign-path registration explicitly passes **`null` username** (`run.ts` L661), so handle matching cannot run at registration time for sparse campaign rows. After merge, keepers may gain usernames from Database sheet enrichment, and `mergeInfluencerDimensions` re-runs resolution — but handles still fail unless the username exists in the **9 operational handles**.

### 4.3 Quantified failure buckets (11,504 warehouse rows)

| Failure reason | Count | % of warehouse |
| --- | ---: | ---: |
| **No username** on warehouse row | **3,744** | 32.55% |
| **Username present, no matching operational handle** | **7,758** | 67.44% |
| **Exact handle would match** (same as current matched) | **2** | 0.02% |
| **Handle matchable in ops but `match_confidence = 0`** | **0** | 0% |
| **Campaign-linked with null username** | **3,662** | 31.84% of all rows |
| **Display name fuzzy score below 0.84** (excluding handle hits) | **11,502** | 99.98% |

Additional context from prior diagnostics:

- **Sparse operational masters** — 5 vendors / 9 handles vs 11,504 warehouse identities ([`INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md`](./INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md) §3.2).
- **Campaign-path null username at registration** — primary blocker before merge; 3,662 linked rows still lack username ([`INTELLIGENCE_FINAL_DIAGNOSTIC.md`](./INTELLIGENCE_FINAL_DIAGNOSTIC.md) §2.5).
- **Name mismatch for fuzzy path** — operational names are short; warehouse Database rows use full legal names. Example: warehouse `Amir Youssef Kamel Ibrahim` vs operational `Amir Youssef` — handle match succeeds; fuzzy name does not reach 0.84.

---

## 5. Estimated coverage if matching used username + display name + normalized handle together

Simulation via `npx tsx scripts/intelligence-match-coverage.ts` (paginated full warehouse fetch, same normalization and thresholds as production code) plus SQL handle-path check.

| Path | Matched influencers | Coverage |
| --- | ---: | ---: |
| **(a) Exact normalized handle** (username or `@display`) | **2** | **0.02%** |
| **(b) Fuzzy display name ≥ 0.84** vs 5 operational names | **0** | **0.00%** |
| **(a) ∪ (b) deduplicated** | **2** | **0.02%** |
| **`resolveInfluencer` full replay** | **2** | **0.02%** |
| **Current stored `match_confidence > 0`** | **2** | **0.02%** |

### Overlap

| Set | Count |
| --- | ---: |
| Handle-only matches | 2 |
| Fuzzy-only matches | 0 |
| **Overlap (a ∩ b)** | **0** |

### Campaign-linked subset

| Metric | Value |
| --- | ---: |
| Campaign-linked influencers | 7,203 |
| Union match on linked slice | **0** (0.00%) |

**Conclusion:** Combining username, display name, and normalized handle matching **does not increase coverage beyond 2 / 11,504** given current operational data. The warehouse already stores the maximum achievable confidence under existing masters. Uplift requires **more operational vendors/handles**, **entity_resolution_overrides**, or **relaxed / multi-field matching** (e.g. partial-name fuzzy, cross-referencing warehouse usernames against a larger handle registry).

---

## 6. Sample rows

### 6.1 Rows with `match_confidence > 0` (2 total — all matched rows)

| `display_name_raw` | `username` | `platform` | `country` | `tier` | `match_confidence` | `resolved_influencer_id` | `source_keys` |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| Amir Youssef Kamel Ibrahim | amiryoussef.official | IG | Egypt | — | **0.97** | set | `Amir Youssef Kamel Ibrahim\|amiryoussef.official` |
| Shimaa saber montaser zakaria | shimaasaber | IG | Egypt | — | **0.97** | set | `Shimaa saber montaser zakaria\|shimaasaber` |

Both matched via **handle path** to operational handles `amiryoussef.official` and `shimaasaber`.

### 6.2 Top 10 high-volume campaign-linked influencers with `match_confidence = 0`

| `display_name_raw` | `username` | `country` | `tier` | Campaign lines |
| --- | --- | --- | --- | ---: |
| Sarah Alrashdan | mama.sara | KWT | Mega | 400 |
| Muasasat Bisimat Albashayir | bshaeer_h | Saudi Arabia | Mega | 358 |
| Arwa Aldahlaan | arwadhl | Saudi Arabia | Mega | 342 |
| Fatemah Misheal Baruk Alotaibi | fatemahotp | Saudi Arabia | Macro | 309 |
| Ashwaq Mohammed | saudistores_ | Saudi Arabia | Mega | 271 |
| Hanan al Ghamdi | Hanan.Snaps | Saudi Arabia | Macro | 226 |
| Malak Alanzi | malak20_r | Saudi Arabia | Macro | 203 |
| Abeer Fahd | abeeralghaith | Saudi Arabia | Macro | 199 |
| Nyx Barter Deal | — | — | — | 192 |
| Amna Abdullah | x__amona__x | Saudi Arabia | Macro | 181 |

Nine of ten have usernames and enriched country/tier after merge, but **none** of these handles exist in `public.influencer_platform_accounts`, so match confidence remains **0%** in the UI.

---

## 7. Recommendations (documentation only)

| Priority | Recommendation | Rationale |
| --- | --- | --- |
| **P1 — Data** | Bulk-import operational vendors from the Database sheet (or CRM) into `public.influencers` + `influencer_platform_accounts` | 7,760 warehouse rows already have usernames; 7,758 fail only because handles are absent from ops |
| **P1 — Data** | Seed `entity_resolution_overrides` for high-volume unmatched pairs (top-25 campaign influencers) | Immediate confidence = 1.0 without fuzzy ambiguity |
| **P2 — ETL** | On campaign-path registration, pass enriched username when `findEnrichedInfluencerId` matches (already partially done at line level; ensure keeper row gets re-resolved after merge) | Reduces null-username gap (3,662 linked rows) |
| **P2 — Matcher** | Add secondary fuzzy pass: token overlap or prefix match between warehouse `display_name_raw` and operational `display_name` below strict 0.84, or match warehouse username against a **historical handle registry** not limited to 9 ops rows | Would connect `Amir Youssef Kamel Ibrahim` ↔ `Amir Youssef` style pairs without manual overrides |
| **P3 — UI** | Label Match % as “Linked to operational vendor” with tooltip explaining sparse master dependency | Prevents misreading 0% as ETL failure ([`INTELLIGENCE_FINAL_DIAGNOSTIC.md`](./INTELLIGENCE_FINAL_DIAGNOSTIC.md) §2.4) |
| **P3 — Reporting** | Re-run this report after operational vendor import | Track coverage delta; expect large jump from handle path alone |

---

## Appendix: Key numbers table

| Metric | Value |
| --- | ---: |
| Warehouse influencers | 11,504 |
| Current match coverage | **2 (0.02%)** |
| Estimated union coverage (handle + fuzzy) | **2 (0.02%)** |
| Campaign-linked influencers | 7,203 |
| Campaign-linked with match > 0 | **0 (0%)** |
| Operational influencers | 5 |
| Operational handles | 9 |
| Entity resolution overrides | 0 |
| Rows with username, no ops handle | 7,758 (67.44%) |
| Rows with no username | 3,744 (32.55%) |

### Reproduce

```bash
npx supabase db query --linked -f scripts/sql/match-coverage-counts.sql
npx supabase db query --linked -f scripts/sql/match-coverage-failure-reasons.sql
npx tsx scripts/intelligence-match-coverage.ts
```
