# Intelligence Final Reconciliation (Pre-ETL Sign-Off)

> Generated 2026-06-15 20:06:14. **Authoritative pre-ETL sign-off document** — analysis only, no database writes.
> Dry run: `INTELLIGENCE_ETL_DRY_RUN=1`

**Source file:** `c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx`

**Related (superseded for sign-off):** [`INTELLIGENCE_REVENUE_RECONCILIATION.md`](./INTELLIGENCE_REVENUE_RECONCILIATION.md) · [`INTELLIGENCE_PRELOAD_AUDIT.md`](./INTELLIGENCE_PRELOAD_AUDIT.md)

---

## Sign-off status

| Overall | **READY FOR ETL** |
| --- | --- |
| Harmonized campaign lines | 27,364 |
| Verification checks | 5/5 passed |

---

## Totals (harmonized, post header-normalize)

| Metric | Value |
| --- | ---: |
| **Revenue** | **$85,149,050** |
| **Cost** | **$65,913,972** |
| **Margin (GP)** | **$19,235,078** |
| **Margin %** | **22.6%** |

Commercial mapping: **revenue** = `Revenue ($) ROI` / `Revenue ($)` via `lookupValue` (first alias present in row); **cost** = `Cost ($)` / `Our Cost ($)` / `our cost`. Header normalization via `normalizeExcelHeader` resolves whitespace/punctuation variants (2023 fix).

---

## Revenue / cost / margin by source year (sheet tab)

Aggregated by `source_sheet` (2023–2026 campaign tabs). Margin = revenue − cost; margin % = margin ÷ revenue.

| Year | Lines | Revenue (USD) | Cost (USD) | Margin (USD) | Margin % |
| --- | --- | --- | --- | --- | --- |
| 2023 | 6,570 | $23,198,146 | $17,073,781 | $6,124,365 | 26.4% |
| 2024 | 5,276 | $18,513,306 | $13,980,313 | $4,532,993 | 24.5% |
| 2025 | 10,116 | $27,042,414 | $21,475,839 | $5,566,575 | 20.6% |
| 2026 | 5,402 | $16,395,184 | $13,384,038 | $3,011,146 | 18.4% |
| **Total** | 27,364 | $85,149,050 | $65,913,972 | $19,235,078 | 22.6% |

---

## Verification (must pass for sign-off)

| Check | Status | Detail |
| --- | --- | --- |
| No unmapped revenue fields remain | **PASS** | All revenue-pattern columns with data map to harmonizer aliases or are excluded (IO/local currency). |
| No unmapped cost fields remain | **PASS** | All cost-pattern columns with data map to harmonizer aliases or are excluded. |
| No failed parsers (revenue/cost money parse failures) | **PASS** | Revenue and cost parse cleanly. 1,421 non-blocking margin/markup/GP format issue(s) — harmonizer uses computed margin fallback. |
| No failed sheet mappings (each sheet harmonizes successfully) | **PASS** | All 4 campaign sheets present; filtered row count = harmonized row count. |
| No duplicate revenue columns counted twice (alias resolution) | **PASS** | One canonical revenue field per row via lookupValue alias order; no rows where summing all revenue columns would exceed harmonized value. |

### Harmonizer revenue alias resolution

`harmonizeCampaignRow` picks **one** revenue column per row — first alias whose normalized header exists in the row:

```typescript
parseMoney(lookupValue(normalized, "Revenue ($) ROI", "Revenue ($)"))
```

Double-count audit: rows where multiple revenue-pattern columns hold parseable money are flagged if the sum of all such columns exceeds the single harmonized value (would indicate alias-order bug or duplicate counting risk).

_No double-count risk rows detected._



---

## Unmapped revenue-like columns (with data)

Columns matching revenue name patterns, excluding harmonizer aliases and IO/local-currency fields:

| Sheet | Column | Non-null rows | Sum (USD) |
| --- | --- | --- | --- |
| — | _None_ | — | — |

---

## Unmapped cost-like columns (with data)

Columns matching cost name patterns, excluding harmonizer aliases and IO/local-currency fields:

| Sheet | Column | Non-null rows | Sum (USD) |
| --- | --- | --- | --- |
| — | _None_ | — | — |

---

## Parser failures (money / percent)

**Sign-off rule:** Only **revenue** and **cost** parse failures block ETL. Margin/markup/GP column misformats are non-blocking — harmonizer computes margin from revenue − cost when `Profit Margin %` fails (e.g. dollar amounts pasted into percent cells).

| Category | Count |
| --- | ---: |
| Critical (revenue / cost) | 0 |
| Non-blocking (margin / markup / GP) | 1,421 |
| **Total raw parse attempts failed** | 1,421 |

By field: `margin_pct` 1,337 · `markup_pct` 84

| Sheet | Row | Field | Raw value |
| --- | --- | --- | --- |
| 2024 | 279 | margin_pct | `$0` |
| 2024 | 280 | margin_pct | `$0` |
| 2024 | 1005 | margin_pct | `$0.10` |
| 2024 | 1007 | margin_pct | `$0.10` |
| 2024 | 1008 | margin_pct | `$0.10` |
| 2024 | 1009 | margin_pct | `$0.30` |
| 2024 | 1010 | margin_pct | `$0.40` |
| 2024 | 1011 | margin_pct | `$0.20` |
| 2024 | 1012 | margin_pct | `$0.10` |
| 2024 | 1013 | margin_pct | `$0.10` |
| 2024 | 1014 | margin_pct | `$0.50` |
| 2024 | 1015 | margin_pct | `$0.10` |
| 2024 | 1016 | margin_pct | `$0.10` |
| 2024 | 1017 | margin_pct | `$0.60` |
| 2024 | 1019 | margin_pct | `$0.10` |
| 2024 | 1020 | margin_pct | `$0.10` |
| 2024 | 1021 | margin_pct | `$0.10` |
| 2024 | 1022 | margin_pct | `$0.10` |
| 2024 | 1023 | margin_pct | `$0.10` |
| 2024 | 1046 | margin_pct | `$0.10` |




_Showing 20 sample rows (non-blocking)._

---

## Sheet harmonization

| Sheet | Raw rows | Filtered rows | Harmonized rows | Harmonized OK |
| --- | --- | --- | --- | --- |
| 2023 | 6,575 | 6,570 | 6,570 | Yes |
| 2024 | 16,050 | 5,276 | 5,276 | Yes |
| 2025 | 10,749 | 10,116 | 10,116 | Yes |
| 2026 | 10,749 | 5,402 | 5,402 | Yes |

---

## Method

1. Parse workbook with `xlsx` (same options as ETL).
2. Filter blank layout rows via `isCampaignDataRow`.
3. Harmonize with `harmonizeCampaignRow` (post `normalizeExcelHeader` fix).
4. Aggregate revenue/cost/margin by `source_sheet` (2023–2026).
5. Scan all campaign sheets for revenue/cost-like columns not consumed by harmonizer.
6. Audit alias resolution — one canonical revenue field per row via `lookupValue`.
7. Collect parse failures on money/percent fields.

Re-run:

```bash
INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:final-reconciliation
```

Do **not** run `npm run intelligence:etl` until this document shows all verification checks **PASS** and stakeholders sign off on headline totals.
