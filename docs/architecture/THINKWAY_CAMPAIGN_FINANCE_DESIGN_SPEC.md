# Thinkway Platform — Design & Build Spec

Implementation spec for the campaign / finance redesign. Every value below is taken from the working
build (`campaign-detail.html`, `finance-suite.html`, `billing-v3.html`), not from memory.

Stack assumption: React + Tailwind or plain CSS. All rules are prefixed `tw-` and scoped to a component
class. **No bare element selectors** (`th`, `td`, `table`) — five separate layout bugs in this project
came from unscoped selectors reaching into nested tables.

---

## 1. Design tokens

```css
:root{
  /* brand */
  --tw-blue:#0057FF;   /* primary */
  --tw-b2:#1A6FFF;     /* gradient mid */
  --tw-bi:#0B52E0;     /* ink-on-white blue, used for text/labels */
  --tw-bdk:#0040CC;    /* gradient dark */
  --tw-navy:#060810;

  /* text */
  --tw-ink:#0B0F1A;    /* primary */
  --tw-ink2:#41495A;   /* secondary */
  --tw-mut:#64748B;    /* labels, captions */

  /* surface */
  --tw-bg:#FAFBFC;     /* page */
  --tw-soft:#F6F8FB;   /* table headers, inset panels */
  --tw-lav:#EFF4FF;    /* selected row, active tab */
  --tw-line:#E2E8F0;   /* structural border */
  --tw-hair:#EDF0F5;   /* row divider */

  /* semantic */
  --tw-ok:#0A7A55;  --tw-okb:#E9F7F1;
  --tw-wrn:#8A5D12; --tw-wrnb:#FFF6E8;
  --tw-bad:#C82121; --tw-badb:#FEF2F2;
  --tw-vio:#5B3FD1; --tw-viob:#F1EDFE;   /* brand names only */

  --tw-grad:linear-gradient(107deg,#0B3DBF 0%,#0F55E8 34%,#3D82FF 62%,#8FB6FF 100%);
  --tw-ring:0 0 0 1px rgba(0,87,255,.05), 0 8px 24px rgba(0,87,255,.06);
  --tw-ez:cubic-bezier(.23,1,.32,1);
}
```

**Cards never use a border.** They use `--tw-ring` — a 1px blue-tinted ring plus a soft blue shadow.
This is the platform's existing signature; a grey 1px border reads as a different product.

**Colour carries meaning, not identity.** Two card tones only — brand blue and warm grey — plus red
reserved for cards showing something broken. Do not tint cards by category; eight different hues made
the deck unreadable.

---

## 2. Typography

Fonts: **Geist** (UI), **Geist Mono** (all numerals). Fallback stack:
`'Geist','Inter','Segoe UI Variable Text','Segoe UI',system-ui,sans-serif`.
Load with `<link>` + `preconnect` — an `@import` fails and silently falls back to Segoe UI.

### Numeric scale — four steps, no others

| Step | Size | Use |
|------|------|-----|
| Headline | **20px** / -0.6px | KPI cards, big panel stats |
| Panel stat | **14px** / -0.35px | summary strips, modal stat cells |
| Row value | **12.5px** | grid cells, key-value rows, inputs |
| Micro | **11.5px** | dates, deltas, chips, IDs |

Every numeric element also gets `font-family:'Geist Mono'` + `font-variant-numeric:tabular-nums` so
digits align down a column and between parent and child rows.

Dates are **not** on the numeric treatment — 11.5px medium weight, `--tw-ink2`. They are metadata.

### Text sizes
- h1 20px/600/-0.5px · card title 12.5–13.5px/600 · body 12–12.5px
- Column headers 9px/700, `letter-spacing:.6px`, uppercase, `--tw-mut`
- Field labels 10px/700, `letter-spacing:.55px`, uppercase

---

## 3. Dates — one format everywhere

`DD Mon YY` · times `DD Mon YY · HH:MM` · ranges `03–05 Aug 26` (collapsed when the month matches).

Route every date through one formatter. The live platform mixes five formats (`2026-08-04`,
`3 Aug–3 Aug`, `Sep 3, 2026`, `31/07/2026`, `Sep 1, 11:21`) — accept all of them on input, emit one.

```js
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function D(v){
  if(v==null) return '';
  let x=String(v).trim(); if(!x||x==='—') return '';
  const pad=n=>String(n).padStart(2,'0');
  const out=(d,m,y,t)=>pad(d)+' '+m+' '+String(y).slice(-2)+(t?' · '+t:'');
  let m;
  if((m=x.match(/^(\d{4})-(\d{2})-(\d{2})$/)))                       return out(+m[3],MON[+m[2]-1],m[1]);
  if((m=x.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}:\d{2}))?/)))return out(+m[1],MON[+m[2]-1],m[3],m[4]);
  if((m=x.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{2}:\d{2}))?/)))
                                                                      return out(+m[2],m[1],m[3],m[4]);
  if((m=x.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{2}:\d{2})/)))    return out(+m[2],m[1],2026,m[3]);
  if((m=x.match(/^(\d{1,2})\s*([A-Z][a-z]{2})\s*[–-]\s*(\d{1,2})\s*([A-Z][a-z]{2})$/)))
    return m[2]===m[4] ? pad(+m[1])+'–'+pad(+m[3])+' '+m[2]+' 26'
                       : pad(+m[1])+' '+m[2]+' – '+pad(+m[3])+' '+m[4]+' 26';
  if((m=x.match(/^([A-Z][a-z]{2})\s+(\d{2})$/)))                      return m[1]+' '+m[2];
  return x;
}
```

Missing dates render as `not set` in `--tw-mut` italic — **never** as `—` next to a real date, and
never as a zero. An undated invoice cannot be aged; the UI must say so.

---

## 4. The grid engine — one rule for every table

This is the most important part of the spec. The live platform renders an expanded assignment as
**extra columns of the same table row** — the header reaches 70 columns on a 2-creator campaign and
several hundred on a 32-creator one. Replace it with CSS Grid where parent and child share one track list.

```css
.tw-g            { display:grid; grid-template-columns:var(--cols); align-items:center }
.tw-g > *        { padding:0 8px; min-width:0 }
.tw-hr           { position:sticky; top:0; z-index:3; background:var(--tw-soft);
                   border-bottom:1px solid var(--tw-line); padding:9px 8px }
.tw-r            { padding:11px 8px; border-bottom:1px solid var(--tw-hair) }
.tw-r:hover      { background:#FBFCFF }
.tw-r.sel        { background:var(--tw-lav) }
.tw-r.bad        { background:#FFF8F8; box-shadow:inset 3px 0 0 var(--tw-bad) }
.tw-r.wrn        { background:#FFFCF5; box-shadow:inset 3px 0 0 #E0A93C }
.tw-ft           { padding:11px 8px; background:#F2F5FA; border-top:2px solid var(--tw-line) }
```

Each table sets `--cols` once and passes it to its header, every row, the child block and the footer:

```jsx
const COLS = '30px 26px 116px minmax(150px,1.1fr) 66px …';
<div className="tw-g tw-hr" style={{'--cols':COLS}}>…</div>
<div className="tw-g tw-r"  style={{'--cols':COLS}}>…</div>
```

**Rules**
1. Header, rows, child rows, child header, child totals and footer all use the **same** `--cols`.
2. Wrap in `overflow-x:auto` with a `min-width` on the inner div. Never squeeze columns.
3. Currency belongs in **one** narrow chip column, not repeated on every money cell — that alone
   reclaimed ~200px per row and brought four hidden columns back on screen.
4. Money right-aligned, `tabular-nums`. Zero renders in `#B6BECD` at weight 500, never as bold `0.00`.
5. Empty cells are `<span></span>` — never omitted, or every following column shifts left.

**CI check.** Count the direct children of each `.tw-g` block (crediting `grid-column:span N`) and
assert it equals the track count. This caught real misalignment three times in this project.

### Nested child rows
Child rows are siblings on the same grid, not extra cells:
```
.tw-ad     { background:#F4F7FC; border-left:3px solid var(--tw-blue) }
.tw-adh    { background:#E7EDF7; padding:7px 8px }   /* child column labels */
.tw-adr    { padding:9px 8px; border-bottom:1px solid #DEE5F0 }
.tw-adf    { padding:9px 8px; background:#DFE7F3; font-weight:600 }  /* child totals */
```
Columns shared by parent and child (Ccy → Total billing) must occupy the same tracks so figures line up
vertically. Child-only fields (Live ad date, Month, INV, COLL, Payout, WF) take the tracks the parent
uses for GP/MGN/OPS/Billing/Payment, labelled by the child header row.

---

## 5. Components

### Button
```css
.tw-b     { height:32px; padding:0 12px; border:.8px solid #E3E8F2; border-radius:9px;
            background:#fff; color:var(--tw-ink2); font:600 12.5px Geist;
            transition:border-color .15s var(--tw-ez), color .15s }
.tw-b:hover{ border-color:rgba(0,87,255,.35); color:var(--tw-bi) }
.tw-b.pri { border-color:rgba(0,87,255,.55); color:var(--tw-bi); font:700 12px Geist;
            box-shadow:0 0 0 3px rgba(0,87,255,.08), 0 2px 14px -3px rgba(0,87,255,.4) }
.tw-b.sm  { height:27px; padding:0 10px; font-size:11.5px; border-radius:8px }
.tw-b[disabled]{ opacity:.42; cursor:not-allowed; box-shadow:none }
```
Primary is **white with a blue outline**, not a filled blue block — matches the deployed platform.
A permanently-disabled primary action is a design bug: disable it only when the state genuinely blocks it
(e.g. *Post to accounting* with an empty batch).

### Status pill
```css
.tw-p { display:inline-block; padding:2px 8px; border-radius:999px; font:600 10px Geist }
.p-n{bg soft/mut}  .p-g{ok}  .p-y{warn}  .p-r{bad}  .p-b{lav/blue}  .p-v{violet}
```

### Card
```css
.tw-c  { background:#fff; border-radius:12px; box-shadow:var(--tw-ring); overflow:hidden; margin-bottom:11px }
.tw-ch { display:flex; align-items:center; gap:9px; flex-wrap:wrap; padding:11px 14px;
         border-bottom:1px solid var(--tw-line) }
```

### Dashboard card (gradient header)
Put the gradient on the **header element itself**, never a fixed-height `::before` — when the title wraps,
a fixed band clips the subtitle.
```css
.tw-dc2__h{ position:relative; isolation:isolate; overflow:hidden; display:flex; align-items:flex-start;
            flex-wrap:wrap; padding:12px 15px;
            background:linear-gradient(107deg,#E9F0FF 0%,#F2F7FF 58%,#F7FAFF 100%);
            border-bottom:1px solid #DDE7FA }
.tw-dc2__h::after{ content:""; position:absolute; z-index:-1; right:-28px; top:-40px;
                   width:96px; height:96px; border-radius:50%; border:16px solid rgba(0,87,255,.09) }
.tw-dc2__h b{ font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.tw-dc2__h u{ font-size:10px; color:var(--tw-mut); …same ellipsis }
```
Title + subtitle must sit in **one** flex child so they clip together.
Deck: `grid-template-columns:repeat(auto-fit,minmax(392px,1fr)); gap:12px`.

### Brand tile (Treasury / Reports)
Gradient background, ring motif in pure CSS (two offset `border-radius:50%` pseudo-elements with thick
translucent borders — no images), `min-height:132px`, hover `translateY(-3px)` over 320ms.

---

## 6. Layout

- **Full width.** `padding:0 14px`, no max-width. A centred 1240px column wastes both gutters on
  20-column financial tables.
- **Frozen header.** Wrap masthead + stepper in `position:sticky; top:0; z-index:60`. Past `scrollY>72`
  add `.mini`, which hides the action row, drops the blocker's detail line, and shrinks the title —
  roughly halving the frozen height while keeping name, metrics and stepper visible.
- **Masthead** merges what were three stacked bands (hero, metric cards, status strip) into one:
  gradient title row → blocker row on a translucent panel → action row on white → a single
  `repeat(auto-fit,minmax(104px,1fr))` strip carrying all 12 metrics.
- **Stepper tab bar**: dots joined by 2px connectors, completed segments in `--tw-blue`, active tab on
  `--tw-lav`. Not pills — the live nav communicates progress.

---

## 7. Interaction

### Selection
- Select-all checkbox **in the header cell** (`aria-label="Select all …"`).
- Child rows must derive `checked` from state, **never** a hardcoded `checked` attribute. Selecting a
  parent selects its children; ticking one child selects the parent; clearing clears both.
- **Flying bar** — `position:fixed; left:50%; bottom:20px; transform:translateX(-50%); z-index:70`,
  dark `rgba(11,15,26,.96)`, blurred, rounded 14px, rising in over 260ms. Contents: count chip · clear ·
  labelled totals · actions. Identical whether one row or all rows are selected.
- Destructive actions state their scope: **"Remove 3"**, and remove only the selection.

### Edit mode
Explicit `Edit` → `Save`; Save disabled until Edit is pressed. Editable columns tint while editing
(revenue/total blue `#E7F0FF`, cost amber `#FFF4E0`). Never write on blur.

### Calculator (on selection)
Four modes, formula shown for each:
```
af  : rev = cost × (1 + af/100)
gpm : rev = cost ÷ (1 − margin/100)      // margin, not markup
pr  : rev = entered price
gpv : rev = cost + gp
```
Live per-row preview (cost → new revenue, GP, margin, VAT, delta) plus selection totals, and **three
guards**: any line below cost, margin ≥ 100% (unsolvable — hold revenue at cost), and flat client price
overwriting per-creator economics. Nothing is written until *Apply*.

### Drawers and modals
- **Right drawer** (`width:min(680px,96vw)`) for creation forms with a sticky footer summary.
- **Centred modal** for record detail: `grid-template-columns:298px minmax(0,1fr)` — gradient identity
  panel left (avatar, name, handle, six figures), tabs and content right, actions pinned bottom.
- Scrim `rgba(11,15,26,.34)`, click-to-close, `Escape` closes, `role="dialog"` + `aria-label`.

---

## 8. Data honesty rules

These are design requirements, not nice-to-haves — the audit found every one of them violated.

1. **Never sum mixed currencies.** Subtotal per currency; convert only with an explicit rate and show it.
   The live *Collected 12,033,111* is EGP + AED + USD added as one unit.
2. **Never invent a value.** Missing renders as `not set`; unavailable renders as `—`. A zero must mean zero.
   Aging buckets read `—`, not `0`, when no invoice date exists.
3. **Keep empty states honest.** Say *why* it is empty and what unlocks it, not "No data for selected filters".
4. **Show `Current` even at zero** in aging — it distinguishes "issued, not yet due" from "overdue".
5. **One source of truth per number.** If a figure appears twice, derive both from one expression, and
   label the base (VAT-inclusive vs ex-VAT) wherever two bases coexist.
6. **Surface contradictions rather than resolving them silently.** Where two systems disagree, show both
   and name the conflict.

---

## 9. Accessibility

- Contrast ≥ 4.5:1. Brand green `#0E9F6E` is only 3.39:1 on white — use `#0A7A55` (5.35:1).
- `:focus-visible { outline:2px solid var(--tw-blue); outline-offset:2px }` — never remove focus rings.
- `aria-label` on every icon-only control; `aria-pressed` on toggles; `aria-expanded` on disclosures.
- Touch targets ≥ 44px under `@media (pointer:coarse)`.
- `@media (prefers-reduced-motion:reduce)` disables all transitions and the bar/modal animations.
- Icons are inline SVG with `stroke-width:1.7`, `stroke-linecap:round` — never emoji.

---

## 10. Build checklist

- [ ] No selector outside `.tw-*` / `.p-*` / `:root` / `*` / `body` / `@media`
- [ ] No bare `th`, `td`, `table` rules
- [ ] Every `.tw-g` block's child count equals its `--cols` track count
- [ ] Every numeric element on one of the four sizes and on Geist Mono + tabular-nums
- [ ] Every date passes through `D()`; no ISO / `Mon D, YYYY` / `DD/MM/YYYY` in output
- [ ] No `checked` attribute hardcoded on a stateful checkbox
- [ ] Superseded rules deleted, not overridden — duplicate declarations for one selector are a defect
- [ ] `<div>` open/close balanced per view
