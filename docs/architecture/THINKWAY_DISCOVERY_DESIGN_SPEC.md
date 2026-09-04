# Thinkway Discovery — implementation spec

Reference build: **`discovery.html`** · 179 KB · 88 KB CSS · 955 rules · 276 `.tw-*` classes.
Every number below was read out of that file, not from memory. Match it exactly.

**Scope:** 8 pages + 13 overlays. `draw()` re-renders the whole app on any state change:

```js
const PGS={search:pgSearch,intel:pgIntel,match:pgMatch,imp:pgImport,
 shortlists:pgShortlists,shortlist:pgShortlist,quotations:pgQuotations,quotation:pgQuotation};
function draw(){document.getElementById('app').innerHTML=
 bar()+PGS[PG]()+creatorModal()+costModal()+cwModal()+shareCard()+editUrlDlg()+combineDlg()
 +addCrDlg()+slAddDrawer()+qBar()+qCalcPanel()+filterPanel()+missingDlg()+searchBar2();
 bindScroll()}
```

Overlays render unconditionally and return `''` when their flag is off. Do not conditionally mount
them — the flat concatenation is what keeps z-order and focus deterministic.

---

## 1. Tokens

Copy verbatim into `:root`. 21 colours, one gradient, one shadow, one easing curve.

```css
--tw-blue:#0057FF;  --tw-b2:#1A6FFF;   --tw-bi:#0B52E0;   --tw-bdk:#0040CC;
--tw-navy:#060810;  --tw-ink:#0B0F1A;  --tw-ink2:#41495A; --tw-mut:#64748B;
--tw-line:#E2E8F0;  --tw-hair:#EDF0F5; --tw-bg:#FAFBFC;   --tw-soft:#F6F8FB;
--tw-lav:#EFF4FF;
--tw-ok:#0A7A55;    --tw-okb:#E9F7F1;
--tw-wrn:#8A5D12;   --tw-wrnb:#FFF6E8;
--tw-bad:#C82121;   --tw-badb:#FEF2F2;
--tw-vio:#5B3FD1;   --tw-viob:#F1EDFE;
--tw-grad:linear-gradient(145deg,#0040CC 0%,#0057FF 40%,#1A6FFF 70%,#0048DD 100%);
--tw-ring:0 0 0 1px rgba(0,87,255,.05),0 8px 24px rgba(0,87,255,.06);
--tw-ez:cubic-bezier(.23,1,.32,1);
```

Semantic pairs are ink + background: `ok/okb` positive, `wrn/wrnb` attention, `bad/badb` negative,
`vio/viob` AI-derived. **Never colour AI output with the brand blue** — the violet pair exists so a
machine estimate is visually distinct from a human-entered figure.

**Every rule is `.tw-`-prefixed and scoped.** No bare `th`, `td`, `table`, `input`, `button`, `a`
selectors anywhere. This file gets embedded in an existing app; a bare selector will leak.

### Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@500;600&display=swap">
```

Use `<link>`, not `@import`. An `@import` inside a scoped stylesheet fails silently and the whole
build falls back to Segoe UI, which looks almost right and breaks every column width.

---

## 2. Typography — four numeric steps, no fifth

| Step | Size | Weight | Where |
|---|---|---|---|
| Headline | 20px | 700 | masthead primary figure |
| Panel stat | 14px | 600 | card and drawer stats |
| Row value | 12.5px | 500 | grid cells |
| Micro | 11.5px | 500 | footers, captions, deltas |

All four are **Geist Mono** with `font-variant-numeric:tabular-nums`. Text is Geist.
Labels: 11px, 600, `letter-spacing:.3px`, `--tw-mut`. Column headers: 11px, 700, uppercase.

Any fifth numeric size is a bug. The reason for the rule: mixed sizes in one column make figures
un-scannable even when they are perfectly aligned.

### Dates — one format, one function

`DD Mon YY` · times `DD Mon YY · HH:MM` · ranges `03–05 Aug 26` (en dash, no spaces).
One formatter, five accepted inputs (ISO, `Date`, epoch ms, `DD/MM/YYYY`, already-formatted):

```js
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function D(v){ /* returns 'DD Mon YY'; passes through unparseable strings unchanged */ }
```

Never `Intl.DateTimeFormat` per call site — that is how the platform ended up with five formats in
one table. Relative ages (`14 days ago`) are allowed **only** in the similar-creators list, where
recency is the point.

---

## 3. Grid engine

Every table is CSS Grid, never `<table>`. One track list per page, declared once and shared by the
header, all rows, the child rows, and the footer, so alignment cannot drift.

```js
function grid(C,minW,H,rows,foot){ /* --cols:C on a wrapper; header/rows/foot inherit */ }
```

```css
.tw-hd,.tw-r{display:grid;grid-template-columns:var(--cols);align-items:center}
```

The `minW` argument (`1250` on shortlists) sets `min-width` on the scroller — below it the grid
scrolls horizontally rather than crushing columns.

### The nine track lists — copy exactly

```
pgShortlists  11  30px 116px minmax(180px,1.4fr) 130px 96px 92px 100px 150px 70px 110px 74px
pgShortlist    8  30px minmax(200px,1.4fr) 68px 140px 296px 166px 126px 96px
pgQuotations  11  30px 116px minmax(190px,1.4fr) 120px minmax(150px,1fr) 92px 92px 150px 66px 116px 74px
pgQuotation   10  30px 74px minmax(190px,1.2fr) 66px minmax(230px,1.4fr) 74px 150px 128px 84px 92px
pgSearch       6  34px minmax(210px,1.5fr) 150px 296px 166px 128px
pgIntel        6  34px minmax(200px,1.4fr) 150px minmax(170px,1fr) 150px 132px
pgImport      11  34px minmax(190px,1.4fr) 130px 116px 84px 96px 92px 92px 88px 138px 92px
cwModal        9  30px minmax(180px,1.2fr) 150px 118px 118px 92px 84px 74px 92px
qCalcPanel     8  minmax(150px,1.2fr) 104px 112px 112px 100px 74px 108px 92px
```

Checkbox column is **30px** on list pages, **34px** on the four Discovery tool pages — the latter
have a taller row because of the avatar.

Two widths are load-bearing and were wrong in the original:
- **296px** Statistics — three figures plus a platform mark, per row (§5).
- **166px** Content from feed — `3 × 44px thumbnails + 2 × 5px gaps + 16px padding = 158px` minimum.
  The live column is 130px and the labels overflow into Status.

Compute column widths from content. Do not eyeball them.

---

## 4. Page inventory and column headers

Exact labels, in order. `☐` is the select-all checkbox; **Act** is right-aligned via `.tw-rr`.

**`pgShortlists`** — *Shortlists · 26 total · newest first*
`☐ · Serial · Shortlist · Brand · Status · Client link · Visibility · Owner · Creators · Updated · Act`
Footer: `N of 26 shown` + summed creator count. Brand empty renders `not set` in `.tw-miss`, never blank.

**`pgShortlist`** — *Test 5 · SL-2026-0026 · Alshaya · Bundle Plus Communication*
`☐ · Creator · Tier · Category · Statistics · Content from feed · Status · Quoted`

**`pgQuotations`** — *Client quotations · 29 total*
`☐ · Serial · Quotation · Brand · Client · Status · Client link · Owner · Lines · Client cost · Act`

**`pgQuotation`** — *Quotation — Test 5 · QT-2026-0025 · 4 lines · 3 creators · linked to SL-2026-0026*
`☐ · Option · Creator · Tier · Service description · Platform · Type · Price · Status · Act`

**`pgSearch`** — *Creator search*
`☐ · Creator name · Category · Statistics · Content from feed · Action`

**`pgIntel`** — *Campaign intelligence* (route is `/discovery/intelligence/library`)
`☐ · Brief · Brand · Legal entity · Created · Action`

**`pgImport`** — *Import center*
`☐ · Filename · Source · Status · Type · Creators · Imported · Updated · Failed · Created · Act`

**`pgMatch`** — *Campaign match*. Brief form + empty state, no grid. Metrics read
`Matches 0 · Brief not set · Creators scanned 0 · Shortlisted 0` — an unconfigured feature. Say so
plainly and give it one primary action; do not dress an empty state as a dashboard.

### Masthead metrics (`META`)

Each page declares its own strip; third element is a colour key (`g` ok, `r` bad, `y` warn, `s` soft).

| Page | Metrics |
|---|---|
| shortlists | Shortlists 26 · Draft 21 · Approved 5 · Creators 98 · Linked to quotation 12 · Client link on 19 · Private 4 · Updated today 3 |
| shortlist | Creators 3 · Quoted 3 · Under review 3 · Approved 0 · Quotation QT-2026-0025 · Version v1 · Brief 5 open · Outputs 6 / 11 |
| quotations | Quotations 29 · Draft 24 · Approved 5 · Lines 118 · Client cost 5.08M · Base cost 4.62M · Avg GP % 9.1% · Creators 96 |
| quotation | Ccy EGP · Base cost 950,000 · Client cost 1,045,000 · GP margin 95,000 · GP % 9.1% · FM % 10.0% · Version v1.0 · Creators 3 · Lines 4 · Days left 4 |
| search | Creators 25 · Selected 0 · Platforms 4 · Countries 6 · Avg engagement 9.4% · Verified 0 · Lists 26 · Imported 3.1K |
| intel | Records 64 · Brands 12 · Legal entities 6 · Campaigns 18 · Newest 04 Aug 26 · Duplicates 2 |
| match | Matches 0 · Brief not set · Creators scanned 0 · Shortlisted 0 |
| imp | Uploads 50 · Creators 3,169 · Imported 2,630 · Updated 204 · Failed 113 · Processing 1 |

### Masthead structure

`.tw-frozen > .tw-mast > .tw-mh` (title, id, badge) `+ .tw-mb` (metric strip) `+ .tw-mr` (actions).
Frozen to the tabs; the grid scrolls beneath. Past **64px** of scroll, `#frozen` gains `.mini` and
the masthead compacts — this is the whole of `bindScroll()`:

```js
let SB=false;
function bindScroll(){if(SB)return;SB=true;
 const on=function(){const f=document.getElementById('frozen');if(!f)return;
  if(window.scrollY>64)f.classList.add('mini');else f.classList.remove('mini')};
 window.addEventListener('scroll',on,{passive:true});on()}
```

The `SB` guard matters: `draw()` runs on every state change and would otherwise stack listeners.

---

## 5. Statistics cell — one row per platform

The single most important correction in this build. Creators carry 2–3 connected platforms; the cell
renders **one row per platform**, column headers appearing once at the top.

```
        Followers   Engagement   Plays
IG        397.6K       3.06%        —
TT        454.3K      12.83%      1.2M
FB           —           —         —
```

```css
.tw-stx{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:10px;
 background:var(--tw-soft);border:1px solid var(--tw-hair)}
.tw-stx .hh,.tw-stx .rr{display:grid;grid-template-columns:28px 1fr 1fr 1fr;gap:6px}
.tw-stx .rr:not(:last-child){border-bottom:1px solid #E7ECF4;padding-bottom:2px}
```

Facebook returning three blanks **is information** — connected but not syncing. Render `—` in
`#B6BECD`. Never print `0`; a real zero and no-data-at-all are different facts.

Platform marks (`PFC`): `ig IG · tt TT · yt YT · fb FB · sc SC`, each with its own chip colour.

---

## 6. Creator profile modal

One component, two entry points — **Search** and **shortlist row** — and they must be identical
apart from the loading state. Layout: `grid-template-columns:320px minmax(0,1fr) 232px`.

**Left** (gradient panel): avatar + country flag · name · handle · `N collaborations · N with you` ·
investment score as a conic-gradient ring · platform chips with follower counts · then Engagement,
Avg plays, Quote reference, Source confidence, Verification.

**Middle**: `DT=[['ov','Overview'],['ct','Contact'],['pb','Publications'],['cf','Confidence']]`

| Tab | Contents |
|---|---|
| Overview | Audience & engagement (6 metrics) · Pricing (avg price, quotation reference, studio reference) · Recent publications (3, *View all →*) |
| Contact | Empty — *"No contact information yet"* + **Run enrichment** and **Add contact details** |
| Publications | All publications, dated Jul 2023 – Jul 2026 |
| Confidence | Authenticity · Source confidence · Verification · Categories · Historical metrics (*"No historical snapshots yet"*) |

**Right**: Similar creators — **8 rows**, each with its own similarity score and refresh age:

```
nouraneowais 100 · itsmalakosama 85 · palactapus 85 · hebaelsopkey 85 · esraafahmy 85
ahmed_elbadawy 75 (14 days ago) · reem_elkhashab 75 (13 days ago) · nnadatarekk 75
```

### Platform chips are controls

Switching rewrites six platform-scoped figures **and** the publication list. Investment score,
category, location and pricing are creator-level and do not change. Label this in the UI — it is not
inferable from the layout.

```
Instagram  183,900 followers · 8.92% · 136,200 avg plays · 3 dated publications, 7 mentions, 1 tag
TikTok     221,500 followers · 0.02% ·     290 avg plays · 3 × "No caption", all Nov 2023, no tags
```

That contrast is the product's actual signal: a larger TikTok audience that does nothing. Design the
cell so a user sees it in one glance rather than hunting for it.

### Loading state

Opened from **Search**, the investment score arrives asynchronously: spinner + *"Loading Enterprise
Creator Intelligence"* + a **Skip** control. Opened from a **shortlist**, it is cached and renders
immediately. `@keyframes tw-spin`, suppressed under `prefers-reduced-motion`.

### Header actions

`Refresh · View on <platform> · Edit URL · Combine · Close`

- **Edit URL** (`editUrlDlg`) — platform-aware, validates the host against the selected platform,
  warns that saving re-runs enrichment for that platform only.
- **Combine** (`combineDlg`) — Keep / Combine-in, confirm stays disabled until a target is picked,
  and the dialog must state it **cannot be undone**: shortlist and quotation lines pointing at the
  duplicate get re-pointed.

### One lookup, both datasets

Search renders `POOL`; shortlists render `CR`. A modal that resolves against one array fails silently
for every row that lives only in the other. Resolve across both and synthesise the missing fields:

```js
function cr(h){
 var x=CR.filter(function(c){return c[0]===h})[0]; if(x) return x;
 var p=POOL.filter(function(c){return c[0]===h})[0]; if(!p) return null;
 var score=Math.min(99,Math.round(20+p[7]*1.4));
 return [p[0],p[1],p[2],p[3],p[6]>=1000000?'Macro':p[6]>=100000?'Mid':'Micro',p[4],p[5],
  p[6],p[7],p[8],p[9],p[10],p[11],score,score>=60?'Strong':score>=40?'Consider':'Weak',
  77,'Unverified',p[4].concat(['Travel']),200000,4.6,'14 days ago'];
}
```

> **Never name a handler `open`, `close`, `print`, `focus`, `name` or `stop`.** An inline
> `onclick="open(...)"` resolves up the scope chain to `document.open()`, which blanks the page — the
> modal appears to "not open". The opener here is `openCr`.

---

## 7. Search filter panel — 24 filters, 6 groups

Source of truth is `FILTERS`; the fourth element of a chip filter is **how many chips show before
"Show N more"**.

| Group | Filters |
|---|---|
| Creator | handle or name (input) · social platform · category · creator country · language · verification (seg) |
| Search | keyword / hashtag · content language |
| Audience | audience country · gender (seg) · age range (range) · audience interests |
| Performance | follower range · custom follower range (pair) · min engagement rate (seg) · min average views (input) |
| AI intelligence | min Thinkway score (seg) · brand fit category (input) · source confidence (pair) · min brand safety score (input) |
| Advanced | last post within (seg) · pricing range USD (pair) · exclusivity · contract status |

**Eight lists are truncated — collapsed 51 chips, expanded 78. A third of all options are hidden.**

| Filter | Shown | Hidden |
|---|---|---|
| Social platform | 4 of 7 | Facebook, Snapchat, LinkedIn |
| Category | 4 of 8 | Travel, Lifestyle, Tech, Gaming |
| Creator country | 6 of 12 | Lebanon, United States, United Kingdom, France, Germany, India |
| Audience country | 6 of 12 | same six |
| Language | 6 of 8 | Turkish, Portuguese |
| Content language | 6 of 8 | Turkish, Portuguese |
| Keyword / hashtag | 3 of 5 | #travel, #beauty |
| Audience interests | 4 of 6 | Travel, Photography |

Keep the platform's own honesty notes as filter hints — they are true and they save a support ticket:

- Gender — *"Applied when audience demographic data is available on the creator."*
- Age range — *"Requires enriched audience age distribution (future backend filter)."* — i.e. inert.
- Follower range — *"Or set a custom range below."*
- Last post within — *"Filters creators with synced recent publication dates when available."*

Footer: **Clear everything** · live active-filter count · **Show results**.

---

## 8. Selection and the ⋯ menu

Flying bar, identical on Search, shortlist and quotation:

```css
.tw-selbar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:60}
```

Fixed and centred — not sticky, not in flow. It must not shift when the grid scrolls.

Search bar shows Reach · Platforms · Avg engagement. Quotation bar shows Base cost · Client cost ·
GP · GP %.

**The ⋯ holds six actions**, two of which are significant shortcuts the live UI buries:

`Stop refresh · Compare · Export · Share · Generate quotation · AI Match`

*Generate quotation* takes a Search selection straight to a priced quotation with no shortlist in
between. Give every item a one-line description; a bare verb in an overflow menu gets used by nobody.

### Parent/child selection must sync both ways

Where rows have children, a hardcoded `checked` on the child looks correct and breaks on deselect.
Keep a real set and derive the parent from it:

```js
let KSEL=new Set();
function syncKids(){KSEL=new Set();ROWS.forEach(function(a){if(SEL.has(a[0]))
 (a.kids||[]).forEach(function(k,j){KSEL.add(a[0]+'#'+j)})})}
```

Select-all selects the **filtered** rows and says so (`Select all 25 shown`). Deselect removes rows,
never the underlying creators.

---

## 9. Preview and Export — never one menu called "Share"

The live **Share** menu is three unrelated jobs in one control: 6 preview layouts, 6 export formats,
and client actions. Split into four controls, same order on shortlist and quotation:

**`👁 Preview · <layout> ▾`** — the button names the current layout, so it is never a mystery.

| Layout | Sub-label | Produces |
|---|---|---|
| Detailed | Line items | Every creator, every option line, with prices |
| Lump sum | Summary | One total, no line-level breakdown |
| Pitch presentation | Large avatars · deck | Slide per creator, built to present |
| Pitch lump sum | Pitch deck · total | Presentation layout, single total |
| Showcase | Creator deck | Creator-led, content samples to the front |
| Showcase lump sum | Deck + total | Showcase layout, single total |

**`⬇ Export ▾`** — label by purpose, not extension. Colour by kind: `doc` red, `sheet` green, `web` blue.

| Format | Label |
|---|---|
| PDF | Send to a client — fixed layout |
| PowerPoint | Present or edit the deck |
| Word | Edit the wording before sending |
| Excel | Work with the numbers |
| CSV | Feed another system |
| HTML | Open in a browser, no download |

> **Export silently uses whichever layout is currently previewed** — 6 × 6 is the same document 36
> ways with nothing on screen saying which you'll get. Head the export menu
> **"Download as — \<layout\> layout"** and tell the user to change it in Preview first.

**`🔗 Client link`** opens the share card · **`✉ Send to client`** is the primary action.

### Share card (`shareCard`)

Signed permanent URL, read-only, with Copy. Add what the live card omits: a **Status · Version ·
Document** strip carrying the same live dot as the list toggle, and — when the client link is off — a
warning that anyone opening the URL sees nothing. Revoking access is switching the toggle off, not
reissuing a URL; say that, because it is not what users assume.
Footer: access count · Open review · Send to client · Done.

---

## 10. Client-link toggle

In both lists the cell is **the switch alone** — no text label, no "Show link" button. 32 × 18 pill,
grey off, `--tw-blue` on, 14px knob, 160ms `--tw-ez`. Beside it an 8px live dot.

```css
.tw-live{position:relative;width:8px;height:8px;border-radius:50%;background:var(--tw-bad)}
.tw-live.on{background:var(--tw-ok)}
.tw-live.on::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--tw-ok);
 animation:tw-ping 1.8s var(--tw-ez) infinite}
@keyframes tw-ping{0%{transform:scale(1);opacity:.55}70%{transform:scale(2.6);opacity:0}100%{opacity:0}}
```

Green pulses, red does not — off is a resting state, not an alarm. `role="switch"` + `aria-checked`
on the toggle; `role="status"` + a text label on the dot, because green/red alone fails colour-blind
users and this dot is the only thing distinguishing two otherwise identical rows.

---

## 11. Pricing — cost detail, calculator, Commercial Workspace

### `+ Cost detail` (`costModal`, per quotation line)

Free-for-the-client toggle · calculation mode · currency · pricing units · unit cost · client cost · AF %.

```js
const CMODES=['Cost + Markup%','Cost + GP Margin%','Cost + Client cost','Cost + GP Value'];
```

Add a live breakdown ending in **what the client actually pays**. The live panel shows GP% and stops,
which is the one number nobody in the room is asking about.

### Selection calculator (`qCalcPanel`)

```js
const QM={af:{l:'Cost + AF %',      f:'client = cost × (1 + af%)',   d:25},
          gpm:{l:'Cost + GP margin %',f:'client = cost ÷ (1 − margin%)',d:30},
          price:{l:'Cost + client price',f:'client = price you enter', d:300000},
          gpv:{l:'Cost + GP value',  f:'client = cost + GP',          d:100000}};
function qNew(cost){
 if(QMODE==='af')    return cost*(1+QVAL/100);
 if(QMODE==='gpm')   return QVAL>=100?cost:cost/(1-QVAL/100);
 if(QMODE==='price') return QVAL;
 return cost+QVAL;
}
```

Always show the formula next to the mode. Per-line preview columns:
`Creator · Base cost · Client now · New client · GP · Margin · Change` then totals ending in
**Client pays**. Cancel / Apply — never auto-commit.

Three guards, all reachable with default values:
1. **Below cost** — new client price under base cost, flagged red per line.
2. **Margin ≥ 100%** — unsolvable; hold at cost and say why rather than printing `Infinity`.
3. **Flat client price** — same figure on every line regardless of cost; warn, since it is almost
   always a mistake on a multi-line quotation.

### Commercial Workspace (`cwModal`)

`☐ · Influencer · Mode · Cost · Revenue · GP % in · GP · GP % · Currency` — 9 tracks, one editable
row per line, plus Selection and Quotation summary blocks, a Commercial health verdict
(Healthy / Warning / Critical), and a filter + mode + apply toolbar with undo / redo / columns.
Explicit save. It is deliberately **not** wired to the Creators grid; keeping that separation is the
point of the modal.

### The GP conflict — show both numbers

The masthead reports `GP margin 95,000 · GP % 9.1%`. The approved block and the Commercial Workspace
both report `GP 0 · 0.0%` and mark all four lines **Critical**.

Both are right. The 95,000 is the **agency fee** — added to what the client pays, never counted as
revenue. Display both figures side by side with that one-line explanation. Do not silently pick one;
picking one is how this became a three-week argument in the first place.

---

## 12. Add creators — two different components

**Quotation → modal, 4 tabs** (`ACT`): `Discovery · Shortlist · Campaign · Manual`

- *Discovery* is usually empty — give it **Open Discovery Search** and disable Import.
- *Shortlist* / *Campaign* are pickers; show creator counts and flag a shortlist already linked.
- *Manual* needs Platform and Tier as well as name, and must warn that a manual row has no profile,
  so it is excluded from scoring and matching. That consequence is invisible otherwise.

**Shortlist → right drawer, 2 tabs** (`slAddDrawer`): `Search · Paste links`

- *Search* lists candidate cards with per-platform stats. **Creators already on the shortlist are
  dimmed and unselectable** — the live drawer lets you add a duplicate.
- *Paste links* takes up to **50** per batch; show `Detected / Already in Discovery / Will be created`
  before committing, never after.

**Add missing creator** (`missingDlg`, Search toolbar): up to **25** links, usernames derived from
the URL, existing creators skipped. New creators arrive **unenriched** — metrics follow on the next
sync, and the empty row is expected, not broken. Say so in the dialog.

---

## 13. Interaction and motion

| Element | Behaviour |
|---|---|
| Row hover | `background:var(--tw-lav)`, 120ms |
| Masthead | compacts past 64px scroll (§4) |
| Selection bar | fixed, centred, `tw-rise` in |
| Modals | `tw-pop`, scrim `rgba(6,8,16,.42)`, click-out and `Esc` close |
| Drawers | slide from the right, focus moves to first control, `Esc` closes |
| Live dot | `tw-ping` 1.8s, green only |
| Loading | `tw-spin`, with a Skip control |
| Menus | click-out closes; one open at a time |

Four keyframes total: `tw-rise · tw-pop · tw-ping · tw-spin`.
**All four are disabled under `prefers-reduced-motion:reduce`** — there are 9 such blocks in the file,
one per component that animates. Breakpoints: 1180 / 1100 / 1080 / 860px, plus `max-height:720px`
for the filter panel.

---

## 14. Data honesty rules

These are not stylistic. Each corresponds to a place where the live platform prints something untrue.

1. **`—` is not `0`.** No data and a real zero are different. `—` renders `#B6BECD`.
2. **Never blank a cell.** Missing brand renders `not set` in `.tw-miss`.
3. **Show both figures when the source disagrees**, and name the conflict (§11).
4. **A machine estimate is violet, never brand blue.** Investment score, brand fit, source confidence.
5. **State what a control does not do.** Age range filters nothing yet; a manual creator has no profile.
6. **Show the denominator.** `Outputs 6 / 11`, `N of 26 shown`, `72 of 84 syncs failed`.
7. **Never round away a discrepancy.** If the lines sum to 949,999 and the header says 950,000, show both.
8. **An empty state names its cause and its next action** — never a bare "No data".

---

## 15. Accessibility

- Grid rows are `role="row"`, cells `role="gridcell"`, header `role="row"` inside `role="grid"`.
- Every checkbox has an `aria-label` naming its row (`Select SL-2026-0026`), not just "Select".
- Toggle: `role="switch"` + `aria-checked`. Live dot: `role="status"` + text label.
- Modals: `role="dialog"` + `aria-modal="true"` + labelled by their title; focus trapped; `Esc` closes;
  focus returns to the trigger.
- Tabs: `role="tablist"` / `role="tab"` / `aria-selected`, arrow-key navigation.
- Visible focus ring on every interactive element — never `outline:none` without a replacement.
- Colour is never the only signal: status chips carry text, the live dot carries a label.
- Contrast: `--tw-mut` #64748B on white is 4.6:1 — the floor. Do not lighten it for 12px text.

---

## 16. Build checklist

- [ ] All 21 tokens present; fonts via `<link>`, not `@import`.
- [ ] Every selector `.tw-`-prefixed and scoped. Zero bare element selectors.
- [ ] Nine track lists byte-identical to §3; header, rows and footer share one `--cols`.
- [ ] Four numeric sizes only. Grep for a fifth.
- [ ] One `D()` formatter; no `Intl` at call sites; relative dates only in similar-creators.
- [ ] Statistics renders one row per platform; `—` for missing, never `0`.
- [ ] **Every class used in markup has a rule in the CSS — checked against every rendered view, not
      just the default page.** A copied component without its CSS renders *invisible*, not broken.
      This caught four defects here: the search icon, the client-link switch, `tw-rail2`, `tw-money`.
- [ ] **Every inline `<svg>` has width, height and `fill:none`.** A bare `<svg viewBox="0 0 24 24">`
      renders at the browser default **300 × 150px, filled black** — that was the "big black circle".
- [ ] **No global handler shadows a DOM member** — `open`, `close`, `print`, `focus`, `name`, `stop`.
- [ ] Creator lookup resolves against **both** `CR` and `POOL` (§6).
- [ ] Column width ≥ content width, computed: `3 × 44 + 2 × 5 + 16 = 158 → 166px`.
- [ ] All 8 "Show N more" lists expand to 78 chips total.
- [ ] Parent/child selection syncs both ways; deselect actually removes.
- [ ] Export menu names the layout it will use.
- [ ] Calculator guards: below-cost, margin ≥ 100%, flat price.
- [ ] Shortlist drawer disables creators already on the list.
- [ ] `bindScroll()` guarded by `SB` so `draw()` cannot stack listeners.
- [ ] All four keyframes disabled under `prefers-reduced-motion`.
- [ ] Unknown `PG` value renders a 404 explicitly — never another page's content.
