# Intelligence 2023 Worksheet Audit

> Generated 2026-06-15 03:29:27. **Read-only audit** — no ETL, no database writes.

**Source file:** `c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx`  
**Sheet:** `2023`

---

## Executive summary

| Metric | Value |
| --- | ---: |
| Raw rows (xlsx) | 6,575 |
| Data rows kept (`isCampaignDataRow`) | 6,570 |
| **Current harmonizer revenue** | $23,198,146 |
| **Corrected revenue** (` Revenue ($) ROI `) | $23,198,146 |
| Harmonizer rows with non-zero revenue | 6,539 |
| Current harmonizer cost | $17,073,781 |

### Root cause of $0 revenue in preload audit

**Whitespace mismatch on header cell.** Excel row 1 displays `Revenue ($) ROI`, but xlsx reads the key as ` Revenue ($) ROI ` (JSON: " Revenue ($) ROI "). `harmonizeCampaignRow` looks up `row["Revenue ($) ROI"]` — exact key miss → `undefined` → revenue $0. Cost works because `our cost` matches exactly (harmonizer fallback `row["our cost"]`).

---

## Harmonizer mapping (from `lib/intelligence/parsers/harmonize.ts`)

`harmonizeCampaignRow` maps revenue as:

```typescript
const revenue = parseMoney(row["Revenue ($) ROI"] ?? row["Revenue ($)"]);
```

| Mapped column | Present in 2023? | Non-null rows | Sum (filtered) | Sample values |
| --- | --- | ---: | ---: | --- |
| `Revenue ($) ROI` | No | 0 | $0 | — |
| `Revenue ($)` | No | 0 | $0 | — |

**Recommended mapping for 2023:** ` Revenue ($) ROI `

**Why:** 2024 sheet uses `Revenue ($) ROI`, `Sales Person`. Sheet 2023 is missing: `Revenue ($) ROI`, `Sales Person`. 2023-only revenue-like columns: ` Revenue ($) ROI `.

---

## Header inspection

xlsx `sheet_to_json` uses **row 1** as headers. First rows of raw sheet:

**Row 1 (Excel):** Month | Date | INFLUENCER | Campaign Name | Entity | Country Manager | Team Leader | Channel | Team Member | Revenue ($) ROI | our cost | Went live | Campaign Type

**Row 2 (Excel):** Wed Nov 30 2022 23:59:51 GMT+0200 (Eastern European Standard Time) | Wed Nov 30 2022 23:59:51 GMT+0200 (Eastern European Standard Time) | Bashayer Hamad | FirstCry | Mais Janakat | Mais Janakat | Snapchat | Randa Mohsen | 2024 | 1687 | Yes | ROI

**Row 3 (Excel):** Wed Nov 30 2022 23:59:51 GMT+0200 (Eastern European Standard Time) | Wed Nov 30 2022 23:59:51 GMT+0200 (Eastern European Standard Time) | Amona x | FirstCry | Mais Janakat | Mais Janakat | Snapchat | Randa Mohsen | 2452 | 2133 | Yes | ROI

**Row 4 (Excel):** Sat Dec 31 2022 23:59:51 GMT+0200 (Eastern European Standard Time) | Mon Jan 02 2023 23:59:51 GMT+0200 (Eastern European Standard Time) | Lama Alakeel | Bath and Body Works GCC | Mais Janakat | kholoud Hendy | Snapchat | Kholoud Hendy | 8325 | 5506 | Yes | Fixed Budget

**Row 5 (Excel):** Sat Dec 31 2022 23:59:51 GMT+0200 (Eastern European Standard Time) | Mon Jan 02 2023 23:59:51 GMT+0200 (Eastern European Standard Time) | Amona x | Bath and Body Works GCC | Mais Janakat | kholoud Hendy | Snapchat | Kholoud Hendy | 3837 | 2133 | Yes | Fixed Budget

---

## All columns detected (sheet `2023`, row 1 headers)

Total: **13** columns

1. `Month` (JSON: "Month")
2. `Date` (JSON: "Date")
3. `INFLUENCER` (JSON: "INFLUENCER")
4. `Campaign Name` (JSON: "Campaign Name")
5. `Entity` (JSON: "Entity")
6. `Country Manager` (JSON: "Country Manager")
7. `Team Leader` (JSON: "Team Leader")
8. `Channel` (JSON: "Channel")
9. `Team Member` (JSON: "Team Member")
10. ` Revenue ($) ROI ` (JSON: " Revenue ($) ROI ")
11. `our cost` (JSON: "our cost")
12. `Went live` (JSON: "Went live")
13. `Campaign Type` (JSON: "Campaign Type")

---

## Revenue-related columns

| Column | Non-null count | Sum (USD) | Sample values |
| --- | --- | --- | --- |
| ` Revenue ($) ROI ` | 6,539 | $23,198,146 | `2,024.00`, `2,452.00`, `8,325.00`, `3,837.00`, `2,915.00` |

---

## Cost-related columns

| Column | Non-null count | Sum (USD) | Sample values |
| --- | --- | --- | --- |
| `our cost` | 6,563 | $17,073,781 | `$1,687`, `$2,133`, `$5,506`, `$350`, `$2,150` |

---

## Margin-related columns

| Column | Non-null count | Sum (USD) | Sample values |
| --- | --- | --- | --- |


---

## Other numeric columns (revenue candidates)

Columns with ≥50% parseable money values that do not match revenue/cost/margin name patterns:

| Column | Non-null count | Sum (USD) | Sample values |
| --- | --- | --- | --- |
| `our cost` | 6,563 | $17,073,781 | `$1,687`, `$2,133`, `$5,506`, `$350`, `$2,150` |

---

## 2024 column comparison (revenue fields)

| 2024 revenue column | In 2023? |
| --- | --- |
| `Revenue ($) ROI` | No |
| `Sales Person` | No |

---

## Sample 100 data rows (key columns)

| `Campaign Name` | `Month` | `Entity` | `INFLUENCER` | ` Revenue ($) ROI ` | `our cost` | `Date` | `Channel` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FirstCry | Dec-22 | — | Bashayer Hamad | 2,024.00 | $1,687 | 2022-12-01 | Snapchat |
| FirstCry | Dec-22 | — | Amona x | 2,452.00 | $2,133 | 2022-12-01 | Snapchat |
| Bath and Body Works GCC | Jan-23 | — | Lama Alakeel | 8,325.00 | $5,506 | 2023-01-03 | Snapchat |
| Bath and Body Works GCC | Jan-23 | — | Amona x | 3,837.00 | $2,133 | 2023-01-03 | Snapchat |
| Bath and Body Works GCC | Jan-23 | — | Danah Awadh Almutairi | 2,915.00 | $350 | 2023-01-04 | Snapchat |
| Bath and Body Works GCC | Jan-23 | — | Abeer Fahd | 3,859.00 | $2,150 | 2023-01-04 | Snapchat |
| Bath and Body Works GCC | Jan-23 | — | Al Hanof Abdulaziz | 7,583.00 | $4,588 | 2023-01-05 | Snapchat |
| FirstCry | Jan-23 | — | Amona X | 2,847.00 | $2,136 | 2023-01-27 | Snapchat |
| FirstCry | Jan-23 | — | Bayan Om Hassan | 800.00 | $600 | 2023-01-27 | Snapchat |
| FirstCry | Jan-23 | — | Saudi Malls | 1,630.00 | $1,223 | 2023-01-29 | Snapchat |
| FirstCry | Jan-23 | — | arwa omran alomrani | 9,144.00 | $6,860 | 2023-01-27 | Snapchat |
| FirstCry | Jan-23 | — | Arwa Aldahlaan | 9,178.00 | $5,987 | 2023-01-27 | Snapchat |
| FirstCry | Jan-23 | — | Malak Alanzi | 1,457.00 | $1,093 | 2023-01-27 | Snapchat |
| FirstCry | Jan-23 | — | Maha Alseari | 13,399.00 | $9,319 | 2023-01-27 | Snapchat |
| FirstCry | Jan-23 | — | Fatma El Eteiby | 1,140.00 | $855 | 2023-01-28 | Snapchat |
| FirstCry | Jan-23 | — | Bashayer Hamad | 2,109.00 | $1,687 | 2023-01-28 | Snapchat |
| FirstCry | Feb-23 | — | Yasmeen Dakheel | 5,980.00 | $4,000 | 2023-02-06 | Snapchat |
| FirstCry | Feb-23 | — | Bayan Om Hassan | 4,080.00 | $600 | 2023-02-07 | Snapchat |
| ASQ | Jan-23 | — | Saudi Malls | 1,630.00 | $1,065 | 2023-01-26 | Snapchat |
| ASQ | Jan-23 | — | Arwa Aldahlaan | 9,178.00 | $5,987 | 2023-01-28 | Snapchat |
| ASQ | Jan-23 | — | arwa omran alomrani | 10,198.00 | $6,860 | 2023-01-30 | Snapchat |
| ASQ | Feb-23 | — | Alya alobaid | 2,915.00 | $2,187 | 2023-02-04 | Snapchat |
| ASQ | Feb-23 | — | Maha Alseari | 9,144.00 | $6,652 | 2023-02-06 | Snapchat |
| Cider | Feb-23 | — | Lama Stylist | 2,000.00 | $1,000 | 2023-02-02 | Insta Story |
| Cider | Feb-23 | — | Fatma El Eteiby | 2,333.00 | $855 | 2023-02-05 | Snapchat |
| Cider | Feb-23 | — | Lama Alakeel | 5,304.00 | $4,797 | 2023-02-09 | Snapchat |
| Cider | Feb-23 | — | Amona x | 4,057.00 | $2,187 | 2023-02-09 | Snapchat |
| Oud Milano | Feb-23 | — | Saudi Stores | 2,008.00 | $1,598 | 2023-02-16 | Snapchat |
| Oud Milano | Feb-23 | — | Bashayer Hamad | 2,109.00 | $1,467 | 2023-02-22 | Snapchat |
| Oud Milano | Feb-23 | — | Nora Alali | 1,318.00 | $917 | 2023-02-27 | Snapchat |
| Oud Milano | Feb-23 | — | Arwa Sayegh | 1,165.00 | $932 | 2023-02-28 | Snapchat |
| ASQ | Feb-23 | — | Majed Ibrahim Hassan Mohamed | 26,666.00 | $18,000 | 2023-02-20 | Twitter Campaign |
| FirstCry | Feb-23 | — | Atoosha 23 | 3,059.00 | $2,000 | 2023-02-25 | Snapchat |
| FirstCry | Feb-23 | — | Arwa Aldahlaan | 8,951.00 | $5,987 | 2023-02-26 | Snapchat |
| FirstCry | Feb-23 | — | Amona X | 2,887.00 | $1,902 | 2023-02-26 | Snapchat |
| FirstCry | Feb-23 | — | Saudi Malls | - | $1,064 | 2023-02-26 | Snapchat |
| FirstCry | Feb-23 | — | Saudi Malls | 1,591.00 | $1,064 | 2023-02-19 | Snapchat |
| FirstCry | Feb-23 | — | Fatma El Eteiby | - | $855 | 2023-02-26 | Snapchat |
| FirstCry | Feb-23 | — | Fatma El Eteiby | 1,283.00 | $855 | 2023-02-19 | Snapchat |
| FirstCry | Feb-23 | — | Saudi Stores | 2,113.00 | $1,589 | 2023-02-26 | Snapchat |
| FirstCry | Feb-23 | — | Bayan Om Hassan | 822.00 | $600 | 2023-02-27 | Snapchat |
| FirstCry | Feb-23 | — | Bashayer Hamad | 2,244.00 | $1,467 | 2023-02-27 | Snapchat |
| FirstCry | Feb-23 | — | Malak Alanzi | 1,672.00 | $1,093 | 2023-02-27 | Snapchat |
| ASQ | Feb-23 | — | Alya Alobaid | 4,479.00 | $3,246 | 2023-02-25 | Snapchat |
| ASQ | Feb-23 | — | Mashaal Al Hewemal | 5,768.00 | $4,180 | 2023-02-21 | Snapchat |
| ASQ | Feb-23 | — | Nawaf Jamal Aljamea | 12,903.00 | $9,350 | 2023-02-21 | Snapchat |
| ASQ | Feb-23 | — | Saad ateeq Alhamzi | 4,800.00 | $4,000 | 2023-02-21 | Snapchat |
| ASQ | Feb-23 | — | Bdour ahmed alrajhi | 9,599.00 | $8,000 | 2023-02-22 | Snapchat |
| ASQ | Feb-23 | — | About her KSA | 12,800.00 | $9,275 | 2023-02-23 | Snapchat |
| ASQ | Feb-23 | — | Fatima Salman | 4,416.00 | $3,680 | 2023-02-23 | Snapchat |
| ASQ | Feb-23 | — | Ahmad Ali Ahmad Alshehri | 11,206.00 | $8,120 | 2023-02-26 | Snapchat |
| ASQ | Feb-23 | — | Wala Alhomed | 2,954.00 | $2,140 | 2023-02-27 | Snapchat |
| ASQ | Feb-23 | — | Amani Ayidh Afandi | 4,176.00 | $3,480 | 2023-02-27 | Snapchat |
| Cider | Feb-23 | — | Youmna khoury | 6,306.00 | $5,444 | 2023-02-26 | Snapchat |
| ASQ | Feb-23 | — | Atiaf AlSwail | 9,600.00 | $8,000 | 2023-02-28 | Snapchat |
| FirstCry | Feb-23 | — | Arwa Sayegh | 1,118.00 | $932 | 2023-02-27 | Snapchat |
| Oud Milano | Mar-23 | — | Majed Ibrahim Hassan Mohamed | 26,666.00 | $20,000 | 2023-03-02 | Twitter Campaign |
| FirstCry | Mar-23 | — | Fatma El Eteiby | 1,137.00 | $855 | 2023-03-06 | Snapchat |
| FirstCry | Mar-23 | — | Bayan Om Hassan | 798.00 | $600 | 2023-03-07 | Snapchat |
| FirstCry | Mar-23 | — | Amonah Bent Abdallah | 532.00 | $400 | 2023-03-07 | Snapchat |
| FirstCry | Mar-23 | — | Saudi Stores | 2,126.00 | $1,598 | 2023-03-06 | Snapchat |
| FirstCry | Mar-23 | — | Arwa Sayegh | 1,240.00 | $932 | 2023-03-08 | Snapchat |
| FirstCry | Mar-23 | — | Arwa Aldahlaan | 9,157.00 | $5,987 | 2023-03-09 | Snapchat |
| FirstCry | Mar-23 | — | Saudi Malls | 1,627.00 | $1,064 | 2023-03-12 | Snapchat |
| FirstCry | Mar-23 | — | Aljawharah Saad Almuayli | 724.00 | $544 | 2023-03-13 | Snapchat |
| FirstCry | Mar-23 | — | Amona X | 2,909.00 | $1,902 | 2023-03-14 | Snapchat |
| FirstCry | Mar-23 | — | Bashayer Hamad | 2,244.00 | $1,467 | 2023-03-14 | Snapchat |
| FirstCry | Mar-23 | — | Malak Alanzi | 1,672.00 | $1,093 | 2023-03-12 | snapchat |
| FirstCry | Mar-23 | — | Gmashah abdulrhman Alzwed | 2,039.00 | $1,333 | 2023-03-15 | Snapchat |
| Bath and Body Works GCC | Mar-23 | — | Sarah Alrashdan | 1,330.00 | $1,000 | 2023-03-10 | Snapchat |
| Izil | Apr-23 | — | Arwa Aldahlaan | 9,157.00 | $5,987 | 2023-04-15 | Snapchat |
| Izil | Apr-23 | — | Fatma El Eteiby | 1,137.00 | $855 | 2023-04-15 | Snapchat |
| Izil | Apr-23 | — | Bashayer Hamad | 2,243.00 | $1,467 | 2023-04-15 | Snapchat |
| Izil | Apr-23 | — | Bayan Om Hassan | 798.00 | $600 | 2023-04-15 | Snapchat |
| ASQ | Mar-23 | — | Majed Ibrahim Hassan Mohamed | 26,666.00 | $18,000 | 2023-03-13 | Twitter Campaign |
| ASQ | Mar-23 | — | Saudi Stores | 1,986.00 | $1,589 | 2023-03-15 | Snapchat |
| ASQ | Mar-23 | — | Fares Rokaiba | 9,407.00 | $6,544 | 2023-03-19 | Snapchat |
| ASQ | Mar-23 | — | Nouf Fashion | 13,323.00 | $9,268 | 2023-03-21 | Snapchat |
| ASQ | Mar-23 | — | Amira Abdelsalam | 5,760.00 | $4,007 | 2023-03-19 | Snapchat |
| ASQ | Mar-23 | — | Alya Alobaid | 3,144.00 | $2,187 | 2023-03-20 | Snapchat |
| ASQ | Mar-23 | — | Amani Ayidh Afandi | 3,832.00 | $2,666 | 2023-03-21 | Snapchat |
| ASQ | Mar-23 | — | Arwa Aldahlaan | 8,606.00 | $5,987 | 2023-03-21 | Snapchat |
| ASQ | Mar-23 | — | Atiaf AlSwail | 9,582.00 | $6,666 | 2023-03-22 | Snapchat |
| ASQ | Mar-23 | — | Nada Alola | 2,996.00 | $2,397 | 2023-03-22 | Snapchat |
| ASQ | Mar-23 | — | Bdour ahmed alrajhi | 8,333.00 | $6,666 | 2023-03-26 | Snapchat |
| ASQ | Mar-23 | — | Fatima Salman | 3,329.00 | $2,663 | 2023-03-26 | Snapchat |
| ASQ | Mar-23 | — | Muhammad albrik | 3,062.00 | $2,130 | 2023-03-30 | Snapchat |
| ASQ | Mar-23 | — | Norah Alamro | 2,664.00 | $2,131 | 2023-03-30 | Snapchat |
| ASQ | Mar-23 | — | Hanan Abalkhail | 1,321.00 | $665 | 2023-03-29 | Snapchat |
| ASQ | Mar-23 | — | Amal Amro | 1,716.00 | $1,066 | 2023-03-30 | Snapchat |
| ASQ | Mar-23 | — | Hessa Alamar | 5,744.00 | $3,996 | 2023-03-31 | Snapchat |
| FirstCry | Mar-23 | — | Arwa Aldahlaan | 9,178.00 | $5,987 | 2023-03-19 | Snapchat |
| FirstCry | Mar-23 | — | Bayan Om Hassan | 800.00 | $600 | 2023-03-20 | Snapchat |
| FirstCry | Mar-23 | — | Atoosha 23 | 3,066.00 | $2,000 | 2023-03-19 | Snapchat |
| FirstCry | Mar-23 | — | Bashayer Hamad | 2,249.00 | $1,467 | 2023-03-20 | Snapchat |
| FirstCry | Mar-23 | — | arwa omran alomrani | 8,992.00 | $5,866 | 2023-03-21 | Snapchat |
| FirstCry | Mar-23 | — | Juhayyir Abdulrahman Alzuwayyid | 1,775.00 | $1,332 | 2023-03-20 | Snapchat |
| Home Box | Mar-23 | — | Amar Yaser Mustafa | 4,018.00 | $3,620 | 2023-03-17 | TikTok |
| Home Box | Mar-23 | — | Doaa Ibrahim Kotb | 755.00 | $680 | 2023-03-17 | Instagram |
| Home Box | Mar-23 | — | Nourhan Khalid | 1,148.00 | $1,034 | 2023-03-26 | Instagram |

---

## Method

1. Parse workbook with `xlsx` (same options as preload audit / ETL).
2. Filter with `isCampaignDataRow(row, "2023")`.
3. Harmonize with `harmonizeCampaignRow` (read-only — no code changes).
4. Sum revenue/cost/margin columns and compare to harmonizer output.

Re-run:

```bash
npm run intelligence:audit-2023
```
