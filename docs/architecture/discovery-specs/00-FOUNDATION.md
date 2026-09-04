# 0 · Foundation — build this first, alone

**Status (Thinkway):** **FROZEN · Session 0 complete** — `app/styles/discovery.css` is read-only. Gate: `npm run test:discovery-foundation`. Next: page 1 only (`01-shortlists.md`).

**Deliverable:** `discovery.css` and six JS helpers. No page. Nothing visible.
**Do not start a page until this file is complete and frozen.**

After this step `discovery.css` is **read-only**. Every page below declares which classes it uses; if
one is missing, fix it here and re-run the page checks. Never override a foundation rule from a page.

---

## 0.1 Tokens

```css
:root{
--tw-blue:#0057FF; --tw-b2:#1A6FFF;  --tw-bi:#0B52E0;  --tw-bdk:#0040CC;
--tw-navy:#060810; --tw-ink:#0B0F1A; --tw-ink2:#41495A; --tw-mut:#64748B;
--tw-line:#E2E8F0; --tw-hair:#EDF0F5;--tw-bg:#FAFBFC;   --tw-soft:#F6F8FB;
--tw-lav:#EFF4FF;
--tw-ok:#0A7A55;   --tw-okb:#E9F7F1;
--tw-wrn:#8A5D12;  --tw-wrnb:#FFF6E8;
--tw-bad:#C82121;  --tw-badb:#FEF2F2;
--tw-vio:#5B3FD1;  --tw-viob:#F1EDFE;
--tw-grad:linear-gradient(145deg,#0040CC 0%,#0057FF 40%,#1A6FFF 70%,#0048DD 100%);
--tw-ring:0 0 0 1px rgba(0,87,255,.05),0 8px 24px rgba(0,87,255,.06);
--tw-ez:cubic-bezier(.23,1,.32,1);
}
body{background:var(--tw-bg)}
```

Semantic pairs are ink + background. `ok/okb` positive · `wrn/wrnb` attention · `bad/badb` negative ·
**`vio/viob` machine-derived**. Investment score, brand fit and source confidence are violet, never
brand blue — a user must be able to tell an estimate from an entered figure at a glance.

**Every selector is `.tw-`-prefixed.** Zero bare `th`, `td`, `table`, `input`, `button`, `a` rules.
This CSS is embedded in an existing app; one bare selector leaks into the whole product.

## 0.2 Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@500;600&display=swap">
```

`<link>`, not `@import`. An `@import` in a scoped sheet fails silently, everything falls back to
Segoe UI, and every column width is then subtly wrong in a way that looks like a layout bug.

## 0.3 Four numeric sizes — there is no fifth

| Step | Size | Weight | Used for |
|---|---|---|---|
| Headline | 20px | 700 | masthead primary figure |
| Panel stat | 14px | 600 | card / drawer stats |
| Row value | 12.5px | 500 | grid cells (`.tw-v`) |
| Micro | 11.5px | 500 | footers, captions, deltas |

All Geist Mono, `font-variant-numeric:tabular-nums`. Text is Geist.
Labels 11px/600/`.3px` in `--tw-mut`. Column headers 11px/700 uppercase.

## 0.4 Dates — one function

```js
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function D(v){/* -> 'DD Mon YY'. Accepts ISO, Date, epoch ms, 'DD/MM/YYYY',
                 'Aug 22, 2026'. Returns the input unchanged if unparseable. */}
```

`DD Mon YY` · times `D(x)+' · HH:MM'` · ranges `03–05 Aug 26` (en dash, no spaces).
No `Intl.DateTimeFormat` at call sites — that is how the live platform ended up with five formats in
one table. Relative ages (`14 days ago`) are permitted **only** in the similar-creators list.

## 0.5 Grid engine

Every table is CSS Grid. Never `<table>`. One track list per page, declared once, shared by the
header, all rows and the footer — so alignment is structurally impossible to break.

```js
function grid(C,minW,H,rows,foot){
 return '<div class="tw-g" style="min-width:'+minW+'px;--cols:'+C+'">'+
   '<div class="tw-hd">'+H+'</div>'+rows+(foot?'<div class="tw-ft">'+foot+'</div>':'')+'</div>' }
function row(C,cls,cells){ return '<div class="tw-r '+cls+'">'+cells+'</div>' }
```

```css
.tw-hd,.tw-r,.tw-ft{display:grid;grid-template-columns:var(--cols);align-items:center}
.tw-r:hover{background:var(--tw-lav)}
.tw-r.sel{background:var(--tw-lav)}
.tw-r.wrn{box-shadow:inset 3px 0 0 var(--tw-wrn)}
.tw-r.bad{box-shadow:inset 3px 0 0 var(--tw-bad)}
.tw-rr{text-align:right}
```

`minW` sets `min-width` on the scroller: below it the grid scrolls sideways rather than crushing
columns. Per-page values are in each page file.

## 0.6 The other five helpers

```js
const F  = n => n==null?'—':Number(n).toLocaleString('en-US');   // 1,045,000
const AB = n => n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const E  = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ini= s => s.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const pf = k => '<span class="tw-pf '+PFC[k][0]+'">'+PFC[k][1]+'</span>';
const PFC={ig:['ig','IG'],tt:['tt','TT'],yt:['yt','YT'],fb:['fb','FB'],sc:['sc','SC']};
```

`E()` is mandatory on every user string. Creator names contain Arabic, `&`, `|` and emoji —
`Karim Kabbany | كريم قباني` breaks the row without it.

## 0.7 Masthead

`.tw-frozen > .tw-mast > .tw-mh` (title, id, badge) `+ .tw-mb` (metric strip) `+ .tw-mr` (actions).
Frozen to the tabs; the grid scrolls beneath it. Past 64px, `#frozen` gains `.mini` and compacts.

```js
let SB=false;
function bindScroll(){if(SB)return;SB=true;
 const on=function(){const f=document.getElementById('frozen');if(!f)return;
  if(window.scrollY>64)f.classList.add('mini');else f.classList.remove('mini')};
 window.addEventListener('scroll',on,{passive:true});on()}
```

**The `SB` guard is not optional.** `draw()` re-renders on every state change and would otherwise
stack a new scroll listener each time until the page crawls.

## 0.8 Render contract

```js
const PGS={search:pgSearch,intel:pgIntel,match:pgMatch,imp:pgImport,
 shortlists:pgShortlists,shortlist:pgShortlist,quotations:pgQuotations,quotation:pgQuotation};
function draw(){document.getElementById('app').innerHTML=
 bar()+PGS[PG]()+creatorModal()+costModal()+cwModal()+shareCard()+editUrlDlg()+combineDlg()
 +addCrDlg()+slAddDrawer()+qBar()+qCalcPanel()+filterPanel()+missingDlg()+searchBar2();
 bindScroll()}
```

**Every overlay renders unconditionally and returns `''` when its flag is off.** Do not conditionally
mount them — the flat concatenation is what keeps z-order and focus deterministic. Pages add their
overlays to this chain; they never call them inline.

An unknown `PG` renders an explicit 404 — never another page's content.

## 0.9 Shared components to build now

| Class | What |
|---|---|
| `.tw-c .tw-ch .tw-ct .tw-cs .tw-pad` | card shell, header, title, subtitle, body padding |
| `.tw-b` (`.sm .pri`) | button, small, primary |
| `.tw-x` | icon button |
| `.tw-in` | input / select / textarea — one class, three elements |
| `.tw-p` (`p-g p-y p-r p-b p-n p-v`) | status pill: ok, warn, bad, blue, neutral, violet |
| `.tw-v` (`.pos .neg .z`) | numeric cell: positive, negative, zeroed-out |
| `.tw-d` | date cell |
| `.tw-nm .tw-id .tw-br .tw-t .tw-miss` | name, serial, brand, text, missing-value |
| `.tw-ck` | checkbox |
| `.tw-av .tw-avx` | avatar, avatar with country flag |
| `.tw-tags` | category chips + `.m` overflow counter |
| `.tw-search` | search box **— see the warning below** |
| `.tw-act` | right-aligned action cluster |
| `.tw-sp` | flex spacer |
| `.tw-empty` | empty state: title, body, action |
| `.tw-note` | inline note, `wrn` variant |
| `.tw-live` | live dot |
| `.tw-sw` | toggle switch |
| `.tw-selbar` | flying selection bar |
| `.tw-dlg .tw-dr .tw-scrim` | dialog, drawer, scrim |

### Two rules that cost four bugs in the reference build

**Every inline `<svg>` needs width, height and `fill:none` in CSS.**

```css
.tw-search svg{width:14px;height:14px;fill:none;stroke:var(--tw-mut);stroke-width:2}
```

A bare `<svg viewBox="0 0 24 24">` renders at the browser default **300 × 150px, filled black**.
That was the "big black circle" in two lists. It is not a layout bug and it is not obvious.

**A component copied without its CSS renders invisible, not broken.** `.tw-sw` was present in markup
and absent from CSS: a zero-size button, no error, nothing on screen. Run the class-coverage check
(§0.12) after every page.

## 0.10 Motion

Four keyframes: `tw-rise` (selection bar) · `tw-pop` (modals) · `tw-ping` (live dot) · `tw-spin`
(loading). Row hover 120ms. **All four disabled under `@media(prefers-reduced-motion:reduce)`** —
one block per animating component, 9 in the reference build.

Breakpoints: 1180 / 1100 / 1080 / 860px, plus `max-height:720px` for the filter panel.

## 0.11 Data honesty — enforce in the helpers, not per page

1. **`—` is not `0`.** Missing renders `—` in `#B6BECD` (`.tw-v.z`). A real zero and no-data are different facts.
2. **Never blank a cell.** Missing brand renders `not set` in `.tw-miss`.
3. **When two sources disagree, show both and name the conflict.** Never silently pick one.
4. **Machine estimates are violet.**
5. **State what a control does not do** (the age filter is inert; a manual creator has no profile).
6. **Show the denominator** — `Outputs 6 / 11`, `5 of 26 shown`.
7. **Empty states name a cause and a next action.** Never a bare "No data".

## 0.12 Foundation acceptance

- [ ] 21 tokens present, values exact.
- [ ] Fonts via `<link>`; computed `font-family` on a `.tw-v` is Geist Mono, not Segoe UI.
- [ ] Grep the CSS for bare element selectors — expect zero.
- [ ] Grep for numeric font sizes — expect exactly `20px`, `14px`, `12.5px`, `11.5px`.
- [ ] Every `<svg>` selector sets width, height and `fill`.
- [ ] `bindScroll()` guarded; call `draw()` 50× and assert one scroll listener.
- [ ] No global function named `open`, `close`, `print`, `focus`, `name` or `stop`. An inline
      `onclick="open(...)"` resolves to `document.open()` and blanks the page — the symptom is
      "clicking the name does nothing".
- [ ] `D()` returns `22 Aug 26` for all five accepted input shapes.
- [ ] Class-coverage script: for every `class="tw-…"` in rendered output, assert a matching rule
      exists. Keep this script — every page below re-runs it.
