# Intelligence Preload Audit

> Generated 2026-06-15 03:22:29 from historical Excel workbook. **No database writes** — dry-run parse only.  
> **2023 header fix applied:** `normalizeExcelHeader` in `lib/intelligence/parsers/header-normalize.ts` — trims whitespace, collapses internal spaces, lowercases, and normalizes punctuation so `" Revenue ($) ROI "` / `Revenue($)ROI` map to the same canonical key as `Revenue ($) ROI`.

**Source file:** `c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx`

## Headline

| Metric | Value |
| --- | ---: |
| Harmonized campaign lines | 27,364 |
| Blank layout rows removed | 16,832 (32.0% of raw) |
| Total revenue (harmonized) | **$85,144,691** |
| Total cost (harmonized) | **$65,909,393** |
| Total margin / GP | **$19,235,298** |
| Margin % (GP ÷ revenue) | **22.6%** |
| Duplicate campaign keys | 0 |
| Duplicate influencer keys | 3,163 |
| Est. warehouse rows (campaigns raw) | 27,364 |

### Comparison vs prior harmonizer (same workbook, pre–header-normalization)

| Metric | Pre-fix harmonizer | **Current (post-fix)** | Δ |
| --- | ---: | ---: | ---: |
| Total revenue | $61,946,545 | **$85,144,691** | +$23,198,146 |
| Total cost | $65,909,393 | $65,909,393 | $0 |
| Margin / GP | -$3,962,848 | **$19,235,298** | +$23,198,146 |
| Margin % | -6.4% | **22.6%** | +29.0 pp |
| 2023 revenue | **$0** | **$23,198,146** | +$23,198,146 |

**Root cause (fixed):** Sheet `2023` xlsx header reads as `" Revenue ($) ROI "` (leading/trailing spaces). Exact-key lookup missed it; cost worked via `our cost`. Header normalization resolves all known aliases case- and punctuation-insensitively.

---

## Data quality & volume

### Rows per sheet

Blank rows are layout padding removed by `isCampaignDataRow` / `isDatabaseDataRow` (rows without influencer, revenue, cost, or camp/code identity).

| Sheet | Raw rows | Blank rows removed | Data rows kept |
| --- | --- | --- | --- |
| 2023 | 6,575 | 5 | 6,570 |
| 2024 | 16,050 | 10,774 | 5,276 |
| 2025 | 10,749 | 633 | 10,116 |
| 2026 | 10,749 | 5,347 | 5,402 |
| Database | 8,452 | 73 | 8,379 |
| **Total** | 52,575 | 16,832 | 35,743 |

### Duplicate campaigns

**Detection rules:** Primary key = normalized `Camp#` + `Code#` via `normalizeCampaignKey` / `normalizeCampaignDocumentNumber`. Fallback = normalized `Campaign Name` (`normalizeName`: lowercase, trim, collapse whitespace, strip punctuation). Rows sharing a key are counted as duplicates.

| Metric | Count |
| --- | ---: |
| Unique keys | 27,348 |
| Keys with duplicates | 0 |
| Extra rows (beyond first per key) | 0 |

**Top duplicate keys:**

_None detected._


### Duplicate influencers

**Detection rules:** Campaign sheets: `normalizeName(INFLUENCER)`. Database sheet: `normalizeName(display)|normalizeHandle(username)`. Duplicate = same normalized key on more than one row.

| Metric | Count |
| --- | ---: |
| Unique keys | 14,982 |
| Keys with duplicates | 3,163 |
| Extra rows (beyond first per key) | 20,702 |

**Top duplicate keys:**

- `sarah alrashdan|` — 400 rows
- `bashayer hamad|` — 358 rows
- `arwa aldahlaan|` — 342 rows
- `fatma el eteiby|` — 309 rows
- `saudi stores|` — 271 rows


### Duplicate clients

**Detection rules:** Key = `normalizeName(group)|normalizeName(client)` from harmonized `Group Name` + `Client Name`.

| Metric | Count |
| --- | ---: |
| Unique keys | 197 |
| Keys with duplicates | 174 |
| Extra rows (beyond first per key) | 20,546 |

**Top duplicate keys:**

- `loréal|loréal middle east fze` — 8313 rows
- `loréal|loréal saudi arabia llc` — 1502 rows
- `alshaya group|alshaya group` — 812 rows
- `|trendyol` — 623 rows
- `na|iherb` — 616 rows


### Duplicate brands

**Detection rules:** Key = `normalizeName(brand)|normalizeName(client)` from harmonized `Brand` + `Client Name`.

| Metric | Count |
| --- | ---: |
| Unique keys | 312 |
| Keys with duplicates | 278 |
| Extra rows (beyond first per key) | 20,432 |

**Top duplicate keys:**

- `garnier|loréal middle east fze` — 1596 rows
- `nyx professional makeup|loréal middle east fze` — 1245 rows
- `loréal paris|loréal middle east fze` — 1031 rows
- `maybelline new york|loréal middle east fze` — 927 rows
- `iherb|iherb` — 791 rows


---

## Rankings (harmonized filtered data)

Commercial fields: **revenue** = `revenue_usd` (`Revenue ($) ROI` / `Revenue ($)` via normalized header lookup); **cost** = `cost_usd` (`Cost ($)` / `Our Cost ($)` / `our cost`). Historical workbook has no UR/AF billable-base columns — rankings use revenue for client/brand spend and influencer revenue; cost shown for reference.

### Top 20 clients by spend (revenue)

| # | Client | Group | Revenue (USD) | Cost (USD) | Lines |
| --- | --- | --- | --- | --- | --- |
| 1 | L'Oréal Middle East FZE | L'Oréal | $17,816,288 | $15,713,972 | 8,313 |
| 2 | Trendyol | — | $4,432,417 | $3,510,910 | 623 |
| 3 | Alshaya Group | Alshaya Group | $4,004,882 | $3,077,765 | 812 |
| 4 | Spark Foundry FZ-LLC | Publicis Groupe | $3,422,278 | $2,134,502 | 473 |
| 5 | L'Oréal Saudi Arabia LLC | L'Oréal | $3,333,157 | $2,966,303 | 1,502 |
| 6 | FirstCry | — | $2,353,238 | $1,566,966 | 611 |
| 7 | Abdul Samad Al Qurashi Co. | Abdul Samad Al Qurashi Co. | $2,256,618 | $1,737,734 | 347 |
| 8 | OMD - Optimum Media Direction Co. | OMG | $2,110,873 | $1,717,959 | 286 |
| 9 | Veyron Co. LLC | Veyron Co. LLC | $1,344,926 | $923,369 | 340 |
| 10 | iHerb | N/A | $1,306,410 | $1,060,457 | 616 |
| 11 | Ounass | N/A | $1,049,250 | $926,882 | 242 |
| 12 | MAX Fashion | Landmark Retail Investment Co. L.L.C | $1,014,191 | $699,285 | 461 |
| 13 | Landmark Arabia Company | Landmark Retail Investment Co. L.L.C | $947,459 | $662,351 | 314 |
| 14 | Landmark Arabia Company | landmark Group | $741,108 | $366,404 | 191 |
| 15 | MMS Communications Saudi Arabia Limeted LLC | Publicis Groupe | $717,003 | $504,821 | 193 |
| 16 | iHerb | — | $697,077 | $573,106 | 175 |
| 17 | Al Qalzam | Al Qalzam Group | $681,562 | $544,203 | 121 |
| 18 | Level Shoes | N/A | $605,354 | $455,091 | 340 |
| 19 | Aramada | Armada Group | $592,859 | $422,976 | 425 |
| 20 | Ali Express | — | $553,964 | $465,801 | 86 |

### Top 20 brands by spend (revenue)

| # | Brand | Client | Revenue (USD) | Cost (USD) | Lines |
| --- | --- | --- | --- | --- | --- |
| 1 | Trendyol | Trendyol | $4,358,876 | $3,449,398 | 552 |
| 2 | watchalong + | Spark Foundry FZ-LLC | $3,081,001 | $1,919,966 | 413 |
| 3 | Garnier | L'Oréal Middle East FZE | $2,969,320 | $2,616,040 | 1,596 |
| 4 | FirstCry | FirstCry | $2,838,900 | $1,937,768 | 767 |
| 5 | Maybelline New York | L'Oréal Middle East FZE | $2,503,951 | $2,210,617 | 927 |
| 6 | ASQ | Abdul Samad Al Qurashi Co. | $2,256,618 | $1,737,734 | 347 |
| 7 | L’Oréal Paris | L'Oréal Middle East FZE | $2,247,254 | $2,005,456 | 1,031 |
| 8 | iHerb | iHerb | $2,003,488 | $1,633,563 | 791 |
| 9 | NYX Professional Makeup | L'Oréal Middle East FZE | $1,934,520 | $1,694,324 | 1,245 |
| 10 | Zain | OMD - Optimum Media Direction Co. | $1,676,357 | $1,397,260 | 147 |
| 11 | La Roche-Posay | L'Oréal Middle East FZE | $1,561,518 | $1,387,475 | 533 |
| 12 | Max KSA | Landmark Arabia Company | $1,534,729 | $909,593 | 446 |
| 13 | Ounass | Ounass | $1,049,250 | $926,882 | 242 |
| 14 | MAX Fashion | MAX Fashion | $1,014,191 | $699,285 | 461 |
| 15 | Level Shoes | Level Shoes | $1,012,870 | $755,866 | 536 |
| 16 | Vichy | L'Oréal Middle East FZE | $1,008,680 | $899,730 | 397 |
| 17 | Primark | Alshaya Group | $976,506 | $822,109 | 150 |
| 18 | Kérastase | L'Oréal Middle East FZE | $934,000 | $810,713 | 368 |
| 19 | YSL Beauty | L'Oréal Middle East FZE | $871,935 | $719,704 | 688 |
| 20 | Garnier | L'Oréal Saudi Arabia LLC | $785,755 | $702,867 | 268 |

### Top 50 influencers by revenue

| # | Influencer | Revenue (USD) | Cost (USD) | Lines |
| --- | --- | --- | --- | --- |
| 1 | Arwa Aldahlaan | $3,052,958 | $2,135,601 | 342 |
| 2 | Abeer Fahd | $937,035 | $690,015 | 199 |
| 3 | Bashayer Hamad | $835,143 | $571,656 | 358 |
| 4 | Nour Ghandour | $770,000 | $700,076 | 2 |
| 5 | arwa omran alomrani | $740,624 | $550,622 | 103 |
| 6 | Amani Al Hintti | $711,401 | $476,022 | 59 |
| 7 | Ibrahem Alhajjaj | $690,000 | $600,001 | 2 |
| 8 | Nouf Fashion | $688,458 | $511,827 | 40 |
| 9 | Sarah Alrashdan | $653,147 | $404,514 | 400 |
| 10 | Sarah Wadani | $611,233 | $465,150 | 34 |
| 11 | Amona x | $606,005 | $405,858 | 181 |
| 12 | Saudi panther | $587,421 | $503,999 | 99 |
| 13 | Saudi Stores | $534,741 | $396,282 | 271 |
| 14 | Yasmeen Dakheel | $530,305 | $395,923 | 85 |
| 15 | wejdan Abdelazez | $475,706 | $348,628 | 85 |
| 16 | Donna Ghada | $441,653 | $392,242 | 61 |
| 17 | Lama Alakeel | $437,678 | $341,066 | 60 |
| 18 | Style Najla | $420,415 | $323,484 | 63 |
| 19 | Arwa Alduhail | $397,133 | $290,946 | 47 |
| 20 | Youmna khoury | $390,612 | $291,392 | 86 |
| 21 | Fatma El Eteiby | $378,211 | $257,740 | 309 |
| 22 | Hanan Al ghamdi | $371,415 | $247,066 | 226 |
| 23 | Malak Alanzi | $345,803 | $229,687 | 203 |
| 24 | Roaa Al Sabban | $338,638 | $245,750 | 93 |
| 25 | newstarter4 | $310,298 | $228,000 | 19 |
| 26 | Alya alobaid | $306,344 | $216,059 | 132 |
| 27 | Najlaa Alwadaani | $300,354 | $241,796 | 21 |
| 28 | Saudi Malls | $294,524 | $203,062 | 180 |
| 29 | Maram Saleh AlHarbi | $290,740 | $259,240 | 36 |
| 30 | Hind Alqahtani | $281,815 | $240,000 | 16 |
| 31 | Noha Nabil | $279,692 | $210,492 | 19 |
| 32 | os.sksk | $276,522 | $213,351 | 10 |
| 33 | Abo Saad | $264,579 | $212,945 | 43 |
| 34 | Afnan Alghamdy | $255,668 | $176,908 | 66 |
| 35 | Trend News 24 | $254,424 | $196,143 | 42 |
| 36 | sarah_artist | $248,536 | $202,664 | 12 |
| 37 | Bessan Ismail | $242,301 | $215,843 | 28 |
| 38 | youssef_ali21 | $240,006 | $185,994 | 9 |
| 39 | Dr Hend | $236,729 | $163,290 | 10 |
| 40 | Majed Ibrahim Hassan Mohamed | $232,757 | $169,331 | 11 |
| 41 | Raghad Days | $232,232 | $200,402 | 16 |
| 42 | Taim Alfalasi | $213,776 | $168,936 | 42 |
| 43 | Atoosha 23 | $210,425 | $132,905 | 61 |
| 44 | 15 Meals | $201,618 | $180,259 | 16 |
| 45 | milatatari | $199,920 | $178,498 | 17 |
| 46 | Amany Alhenty | $191,300 | $133,340 | 20 |
| 47 | Bashar Care | $185,254 | $165,141 | 89 |
| 48 | Amira Abdelsalam | $184,863 | $116,149 | 36 |
| 49 | Layali Boker | $183,287 | $150,428 | 30 |
| 50 | Leen alshehri | $178,024 | $158,102 | 50 |

---

## Warehouse load estimates

Projected row counts after full ETL (`scripts/intelligence-etl/run.ts` logic, no truncate/dedup beyond upsert keys).

| Table | Estimated rows |
| --- | --- |
| `historical_campaigns_raw` | 27,364 |
| `historical_influencers_raw` | 8,379 |
| `int_campaigns` | 27,364 |
| `int_clients` | 197 |
| `int_brands` | 318 |
| `int_influencers` | 15,509 |
| `int_pricing_history` | 26,710 |
| `int_margin_history` | 27,347 |
| `int_benchmarks` | 253 |

---

## Method

1. Parse workbook with `xlsx` (same options as ETL).
2. Filter blank layout rows per sheet.
3. Normalize Excel column headers (`normalizeExcelHeader`) and harmonize campaign rows (`harmonizeCampaignRow`).
4. Build dimension maps and fact tables in memory (mirrors ETL dry-run).
5. Aggregate benchmarks via `buildBenchmarkAggregates`.

Re-run (analysis only — no ETL, no DB writes):

```bash
INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:preload-audit
```
