# 3 · Quotations list

**Route:** `/discovery/quotations` · **`PG='quotations'`** · function `pgQuotations()`
**Prerequisite:** `00-FOUNDATION.md`. Do not modify `discovery.css`.
**Owns no overlays.**

Same shape as page 1 — if page 1 is done this is a fast build. The only new thing is money.

---

## Track list — 11 columns

```js
const C='30px 116px minmax(190px,1.4fr) 120px minmax(150px,1fr) 92px 92px 150px 66px 116px 74px';
```

`grid(C, 1300, H, rows, foot)`

Two flexible columns here, not one: Quotation title and Client both need to breathe, and the client
names are long legal entities (`Bundle Plus Communication`, `Mind Share Egypt LTD`).

## Header

```
☐ · Serial · Quotation · Brand · Client · Status · Client link · Owner · Lines · Client cost · Act
```

`Lines`, `Client cost` and `Act` right-aligned.

## Data — 6 rows

```js
const QT=[
 ['QT-2026-0025','Quotation — Test 5','Alshaya','Bundle Plus Communication','Draft','Active','mohamedeldesouky',4,1045000,950000,9.1],
 ['QT-2026-0024','Quotation — Test 4','Arab Bank','Mind Share Egypt LTD','Draft','Active','mohamedeldesouky',3,880000,800000,9.1],
 ['QT-2026-0023','Quotation — Test 3','E&','Essencemediacom','Draft','Active','mohamedeldesouky',3,733333,666667,9.1],
 ['QT-2026-0022','Quotation — Test 2','E&','Essencemediacom','Draft','None','mohamedeldesouky',3,586667,533333,9.1],
 ['QT-2026-0021','Quotation — Dar Global','Dar Global','Bundle Plus Communication','Approved','Active','mohamedeldesouky',3,1173334,1066667,9.1],
 ['QT-2026-0020','Quotation — FirstCry','FirstCry','Bundle Plus Communication','Approved','None','mohamedeldesouky',8,660000,600000,9.1]];
// [id, title, brand, client, status, clientLink, owner, lines, clientCost, baseCost, gpPct]
```

Titles contain an **em dash** (`Quotation — Test 5`). Keep it; do not normalise to a hyphen.

## Cell rendering

Identical to page 1 except:

| Column | Render |
|---|---|
| Client | `.tw-t` with `title=` attribute — these truncate, so the tooltip is the fallback |
| Lines | `.tw-v`, right |
| Client cost | `.tw-v`, right, `F(q[8])` → `1,045,000` |
| Status | `p-g` when `Approved`, else `p-n` |
| Client link | same toggle + live dot as page 1, no text |

Currency is EGP throughout. Show the code once in the masthead, not on every row — a currency suffix
in a numeric column destroys tabular alignment, which is the entire reason the column is Geist Mono.

## Masthead metrics

```
Quotations 29 · Draft 24 · Approved 5 (g) · Lines 118 · Client cost 5.08M (s) ·
Base cost 4.62M (s) · Avg GP % 9.1% (r) · Creators 96
```

**`Avg GP % 9.1%` is red on purpose.** Every quotation in the file reports exactly 9.1%, which is not
a coincidence — it is the agency fee being reported as margin (see page 4, §GP conflict). Flagging it
here is how the user notices at portfolio level.

## Footer

`N of 29 shown`, summed Lines, summed Client cost.

## Acceptance

- [ ] Track list byte-identical; two flexible columns behave at 1300px and at 1900px.
- [ ] Client names truncate with ellipsis **and** carry a `title` attribute.
- [ ] `F()` on Client cost — thousands separators, right-aligned, tabular.
- [ ] No currency code in the rows; exactly one in the masthead.
- [ ] Avg GP % renders red.
- [ ] Em dashes intact in titles.
- [ ] Class-coverage script passes.
