# 4 · Quotation detail

**Route:** `/discovery/quotations/:id` · **`PG='quotation'`** · function `pgQuotation()`
**Prerequisite:** `00-FOUNDATION.md`, and the creator modal from page 2.
**Owns 6 overlays:** cost detail · selection bar · calculator · Commercial Workspace · add-creators
modal · Preview/Export/share card.

**The heaviest page in the module. Give it its own session and do not combine it with anything.**
Everything about money lives here, and the money is currently reported two different ways (§GP conflict).

---

## Track list — 10 columns

```js
const C='30px 74px minmax(190px,1.2fr) 66px minmax(230px,1.4fr) 74px 150px 128px 84px 92px';
```

`grid(C, 1400, H, rows, foot)`

## Header

```
☐ · Option · Creator · Tier · Service description · Platform · Type · Price · Status · Act
```

`Price` and `Act` right-aligned. Select-all checkbox is `checked` when `QSEL.size===LINES.length`.

## Data — 4 lines, 3 creators

```js
const LINES=[
 ['ouda.5',       1,'1× IG Set of stories + 1× IG Reel','ig,tt','Option 1',200000,200000,10,'Draft'],
 ['ouda.5',       2,'1× IG Reel only',                  'ig',   'Option 2',     0,     0, 0,'Draft'],
 ['karimkabbany', 1,'1× IG Set of stories + 1× IG Reel + 1× TT Video 2 weeks','ig,tt','Option 1',450000,450000,10,'Draft'],
 ['reem_elkhashab',1,'1× IG Set of stories + 1× IG Reel + 1× TT Video 2 weeks','ig,tt','Option 1',300000,330000,10,'Draft']];
// [handle, option, description, platforms, optionLabel, baseCost, clientCost, vat, status]
```

Two edge cases that must survive:
- **Line 2 costs 0** → row gets `.wrn` (3px warning bar inset-left). A zero-priced line on a quotation
  is either a freebie or an unfinished row; either way the user must see it without hunting.
- **Line 4 has base 300,000 and client 330,000** — the only line with real margin. Every other line
  is priced at cost, which is what produces the 0% GP below.

## Cell rendering

| Column | Render |
|---|---|
| ☐ | `qsel(i)`, `checked` from `QSEL` — a real set, never hardcoded |
| Option | `.tw-p p-b` — `Option 1` |
| Creator | `.tw-avx` + name `<button>` → `openCr(handle)` + `@handle`. Resolve via `cr()` (§below) |
| Tier | `.tw-p p-v` |
| Service description | **editable** `.tw-in` |
| Platform | `pf()` marks from the comma list — `ig,tt` renders two |
| Type | `.tw-in` `<select>`: `1× IG Set of stories` / `1× IG Reel` / `1× TT Video` |
| Price | `.tw-v` `F(l[6])+' EGP'`, right, with **`+ Cost detail`** button beneath in `--tw-bi` |
| Status | `.tw-p p-n` |
| Act | `.tw-x` × 3 — `+`, `⋯`, `🗑` |

Row class: `QSEL.has(i) ? 'sel' : l[5]===0 ? 'wrn' : ''`.

### Creator lookup must cover both datasets

This page renders `LINES` and resolves names against creator records. Search (page 5) uses a
different array. A lookup that checks only one **fails silently** for rows that live only in the other
— the profile "doesn't open" and there is no error anywhere.

```js
function cr(h){
 var x=CR.filter(function(c){return c[0]===h})[0]; if(x) return x;
 var p=POOL.filter(function(c){return c[0]===h})[0]; if(!p) return null;
 var score=Math.min(99,Math.round(20+p[7]*1.4));
 return [p[0],p[1],p[2],p[3],p[6]>=1e6?'Macro':p[6]>=1e5?'Mid':'Micro',p[4],p[5],
  p[7],p[8],p[9],p[10],p[11],score,score>=60?'Strong':score>=40?'Consider':'Weak',
  77,'Unverified',p[4].concat(['Travel']),200000,4.6,'14 days ago'];
}
```

Test every handle on the page, not one. Only `ouda.5` exists in both arrays — testing that one proves
nothing.

## Above the grid

**Lifecycle strip:** `Shortlist SL-2026-0026 · linked` (p-b) · `Campaign · not linked` (p-n) ·
`Live sync enabled` (p-g) · right: `⚠ Validity 06 Sep 26 · 4 days remaining` in `--tw-wrn`.

**Client review strip:** *proposal v1 · in review* · `3 approved · 0 under review · 0 rejected` ·
buttons `Select approved` / `Select under review` / `Mark approved by Thinkway` /
**`Move approved to campaign`** (primary).

**Approved block** (`.tw-ms2`):

```
Approved creators 3 · Approved base cost 950,000 · Client cost 950,000 ·
Approved GP 0 (red) · Approved GP % 0.0% (red)
```

**Filter chips:** `All 4` (on) · `Approved 3` · `Under review 0` · `Rejected 0`.
Zero-count chips get `.z` and are not clickable — a chip that filters to nothing is a dead end.

## The GP conflict — show both numbers, name the conflict

| Where | GP | GP % |
|---|---|---|
| Masthead | **95,000** | **9.1%** |
| Approved block | **0** | **0.0%** |
| Commercial Workspace | 0 | 0.0% — all 4 lines **Critical** |

Both are correct. The 95,000 is the **agency fee**: added to what the client pays, never counted as
revenue. Display both side by side with that one-line explanation.

Do not reconcile them silently by picking one. Whichever you pick, half the users reading the screen
will believe a number that isn't the one they need, and the discrepancy is the actual finding.

## Masthead

Title **Quotation — Test 5**, id `QT-2026-0025`, subtitle *4 lines · 3 creators · linked to SL-2026-0026*, badge `Draft`.

```
Ccy EGP (s) · Base cost 950,000 · Client cost 1,045,000 · GP margin 95,000 (y) · GP % 9.1% (r) ·
FM % 10.0% · Version v1.0 (s) · Creators 3 · Lines 4 · Days left 4 (y)
```

Actions: `Open shortlist` · `Save` · `👁 Preview · Detailed ▾` · `⬇ Export ▾` · `🔗 Client link` ·
`✉ Send to client` · `Open Studio` · `⋯`

---

## Overlay A — `+ Cost detail` (per line)

Free-for-the-client toggle · calculation mode · currency · pricing units · unit cost · client cost · AF %.

```js
const CMODES=['Cost + Markup%','Cost + GP Margin%','Cost + Client cost','Cost + GP Value'];
```

Add a live breakdown ending in **what the client actually pays**. The live panel stops at GP%, which
is the one figure nobody in the room is asking for.

## Overlay B — selection bar

```css
.tw-selbar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:60}
```

Fixed and centred. Not sticky, not in flow — it must not move when the grid scrolls.
Shows Base cost · Client cost · GP · GP %. Actions: Calculator · Duplicate · Delete · ⋯

Selection is a real set both ways. A hardcoded `checked` on a child row looks right and breaks on
deselect — the reported symptom is "unselect doesn't remove the child rows":

```js
let KSEL=new Set();
function syncKids(){KSEL=new Set();ROWS.forEach(function(a){if(SEL.has(a[0]))
 (a.kids||[]).forEach(function(k,j){KSEL.add(a[0]+'#'+j)})})}
```

## Overlay C — calculator (`qCalcPanel`)

```js
const QM={af:   {l:'Cost + AF %',        f:'client = cost × (1 + af%)',    d:25},
          gpm:  {l:'Cost + GP margin %', f:'client = cost ÷ (1 − margin%)',d:30},
          price:{l:'Cost + client price',f:'client = price you enter',     d:300000},
          gpv:  {l:'Cost + GP value',    f:'client = cost + GP',           d:100000}};
function qNew(cost){
 if(QMODE==='af')    return cost*(1+QVAL/100);
 if(QMODE==='gpm')   return QVAL>=100?cost:cost/(1-QVAL/100);
 if(QMODE==='price') return QVAL;
 return cost+QVAL;
}
```

Always print the formula next to the mode. 8-column preview grid:

```js
const C='minmax(150px,1.2fr) 104px 112px 112px 100px 74px 108px 92px';
// Creator · Base cost · Client now · New client · GP · Margin · Change · (VAT %)
```

Totals row ends in **Client pays**. Cancel / Apply — never auto-commit.

Three guards, all reachable with the default values above:
1. **Below cost** — new client price under base cost → red per line.
2. **Margin ≥ 100%** — unsolvable. Hold at cost and explain, rather than printing `Infinity`.
3. **Flat client price** — same figure on every line regardless of cost. Warn; on a 4-line quotation
   with costs from 0 to 450,000 this is nearly always a mistake.

## Overlay D — Commercial Workspace

```js
const C='30px minmax(180px,1.2fr) 150px 118px 118px 92px 84px 74px 92px';
// ☐ · Influencer · Mode · Cost · Revenue · GP % in · GP · GP % · Currency
```

One editable row per line. Plus Selection summary, Quotation summary, Commercial health verdict
(Healthy / Warning / Critical — currently **Critical on all 4 lines**), and a toolbar with filter,
mode, apply, undo, redo, columns.

**Scratchpad model (product truth — not isolated from the Creators grid).** Commercial Workspace
shares the quotation’s in-memory drafts with the Creators grid and line-pending registry. Editing a
row stages immediately into that shared scratchpad so masthead and grid stay live. **Save** writes
line masters (SSOT). **Discard** resets drafts to last-saved line masters. **Close is a no-op** by
design — it does not discard and does not write SSOT; unsaved edits remain held as drafts. Closing
must never open a confirm dialog (a scratchpad that interrogates on exit stops being one). While
dirty, the dialog footer states that unsaved edits are held as drafts and shown in the Creators
grid. Staged figures must be visually distinct from saved ones (masthead + grid), and the masthead
names the conflict when staged totals disagree with saved SSOT, with a path back into CW.

## Overlay E — Add creators modal

4 tabs: `ACT=[['disc','Discovery'],['sl','Shortlist'],['camp','Campaign'],['man','Manual']]`

- **Discovery** is usually empty → **Open Discovery Search**, Import disabled.
- **Shortlist** / **Campaign** are pickers; show creator counts, flag an already-linked shortlist.
- **Manual** needs Platform and Tier as well as name, and **must warn that a manual row has no
  profile** — it is excluded from scoring and matching. That consequence is invisible otherwise and
  surfaces weeks later as "why is this creator missing from match results".

## Overlay F — Preview / Export / Client link / Send

**Build these here; page 2 reuses them.**

The live **Share** menu is three unrelated jobs in one control. Split into four, same order on both pages.

**`👁 Preview · <layout> ▾`** — the button names the current layout.

| Layout | Sub-label | Produces |
|---|---|---|
| Detailed | Line items | Every creator, every option line, with prices |
| Lump sum | Summary | One total, no line-level breakdown |
| Pitch presentation | Large avatars · deck | Slide per creator, built to present |
| Pitch lump sum | Pitch deck · total | Presentation layout, single total |
| Showcase | Creator deck | Creator-led, content samples to the front |
| Showcase lump sum | Deck + total | Showcase layout, single total |

**`⬇ Export ▾`** — label by purpose, not extension. `doc` red · `sheet` green · `web` blue.

| Format | Label | Quotation | Shortlist |
|---|---|---|---|
| PDF | Send to a client — fixed layout | yes | yes |
| PowerPoint | Present or edit the deck | yes | yes |
| Word | Edit the wording before sending | yes | yes |
| Excel | Work with the numbers | yes | yes |
| CSV | Feed another system | **unsupported** (no export API branch) | yes |
| HTML | Open in a browser, no download | yes | yes |

Formats are a **capability list from the page adapter** into the shared `DocumentOutputToolbar` —
never a product-type branch inside the shared component. Quotation ships five; shortlist ships six.

> **Export silently uses whichever layout is currently previewed.** 6 × 6 is the same document 36 ways
> with nothing on screen saying which one you'll get. Head the export menu
> **"Download as — \<layout\> layout"** and tell the user to change it in Preview first.

**`🔗 Client link`** → share card: signed permanent URL, read-only, Copy. Add a **Status · Version ·
Document** strip carrying the same live dot as the list toggle, and — when the link is off — a warning
that anyone opening the URL sees nothing. Revoking access means switching the toggle off, not
reissuing a URL; say so, because that is not what users assume. Footer: access count · Open review ·
Send to client · Done.

**`✉ Send to client`** is the primary action.

## Acceptance

- [ ] Track list byte-identical; header, rows, footer share one `--cols`.
- [ ] Line 2 (cost 0) carries the `.wrn` inset bar.
- [ ] `cr()` resolves **all four** handles; open the profile from every row.
- [ ] Masthead 95,000 / 9.1% and approved-block 0 / 0.0% both visible, with the agency-fee note.
- [ ] Selection bar is `position:fixed` and does not move when the grid scrolls.
- [ ] Select all → deselect one → parent updates. Deselect all → bar disappears, calculator closes.
- [ ] Calculator: `gpm` at 100 holds at cost, does not print `Infinity`.
- [ ] Calculator: `price` mode warns when one figure lands on every line.
- [ ] Calculator: any line below base cost flags red before Apply is possible.
- [ ] Export menu names the layout it will use.
- [ ] Manual add-creator tab warns about the missing profile; Platform and Tier are required on add.
- [ ] Commercial Workspace: Save writes SSOT; Discard resets to last-saved; Close leaves drafts held
      (footer copy while dirty). Staged masthead/grid values are marked; Draft edits pending links to CW.
- [ ] Class-coverage script passes across **all six overlay states**.
