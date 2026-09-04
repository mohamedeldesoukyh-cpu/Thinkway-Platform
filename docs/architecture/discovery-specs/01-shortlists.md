# 1 · Shortlists list

**Route:** `/discovery/shortlists` · **`PG='shortlists'`** · function `pgShortlists()`
**Prerequisite:** `00-FOUNDATION.md`. Do not modify `discovery.css`.
**Owns no overlays.** Build the page only.

Simplest grid in the module — build it first to prove the engine before anything harder.

---

## Track list — 11 columns, copy exactly

```js
const C='30px 116px minmax(180px,1.4fr) 130px 96px 92px 100px 150px 70px 110px 74px';
```

`grid(C, 1250, H, rows, foot)` — `min-width:1250px`, scrolls sideways below that.

## Header

```
☐ · Serial · Shortlist · Brand · Status · Client link · Visibility · Owner · Creators · Updated · Act
```

`Creators` and `Act` are right-aligned (`.tw-rr`). Header 11px/700 uppercase.

## Data — 8 rows

```js
const SL=[
 ['SL-2026-0026','Test 5','Alshaya','Draft','Active','Team','mohamedeldesouky',3,'Aug 22, 2026'],
 ['SL-2026-0025','Test 4','Arab Bank','Draft','Active','Team','mohamedeldesouky',3,'Aug 22, 2026'],
 ['SL-2026-0024','Test 3','','Draft','Active','Team','mohamedeldesouky',3,'Aug 21, 2026'],
 ['SL-2026-0023','Test 2','E&','Draft','Active','Team','mohamedeldesouky',3,'Aug 21, 2026'],
 ['SL-2026-0022','Test 1','E&','Draft','None','Team','mohamedeldesouky',3,'Aug 20, 2026'],
 ['SL-2026-0021','Dar Global','Dar Global','Approved','Active','Team','mohamedeldesouky',3,'Aug 18, 2026'],
 ['SL-2026-0020','FirstCry','FirstCry','Approved','None','Private','mohamedeldesouky',8,'Aug 14, 2026'],
 ['SL-2026-0019','Alshaya','Alshaya','Draft','Off','Team','mohamedeldesouky',3,'Aug 12, 2026']];
// [id, name, brand, status, clientLink, visibility, owner, creators, updated]
```

Three of these are deliberate edge cases — do not clean them up:
- `SL-2026-0024` has **no brand** → renders `not set` in `.tw-miss`, never an empty cell.
- `Test 2` and `Test 1` share the brand `E&` — an ampersand, so `E()` is mandatory.
- Client link takes **three** values: `Active` / `None` / `Off`, not a boolean.

## Cell rendering

| Column | Render |
|---|---|
| ☐ | `.tw-ck`, `aria-label="Select SL-2026-0026"` — the id, not "Select" |
| Serial | `.tw-id` — Geist Mono |
| Shortlist | `.tw-nm` |
| Brand | `.tw-br`, or `not set` in `.tw-miss` when empty |
| Status | `.tw-p` — `p-g` when `Approved`, else `p-n` |
| Client link | toggle, see below |
| Visibility | `.tw-p p-b` — `Team` / `Private` |
| Owner | 22px `.tw-av k1–k4` (cycle `i%4+1`) + `.tw-t` name, 7px gap |
| Creators | `.tw-v`, right |
| Updated | `.tw-d` → `D(s[8])` → `22 Aug 26` |
| Act | `.tw-b sm` **Open** |

## Client link — the toggle alone

The cell contains **the switch and a live dot. Nothing else.** No text label, no "Show link" button.

Three **distinct** states (do not collapse None into Off):

| State | Switch | Dot | `role="status"` label |
|---|---|---|---|
| **Active** | blue `.on` | green `.on` + `tw-ping` pulse | Client link active |
| **Off** (revoked) | grey | solid red (default `.tw-live`) | Client link revoked |
| **None** (never set up) | grey | solid grey `.none` (`--tw-mut`) | Client link not set up |

Pending round-trip: `aria-busy="true"` on the switch → foundation `.tw-sw[aria-busy="true"]{opacity:.55;pointer-events:none}` — no third DOM node, no pulse on the switch.

```css
.tw-live{background:var(--tw-bad)} /* Off */
.tw-live.none{background:var(--tw-mut)}
.tw-live.on{background:var(--tw-ok)} /* Active + pulse */
.tw-sw[aria-busy="true"]{opacity:.55;pointer-events:none}
```

`role="switch"` + `aria-checked` on the toggle; colour alone still fails accessibility — the status label is mandatory.

## Card and toolbar

Title **Shortlists**, subtitle **26 total · newest first**.
Toolbar: `.tw-search` (220px, placeholder `Search shortlists…`) + `Filter` + `Sort`.

## Masthead metrics

```
Shortlists 26 · Draft 21 · Approved 5 (g) · Creators 98 · Linked to quotation 12 ·
Client link on 19 (g) · Private 4 · Updated today 3
```

## Footer

`N of 26 shown` under the Shortlist column, and the summed creator count under Creators.
Showing 8 of 26 without saying so is the kind of quiet lie the honesty rules exist to prevent.

## Acceptance

- [ ] Track list is byte-identical to the block above; header, rows and footer share one `--cols`.
- [ ] `SL-2026-0024` shows `not set`, not blank.
- [ ] `E&` renders as `E&`, not `E&amp;` and not `E`.
- [ ] Client link cell contains exactly two elements — switch and dot. No text, no button.
- [ ] Active = green pulsing dot; Off = solid red; None = solid grey (`.none`). Status labels match.
- [ ] Every date reads `DD Mon YY`.
- [ ] Footer shows `N of M shown` and Creators `X of Y` (filtered of portfolio).
- [ ] Class-coverage script passes (§0.12).
- [ ] At 1100px the grid scrolls horizontally and no column is crushed.
