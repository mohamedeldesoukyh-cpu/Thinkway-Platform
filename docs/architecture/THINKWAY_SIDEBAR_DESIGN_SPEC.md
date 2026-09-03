# Thinkway Platform — Full Build Spec

Implementation spec for the campaign / finance / billing redesign. Every value is taken from the
working build, not from memory. Hand Cursor **§1–5 first** — the rest is refinement on a correct grid.

**Reference builds**
| File | Covers |
|---|---|
| `campaign-detail.html` | campaign workspace, 11 tabs, drawers, modals, calculator |
| `campaigns-list.html` | campaigns index, 15 columns, pagination |
| `finance-suite.html` | 18 finance & operations pages |
| `billing-v3.html` | billing queue, invoices, collections, A/R aging |
| `sidebar.html` | left navigation, 46 destinations |

**Global rule:** every selector is prefixed `tw-` and scoped to a component class. **No bare element
selectors** (`th`, `td`, `table`, `input`). Five separate layout bugs in this project came from
unscoped selectors reaching into nested tables.

---

## 1. Tokens

```css
:root{
  --tw-blue:#0057FF; --tw-b2:#1A6FFF; --tw-bi:#0B52E0; --tw-bdk:#0040CC; --tw-navy:#060810;
  --tw-ink:#0B0F1A;  --tw-ink2:#41495A; --tw-mut:#64748B;
  --tw-bg:#FAFBFC;   --tw-soft:#F6F8FB; --tw-lav:#EFF4FF;
  --tw-line:#E2E8F0; --tw-hair:#EDF0F5;
  --tw-ok:#0A7A55;  --tw-okb:#E9F7F1;
  --tw-wrn:#8A5D12; --tw-wrnb:#FFF6E8;
  --tw-bad:#C82121; --tw-badb:#FEF2F2;
  --tw-vio:#5B3FD1; --tw-viob:#F1EDFE;      /* brand names only */
  --tw-grad:linear-gradient(107deg,#0B3DBF 0%,#0F55E8 34%,#3D82FF 62%,#8FB6FF 100%);
  --tw-ring:0 0 0 1px rgba(0,87,255,.05), 0 8px 24px rgba(0,87,255,.06);
  --tw-ez:cubic-bezier(.23,1,.32,1);
}
```

**Cards never use a border** — `--tw-ring` (blue-tinted 1px ring + soft blue shadow) is the platform's
signature. A grey 1px border reads as a different product.

**Two card tones only.** Brand blue and warm grey, plus red reserved for cards showing something broken.
Do not tint by category — eight hues made the deck unreadable.

---

## 2. Typography

**Geist** (UI) + **Geist Mono** (all numerals). Load with `<link>` + `preconnect`; an `@import` fails
silently and falls back to Segoe UI.

```
'Geist','Inter','Segoe UI Variable Text','Segoe UI',system-ui,sans-serif
```

### Numeric scale — four steps, no others
| Step | Size | Use |
|---|---|---|
| Headline | **20px** / -0.6px | KPI figures, big panel stats |
| Panel stat | **14px** / -0.35px | masthead strip, modal stat cells |
| Row value | **12.5px** | grid cells, key-value rows, inputs |
| Micro | **11.5px** | dates, deltas, IDs, chips |

Every numeric element also gets `font-family:'Geist Mono'` + `font-variant-numeric:tabular-nums`.
15 different sizes were in use before this was imposed.

Dates are **not** numeric styling — 11.5px, weight 500, `--tw-ink2`. They are metadata.

### Text
h1 20px/600/-0.5px · card title 12.5–13.5px/600 · body 12–12.5px
Column headers 9px/700 · `.6px` tracking · uppercase · `--tw-mut`
Field labels 10px/700 · `.55px` tracking · uppercase

---

## 3. Dates — one format

`DD Mon YY` · times `DD Mon YY · HH:MM` · ranges `03–05 Aug 26`, collapsed when the month matches.

The live platform emits five formats (`2026-08-04`, `3 Aug–3 Aug`, `Sep 3, 2026`, `31/07/2026`,
`Sep 1, 11:21`). Accept all, emit one.

```js
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function D(v){
  if(v==null) return '';
  let x=String(v).trim(); if(!x||x==='—') return '';
  const pad=n=>String(n).padStart(2,'0');
  const out=(d,m,y,t)=>pad(d)+' '+m+' '+String(y).slice(-2)+(t?' · '+t:'');
  let m;
  if((m=x.match(/^(\d{4})-(\d{2})-(\d{2})$/)))                        return out(+m[3],MON[+m[2]-1],m[1]);
  if((m=x.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}:\d{2}))?/))) return out(+m[1],MON[+m[2]-1],m[3],m[4]);
  if((m=x.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{2}:\d{2}))?/)))
                                                                       return out(+m[2],m[1],m[3],m[4]);
  if((m=x.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{2}:\d{2})/)))     return out(+m[2],m[1],2026,m[3]);
  if((m=x.match(/^(\d{1,2})\s*([A-Z][a-z]{2})\s*[–-]\s*(\d{1,2})\s*([A-Z][a-z]{2})$/)))
    return m[2]===m[4] ? pad(+m[1])+'–'+pad(+m[3])+' '+m[2]+' 26'
                       : pad(+m[1])+' '+m[2]+' – '+pad(+m[3])+' '+m[4]+' 26';
  if((m=x.match(/^([A-Z][a-z]{2})\s+(\d{2})$/)))                       return m[1]+' '+m[2];
  return x;
}
```

Missing dates render `not set` (muted italic) — never `—` beside a real date, never `0`.
An undated invoice cannot be aged; the UI must say so rather than bucket it as Current.

---

## 4. Grid engine — the core of the spec

The live platform renders an expanded assignment as **extra columns of the same table row**. The header
reaches 70 columns on a 2-creator campaign and several hundred on a 32-creator one. Replace with CSS
Grid where parent and child share one track list.

```css
.tw-g       { display:grid; grid-template-columns:var(--cols); align-items:center }
.tw-g > *   { padding:0 8px; min-width:0 }
.tw-hr      { position:sticky; top:0; z-index:3; background:var(--tw-soft);
              border-bottom:1px solid var(--tw-line); padding:9px 8px }
.tw-hr > *  { font-size:9px; font-weight:700; letter-spacing:.6px; text-transform:uppercase;
              color:var(--tw-mut); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.tw-r       { padding:11px 8px; border-bottom:1px solid var(--tw-hair); transition:background .12s }
.tw-r:hover { background:#FBFCFF }
.tw-r.sel   { background:var(--tw-lav) }
.tw-r.bad   { background:#FFF8F8; box-shadow:inset 3px 0 0 var(--tw-bad) }
.tw-r.wrn   { background:#FFFCF5; box-shadow:inset 3px 0 0 #E0A93C }
.tw-ft      { padding:11px 8px; background:#F2F5FA; border-top:2px solid var(--tw-line) }
.tw-rr      { text-align:right }
```

```jsx
const COLS='30px 26px 116px minmax(150px,1.1fr) 66px …';
<div className="tw-g tw-hr" style={{'--cols':COLS}}>…</div>
<div className="tw-g tw-r"  style={{'--cols':COLS}}>…</div>
```

**Rules**
1. Header, rows, child header, child rows, child totals and footer share the **same** `--cols`.
2. Wrap in `overflow-x:auto` with `min-width` on the inner div. Never squeeze columns.
3. Currency lives in **one** narrow chip column, not repeated on every money cell. This alone reclaimed
   ~200px per row and brought four hidden columns back on screen.
4. Money right-aligned, tabular. Zero renders `#B6BECD` weight 500 — never bold `0.00`.
5. Empty cells are `<span></span>`, never omitted, or every following column shifts left.
6. `grid-column:span N` is allowed; the CI check must credit it.

**CI check — non-negotiable.** Count direct children of each `.tw-g` block, credit `span N`, assert it
equals the track count. This caught real misalignment three times here.

### Nested child rows
```css
.tw-ad  { background:#F4F7FC; border-left:3px solid var(--tw-blue) }
.tw-adh { background:#E7EDF7; padding:7px 8px }   /* child column labels */
.tw-adr { padding:9px 8px; border-bottom:1px solid #DEE5F0 }
.tw-adf { padding:9px 8px; background:#DFE7F3; font-weight:600 }  /* child totals */
```
Columns shared with the parent (Ccy → Total billing) occupy the same tracks so figures align vertically.
Child-only fields take the tracks the parent uses for GP/MGN/OPS/Billing/Payment, labelled by `.tw-adh`.

---

## 5. Page inventory & column definitions

### 5.1 Campaigns index — 15 tracks
```
30px 96px minmax(150px,1.3fr) 112px 104px 92px 58px 62px 128px minmax(140px,1fr) 52px 128px 96px 150px 116px
```
`select · Campaign# · Campaign · Brand · Stage · Waiting for · Days · Risk · Next action · Group·entity ·
Lines · Status · Client link · PO total · Dates`

10 rows per page, Previous / 1 / 2 / Next. Search + four saved views (All · Needs action · In finance ·
No PO). Live faults to fix: `Status` clipped to **"OMPLETE"**, `PO total` truncated, headers wrapping
mid-word (**"DAYS WAITI NG"**), Brand duplicating Campaign on 9 of 18 rows (render `same as campaign`).

### 5.2 Campaign workspace — 9 stepper tabs + 2
`Overview · Assignments · Client IO · Vendor IO · Deliverables · Performance · Workflow · Finance ·
Timeline`, plus **Commercial Workspace** and **Settings** as modals.

**Route map — the URL params do not match the labels:**
| Tab | Actual param |
|---|---|
| Assignments | `?tab=lines` |
| Performance | `?tab=publications` |
| Finance | `?tab=billing` |
| Settings / `?tab=finance` | **falls through to the dashboard** — fix, an unknown tab must not render another tab |

**Assignments grid — 24 tracks** (parent uses 22 + 2 blanks, child uses all 24)
```
30px 26px 116px minmax(150px,1.1fr) 66px 44px minmax(150px,1fr) 104px 46px 104px 92px 62px 82px
104px 92px 100px 116px 96px 56px 104px 118px 104px 84px 44px
```
Parent: `select · expand · Assignment · Creator · Platforms · Dlv. · Full description · Dates · Ccy ·
Rev · UR rev · AF % · AF · Cost · UR cost · VAT · Total billing · GP · MGN · OPS · Billing · Payment`
Child: `… Type · Ad line · Platform · Qty · Rev/ad + Cost/ad · Live ad date · Ccy · Rev · UR rev · AF % ·
AF · Cost · UR cost · VAT · Total billing · Month · INV · Billing · COLL · Payout · WF · +`

Above it: 7 stat tiles (Assignments · Creators · Deliverables · Progress · Completion · Blocked · Ready),
a `Creators (N records)` collapsible, and a toolbar — `Edit · Save · Internal view · Client view ·
Commercial Workspace · Settings`.

**Client IO** — status block, Document / Approval / Delivery trio, then 8 expandable panels: Assignments ·
Billing milestones · Version history · IO recipients · Email preview · Payment terms · Terms and
conditions · Attachment URL. Plus send history.

**Performance** (`?tab=publications`) — 8 KPIs, a **Sync health** panel, and a 13-column publication
register: `Creator · Handle · Platform · Type · Published · Last update · Views · Reach · Impr. · Likes ·
Cmts · ER % · Status`. Toolbar: Preview report · Combined PDF · Influencer PDF · Excel · PPT · Refresh
metrics · Mark stories live · Add publication. Reach/Impr. toggle Actual / Forecast / Manual.

**Finance** (`?tab=billing`) — 8 KPIs incl. Receivable and Remaining PO, then Billing queue ·
Operational billing · Invoices (11 cols) · Payments.

### 5.3 Finance & operations — 18 pages
PO tracker · Invoices · Client credit notes · Vendor credit notes · Vendor debit notes · Posting center ·
VAT · Collections · Treasury · Planning · Exchange rates · Periods · Vendor IO register · Move between
accounts · Reassignment center · Reports · Link generator · Invoice detail.

### 5.4 Billing
Queue (14 cols) · Overview · Invoices · Collections · **A/R aging (client parent → invoice child, buckets
as columns)** · Approvals · Vendor payments (one row per **assignment**, not per batch).

---

## 6. Components

### Button
```css
.tw-b        { height:32px; padding:0 12px; display:inline-flex; align-items:center; gap:6px;
               border:.8px solid #E3E8F2; border-radius:9px; background:#fff; color:var(--tw-ink2);
               font:600 12.5px Geist; cursor:pointer; white-space:nowrap;
               transition:border-color .15s var(--tw-ez), color .15s }
.tw-b:hover  { border-color:rgba(0,87,255,.35); color:var(--tw-bi) }
.tw-b.pri    { border-color:rgba(0,87,255,.55); color:var(--tw-bi); font:700 12px Geist;
               box-shadow:0 0 0 3px rgba(0,87,255,.08), 0 2px 14px -3px rgba(0,87,255,.4) }
.tw-b.sm     { height:27px; padding:0 10px; font-size:11.5px; border-radius:8px }
.tw-b.edit   { border-color:#F0C4C4; color:var(--tw-bad) }
.tw-b.save   { border-color:#BFE6D5; color:var(--tw-ok) }
.tw-b.on     { background:var(--tw-blue); border-color:var(--tw-blue); color:#fff }
.tw-b[disabled]{ opacity:.42; cursor:not-allowed; box-shadow:none }
```
Primary is **white with a blue outline**, not filled — matches the deployed platform.
A permanently disabled primary action is a design bug; disable only when state genuinely blocks it.

### Status pill
```css
.tw-p{ display:inline-block; padding:2px 8px; border-radius:999px; font:600 10px Geist; white-space:nowrap }
.p-n soft/muted · .p-g ok · .p-y warn · .p-r bad · .p-b lavender/blue · .p-v violet
```

### Card
```css
.tw-c { background:#fff; border-radius:12px; box-shadow:var(--tw-ring); overflow:hidden; margin-bottom:11px }
.tw-ch{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; padding:11px 14px;
        border-bottom:1px solid var(--tw-line) }
```

### Dashboard card
Gradient goes on the **header element itself**, never a fixed-height `::before` — when the title wraps a
fixed band clips the subtitle. Title + subtitle must be **one** flex child so they clip together.
```css
.tw-dc2__h{ position:relative; isolation:isolate; overflow:hidden; display:flex; align-items:flex-start;
            flex-wrap:wrap; padding:12px 15px;
            background:linear-gradient(107deg,#E9F0FF 0%,#F2F7FF 58%,#F7FAFF 100%);
            border-bottom:1px solid #DDE7FA }
.tw-dc2__h::after{ content:""; position:absolute; z-index:-1; right:-28px; top:-40px;
                   width:96px; height:96px; border-radius:50%; border:16px solid rgba(0,87,255,.09) }
.tw-dc2__h b,.tw-dc2__h u{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.tw-dc2.n     .tw-dc2__h{ warm grey gradient }      /* passive cards */
.tw-dc2.alert .tw-dc2__h{ pale red } .tw-dc2.alert{ box-shadow:0 0 0 1px #F2C9C9,0 8px 24px rgba(200,33,33,.06) }
```
Deck: `grid-template-columns:repeat(auto-fit,minmax(392px,1fr)); gap:12px`.

### Masthead (page header)
One band replacing three: gradient title row → blocker row on a translucent panel → action row on white →
one `repeat(auto-fit,minmax(104px,1fr))` metric strip. **No separate KPI cards above a table.**
```css
.tw-mast{ position:relative; isolation:isolate; overflow:hidden; border-radius:14px; background:#fff;
          box-shadow:var(--tw-ring); margin-bottom:10px }
.tw-mast::before{ content:""; position:absolute; z-index:-1; inset:0; background:var(--tw-grad) }
.tw-mast::after { ring motif, right:34%, top:-96px, 196px, border:30px rgba(255,255,255,.13) }
.tw-ms2 > div{ padding:9px 14px; border-right:1px solid var(--tw-hair) }
.tw-ms2 b    { font:600 14px 'Geist Mono'; margin-top:3px }
```
Text inside the gradient needs `position:relative; z-index:1` so the ring never sits over it.

### Frozen header
```css
.tw-frozen{ position:sticky; top:0; z-index:60; background:var(--tw-bg);
            margin:0 -14px; padding:0 14px 6px; box-shadow:0 6px 16px -12px rgba(11,15,26,.28) }
```
Past `scrollY > 64–72` add `.mini`: hide the action row, drop the blocker detail line, shrink the title,
tighten the strip. Roughly halves the frozen height while keeping name, metrics and stepper visible.

### Stepper tab bar
Dots joined by 2px connectors; completed segments `--tw-blue`; active tab on `--tw-lav`.
Not pills — the live nav communicates progress through the lifecycle.
```css
.tw-sb{ flex:1 1 0; min-width:92px; display:flex; flex-direction:column; align-items:center; gap:5px;
        padding:8px 5px 7px; border-radius:10px; position:relative }
.tw-sb::before,.tw-sb::after{ content:""; position:absolute; top:13px; height:2px; background:var(--tw-line) }
.tw-sb.done::before,.tw-sb.done::after{ background:var(--tw-blue) }
```

### Pagination
```css
.tw-pag button{ min-width:29px; height:29px; padding:0 9px; border:.8px solid #E3E8F2; border-radius:8px }
.tw-pag button[aria-current="true"]{ background:var(--tw-lav); border-color:#CDDCFF; color:var(--tw-bi) }
```
Always show `Showing X–Y of N` beside the controls.

---

## 7. Interaction

### Selection
- Select-all checkbox lives **in the header cell**, `aria-label="Select all …"`.
- Child rows derive `checked` from state. **Never hardcode a `checked` attribute** — this exact bug meant
  select-all ticked parents while children only *looked* selected, and unselect left them ticked.
- Parent ⇄ child sync: selecting a parent selects its children; ticking one child selects the parent;
  clearing clears both.
- Destructive actions state their scope — **"Remove 3"** — and remove only the selection.

### Flying selection bar
```css
.tw-selbar{ position:fixed; left:50%; bottom:20px; transform:translateX(-50%); z-index:70;
            display:flex; align-items:center; border-radius:14px; background:rgba(11,15,26,.96);
            backdrop-filter:blur(12px);
            box-shadow:0 1px 2px rgba(11,15,26,.4), 0 18px 44px -12px rgba(11,15,26,.55);
            animation:tw-rise .26s var(--tw-ez) }
@keyframes tw-rise{ from{opacity:0;transform:translateX(-50%) translateY(14px)}
                    to  {opacity:1;transform:translateX(-50%) translateY(0)} }
```
Contents: blue count chip · clear · labelled totals (Revenue · Cost · GP · Total billing · Deliverables) ·
actions. **Identical whether one row or all rows are selected.** Fixed, not sticky-inside-the-card.

### Edit mode
Explicit `Edit` → `Save`; Save disabled until Edit is pressed; never write on blur. Editable columns tint
while editing — revenue/total `#E7F0FF`, cost `#FFF4E0`. `Internal view` / `Client view` toggle hides
Cost, UR cost, AF, GP and MGN from the client view.

### Pricing calculator (opens from the selection bar)
```
af  : rev = cost × (1 + af/100)
gpm : rev = cost ÷ (1 − margin/100)     // margin, not markup — these are not the same
pr  : rev = entered price
gpv : rev = cost + gp
```
Panel floats above the bar. Live per-row preview (cost → new revenue, GP, margin, VAT, delta) plus
selection totals. Nothing written until **Apply**.

**Three guards, all required:**
1. any line pricing below cost → warn, GP goes negative
2. margin ≥ 100% → unsolvable; hold revenue at cost and say so, do not divide by zero
3. flat client price → warn that it sets the same revenue on every line regardless of cost

### Drawers and modals
- **Right drawer** `width:min(680px,96vw)` for creation forms, with a sticky footer summary
  (Deliverables · Creator cost ex-VAT · Revenue ex-VAT · GP ex-VAT · Margin), VAT in/out, the formula
  `Rev + UR Rev + AF − cost − UR Cost`, and `Ctrl+Enter` / `Ctrl+S` hints.
- **Centred modal** for record detail: `grid-template-columns:298px minmax(0,1fr)` — gradient identity
  panel left (avatar, name, handle, six figures), tabs and content right, actions pinned bottom.
  Commercials stay visible on every tab; a side drawer cannot do that.
- Scrim `rgba(11,15,26,.34)`, click-to-close, `Escape` closes, `role="dialog"` + `aria-label`.

### New-assignment drawer — 9 sections
Creator search + Browse · Pricing structure (Package / Per deliverable, `Alt+M`) · Assignment title
(auto-generated) · Posting start/end · Assignment status (**11** states: Draft, Assigned, Awaiting
content, Submitted, Approved, Scheduled, Posted, Verified, Invoiced, Paid, Closed) · Currency (6) ·
**PO utilization live** (amount, consumed, projected consumed, projected remaining, remaining %) ·
Client revenue (VAT chain: base → VAT → after VAT, UR Rev, AF %, UR Cost) · Creator cost multi-currency ·
Creator cost VAT.

---

## 8. Data honesty rules

Design requirements, not commentary — the audit found every one violated in production.

1. **Never sum mixed currencies.** Subtotal per currency; convert only with an explicit stored rate and
   show the rate. Live `Collected 12,033,111` is EGP + AED + USD added as one unit — it reconciles to the
   digit once you stop converting.
2. **Never invent a value.** Missing → `not set`. Unavailable → `—`. Zero must mean zero. Aging buckets
   read `—`, not `0`, when no invoice date exists.
3. **Empty states say why.** Name what is missing and what unlocks it — never "No data for selected
   filters", which reads as a filter mistake when the cause is a missing budget version.
4. **Show `Current` even at zero** in aging: it distinguishes "issued, not yet due" from "overdue".
   Hiding an empty Current column makes the page read as healthy.
5. **One source of truth per number.** If a figure appears twice, derive both from one expression. Where
   two bases coexist (VAT-inclusive vs ex-VAT), label which is in use — Outstanding 798,000 vs PO
   consumption 700,000 are both correct and neither says so.
6. **Surface contradictions, don't resolve them silently.** Where two systems disagree, show both and
   name the conflict. Journey "Completed" alongside "Cannot advance" is information, not noise.
7. **Aging runs from the due date**, never the issue date, and states the reference date.

---

## 9. Accessibility

- Contrast ≥ 4.5:1. Brand green `#0E9F6E` is 3.39:1 on white — use `#0A7A55` (5.35:1).
- `:focus-visible{ outline:2px solid var(--tw-blue); outline-offset:2px }` — never remove focus rings.
- `aria-label` on every icon-only control; `aria-pressed` on toggles; `aria-expanded` on disclosures;
  `aria-current` on pagination.
- Touch targets ≥ 44px under `@media (pointer:coarse)`.
- `@media (prefers-reduced-motion:reduce)` disables all transitions and the bar/modal animations.
- Icons are inline SVG, `stroke-width:1.7`, `stroke-linecap:round`. Never emoji.
- Tables scroll horizontally rather than shrinking below legibility; no fixed-px page container.

---

## 10. Build checklist

- [ ] No selector outside `.tw-*` / `.p-*` / `:root` / `*` / `body` / `@media` / `@keyframes`
- [ ] No bare `th`, `td`, `table`, `input` rules
- [ ] Every `.tw-g` block's child count equals its `--cols` track count (credit `span N`)
- [ ] Every numeric element on one of the four sizes, on Geist Mono + `tabular-nums`
- [ ] Every date through `D()`; no ISO / `Mon D, YYYY` / `DD/MM/YYYY` in output
- [ ] No `checked` hardcoded on a stateful checkbox
- [ ] Gradient on the header element, never a fixed-height pseudo-band
- [ ] **Superseded rules deleted, not overridden** — duplicate declarations for one selector are a defect.
      This caused the clipped card headers, the pinned columns and the non-floating selection bar.
- [ ] `<div>` open/close balanced per view
- [ ] Unknown route param renders a 404 or the default tab *explicitly*, never another tab's content

---

## 11. Left sidebar

46 destinations across 9 groups, with 3 sub-groups nested under Finance workspace. Collapsed rail 62px,
expanded 252px. Opens on hover at the left edge; pinnable.

### 11.1 Logo — do not redraw

Exact values read from the live platform. It is CSS-only, no image.

```css
.tw-logo         { display:flex; align-items:center; gap:10px }
.tw-logo__mk     { position:relative; width:28px; height:28px; flex:0 0 auto;
                   border-radius:7px; background:#060810; overflow:visible }
.tw-logo__mk::before{ content:""; position:absolute; left:6px; top:6px;
                      width:8px; height:8px; border-radius:50%; background:#fff }
.tw-logo__mk::after { content:""; position:absolute; right:4px; bottom:4px;
                      width:11px; height:11px; border-radius:4px; background:#0057FF }
.tw-logo__tx     { font-family:'Geist'; font-size:16px; font-weight:800;
                   letter-spacing:-.4px; color:#060810; white-space:nowrap }
.tw-logo__tx span{ color:#0057FF }
```
```html
<span class="tw-logo">
  <span class="tw-logo__mk" aria-hidden="true"></span>
  <span class="tw-logo__tx">THINK<span>WAY</span></span>
</span>
```
Wordmark is **800 weight**, not 700. The mark is a navy rounded square with a white dot top-left and a
blue rounded square bottom-right — both pseudo-elements, never an SVG or PNG.

### 11.2 Structure

```
Home                    Home · Executive
Campaign workspace      Campaigns(18) · Studio · Campaign AI
Client workspace        Holding Groups · Clients · Brands · Client IOs · Client Quotations
Vendor workspace        Vendors · Vendor IO register(117)
Discovery               Search · Shortlists · Campaign Match · Import Center
Finance workspace
  └ Billing & documents Billing(14) · PO tracker(17) · Invoices(17) ·
                        Client credit notes · Client debit notes ·
                        Vendor credit notes · Vendor debit notes
  └ Treasury & cash     Collections(1) · Treasury · Posting center
  └ Compliance & planning VAT · Exchange rates(6) · Periods · Planning
Move from acc to another Move between accounts · Reassignment center
Insights                Reports(12) · Link generator
Administration          Operations Center · Users · Security · Roles · Permissions ·
                        Access Control · Client Access · Classification Review ·
                        Email · About · System Health · Performance
```

### 11.3 Behaviour

| State | Rule |
|---|---|
| Collapsed | 62px. Icons only, centred. Group headers hidden, replaced by a 1px separator. Counts become a red dot top-right of the icon. Hover shows a dark tooltip at `left:56px` with label · count. |
| Expanded | 252px on hover at the left edge, or pinned. Labels and counts fade in over 160ms. |
| Pin | Toggle in the brand row; when pinned the rail stays open and hover does nothing. |
| Active | `--tw-lav` fill, `--tw-bi` text, weight 600, plus a 3px blue rail on the left edge via `::before`. `aria-current="page"`. |
| Group toggle | Click a group header to collapse it. `aria-expanded`. Administration alone is 12 items. |
| Search | Filters live on every keystroke; groups with no match are removed entirely, not greyed. `⌘K` hint in the field. |

```css
.tw-sb2      { position:sticky; top:0; height:100vh; width:62px; display:flex; flex-direction:column;
               background:#fff; border-right:1px solid var(--tw-line);
               transition:width .22s var(--tw-ez) }
.tw-sb2.open { width:252px; box-shadow:14px 0 34px -18px rgba(11,15,26,.26) }
.tw-li       { display:flex; align-items:center; gap:10px; padding:7px 13px;
               font:500 12.5px Geist; color:var(--tw-ink2) }
.tw-li.on    { background:var(--tw-lav); color:var(--tw-bi); font-weight:600 }
.tw-li.on::before{ content:""; position:absolute; left:0; top:5px; bottom:5px; width:3px;
                   border-radius:0 3px 3px 0; background:var(--tw-blue) }
.tw-li svg   { width:16px; height:16px; stroke-width:1.7 }
.tw-grp      { font:700 8.5px Geist; letter-spacing:.75px; text-transform:uppercase; color:#98A2B3;
               padding:10px 13px 5px }
.tw-grp.sub  { padding-left:22px; color:#AEB6C4 }
```

### 11.4 Rules

1. **Every destination needs its own icon.** 46 identical glyphs make the collapsed rail useless — draw
   40+ distinct 24×24 stroked SVGs at `stroke-width:1.7`.
2. **Counts only where the number is actionable.** Campaigns 18, Vendor IO 117, Billing 14, PO tracker 17,
   Invoices 17, Collections 1, Exchange rates 6, Reports 12. Never show `0`.
3. **A 46-item list needs search.** Without it the sidebar is a scroll, not navigation.
4. Sub-group headers indent 22px and drop a shade — the Finance hierarchy must be visible.
5. Account block pinned to the bottom, above the fold, never inside the scroll area.
6. Reduced motion disables the width transition, the label fade and the tooltip.

---

## 12. Known production faults this design corrects

| Area | Fault |
|---|---|
| Billing | Collected 12,033,111 = 9× billed; three currencies summed |
| Billing | Vendor unpaid equals total cost exactly, so paid computes to 0 |
| Billing | Table 1934px in a 1409px viewport — Status and Actions unreachable |
| Campaign | Journey reads Completed while the blocker reads Cannot advance |
| Campaign | Assignment VAT 0.00 vs its own ad line VAT 42,000 |
| Campaign | Vendor lines "invoiced" before Vendor IO can send |
| Campaign | Deliverables "Ready to invoice" with no content and no due date |
| Campaign | Invoice generated Sep 3, client approval still upcoming |
| Campaign | Email sent 0 vs Manual delivery 2 — no evidence creators agreed |
| Performance | 72 of 84 syncs failed, 12 manual, 0 synced — Completion reads 100% |
| Finance | INV-2026-19: zero-value invoice locked in "Pending regeneration", no action available |
| Finance | Payments locked "until invoices exist" while two invoices exist |
| PO tracker | 5 rows consuming budget with no PO number; negative remaining |
| Exchange rates | No rate column on the exchange-rates screen; no as-of timestamp |
| Periods | No period ever locked — all 9 months of 2026 editable |
| Collections | Database join error printed to the user, twice |
| Move | Every campaign printed as USD, including AED and EGP ones |
| Campaigns list | Status clipped to "OMPLETE"; headers wrap mid-word |
