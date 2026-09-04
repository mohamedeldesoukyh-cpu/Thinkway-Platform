# 2 · Shortlist detail

**Route:** `/discovery/shortlists/:id` · **`PG='shortlist'`** · function `pgShortlist()`
**Prerequisite:** `00-FOUNDATION.md`. Do not modify `discovery.css`.
**Owns 4 overlays:** creator profile modal · Edit URL · Combine · Add-creators drawer.

The heaviest page after the quotation. Two things here are new and both were wrong in the original:
the **Statistics cell** and the **creator profile modal**. Budget your session accordingly.

---

## Track list — 8 columns

```js
const C='30px minmax(200px,1.4fr) 68px 140px 296px 166px 126px 96px';
```

`grid(C, 1360, H, rows, null)` — no footer on this grid.

Two widths are load-bearing and were wrong in the live platform:
- **296px** Statistics — three figures plus a platform mark, on *every* platform row.
- **166px** Content from feed — `3 × 44px + 2 × 5px gaps + 16px padding = 158px` minimum. The live
  column is 130px, so the status label overflows on top of the thumbnails.

## Header

```
☐ · Creator · Tier · Category · Statistics · Content from feed · Status · Quoted
```

## Data — 3 creators

```js
const CR=[
 ['ouda.5','oudou le king','Egypt','🇪🇬','Mid',['Fitness','Music'],1,
  183900,8.92,136200, 221500,0.02,290, 49,'Consider',77,'Unverified',
  ['Fitness','Music','Sports','Travel','Clothes'],200000,4.9,'13 days ago'],
 ['reem_elkhashab','Reem . ريم ✨','Egypt','🇪🇬','Mid',['Fitness','Music'],1,
  397600,3.06,null, 454300,12.83,1200000, 52,'Consider',71,'Unverified',
  ['Fitness','Music','Lifestyle'],300000,4.6,'1 month ago'],
 ['karimkabbany','Karim Kabbany | كريم قباني','Egypt · France','🇪🇬','Macro',['Fitness','Music'],1,
  604400,13.93,571900, 1400000,23.22,4300000, 64,'Strong',82,'Verified',
  ['Fitness','Music','Sports'],450000,4.8,'2 weeks ago']];
// [handle,name,country,flag,tier,cats,catOverflow, igF,igE,igV, ttF,ttE,ttV,
//  score,verdict,confidence,verification, allCats, price, rating, refreshed]
```

Names carry Arabic, emoji and a pipe. `E()` on every one — `Karim Kabbany | كريم قباني` breaks the
row without it, and the mixed-direction text must not reorder the Latin part.

## Statistics cell — one row per platform

**The single most important correction in this module.** The live platform collapses every creator to
one line. Creators have 2–3 connected platforms; render **one row each**, headers once at the top.

```
        Followers   Engagement   Avg views
IG        397.6K       3.06%          —
TT        454.3K      12.83%        1.2M
```

```css
.tw-stx{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:10px;
 background:var(--tw-soft);border:1px solid var(--tw-hair)}
.tw-stx .hh,.tw-stx .rr{display:grid;grid-template-columns:28px 1fr 1fr 1fr;gap:6px}
.tw-stx .rr:not(:last-child){border-bottom:1px solid #E7ECF4;padding-bottom:2px}
```

Reem's Instagram avg-views is `null` → renders `—` in `#B6BECD` via `.z`. **Never `0`.** A platform
returning nothing means connected-but-not-syncing; a real zero means it synced and got zero. Those
are different problems with different owners.

Followers and views through `AB()` (`397.6K`, `1.2M`); engagement `toFixed(2)+'%'`.

## Other cells

| Column | Render |
|---|---|
| Creator | `.tw-avx` avatar + country flag, then **name as a `<button>`** → `openCr(handle)`, `@handle` in `.hd`, country in `.lo`. Ellipsis on the name, `min-width:0` on the wrapper. |
| Tier | `.tw-p p-v` — Mid / Macro. Violet: it is derived, not entered. |
| Category | `.tw-tags` chips + `.m` overflow counter (`+1`) |
| Content from feed | 3 × `.tw-thumb` 44px, `flex:0 0 44px`, `overflow:hidden` |
| Status | `.tw-p p-y` Under review |
| Quoted | `.tw-p p-g` Quoted |

> The creator name must be a real `<button>` — not a `<span onclick>`. It needs keyboard focus and
> Enter, because opening the profile is the primary action on this page.

## Above the grid

Card: **Quotation linked** — `QT-2026-0025` · `1 quotation linked · latest version v1` · `Draft` ·
buttons **Open quotation** / **Generate new version**.

Grid card: **Creators · 3** / *Bundle Plus Communication · Alshaya*, toolbar
`Submit 0 selected · Compare · Refresh metrics · Export CSV · Generate quotation (primary)`.

Note under the grid: *"Click a creator name to open the full profile — investment score, audience,
publications, confidence and similar creators."* Keep it. The profile is the most valuable thing on
the page and nothing else advertises it.

Below: **Movement history** — audit trail, `.tw-ms` timeline, three entries `Added from discovery ·
mohamedeldesouky · 22 Aug 26 · 12:06`.

## Masthead

Title **Test 5**, id `SL-2026-0026`, subtitle *Alshaya · Bundle Plus Communication*, badge `Draft`.

```
Creators 3 · Quoted 3 (g) · Under review 3 (y) · Approved 0 (r) ·
Quotation QT-2026-0025 (s) · Version v1 (s) · Brief 5 open (y) · Outputs 6 / 11 (s)
```

Actions: `👁 Preview · Detailed ▾` · `⬇ Export ▾` · `🔗 Client link` · `✉ Send to client` ·
`Open Studio` · `Complete brief 5` · `+ Add creators` · `⋯`

Preview and Export are specified in **page 4 §Preview and Export** — build them there and reuse.

---

## Overlay A — creator profile modal

One component, shared with page 5 (Search). Identical apart from the loading state.
Layout `grid-template-columns:320px minmax(0,1fr) 232px`.

**Left** (gradient panel): avatar + flag · name · handle · `N collaborations · N with you` ·
investment score as a conic-gradient ring · platform chips with follower counts · Engagement ·
Avg plays · Quote reference · Source confidence · Verification.

**Middle** — tabs `DT=[['ov','Overview'],['ct','Contact'],['pb','Publications'],['cf','Confidence']]`

| Tab | Contents |
|---|---|
| Overview | Audience & engagement (6 metrics) · Pricing (avg price, quotation ref, studio ref) · Recent publications (3, *View all →*) |
| Contact | **Empty** — "No contact information yet" + **Run enrichment** / **Add contact details** |
| Publications | Full list, Jul 2023 – Jul 2026 |
| Confidence | Authenticity · Source confidence · Verification · Categories · Historical metrics ("No historical snapshots yet") |

**Right** — Similar creators, **8 rows**, each with its own score and refresh age:

```js
const SIM=[['nouraneowais',100,'about 1 month ago'],['itsmalakosama',85,'about 1 month ago'],
 ['palactapus',85,'about 1 month ago'],['hebaelsopkey',85,'about 1 month ago'],
 ['esraafahmy',85,'about 1 month ago'],['ahmed_elbadawy',75,'14 days ago'],
 ['reem_elkhashab',75,'13 days ago'],['nnadatarekk',75,'about 1 month ago']];
```

This is the only place relative dates are allowed — here recency *is* the information.

### Platform chips are controls

```js
const PLATS={
 ig:{n:'Instagram',handle:'ouda.5',f:183900,e:8.92,ap:136200, pubs:[/* 3 dated, Jul 2026 + Jul 2023 */],
     tags:['#inloveAF'], ments:['@taptapsendeg','@visa_eg','@nazazy','@maisongamil',
     '@iramjewelry_','@ayaabdelhamid','@oreoegypt']},
 tt:{n:'TikTok',handle:'ouda.5',f:221500,e:0.02,ap:290, pubs:[/* 3 × "No caption", all Nov 2023 */],
     tags:[],ments:[]}};
```

Switching rewrites six platform-scoped figures **and** the publication list. Investment score,
category, location and pricing are creator-level and do **not** change — label this, because the
layout does not imply it and users assume the whole panel switched.

The contrast is the product's actual signal: TikTok has the larger audience and does nothing —
0.02% engagement, 290 avg plays, three captionless posts from Nov 2023. Design the panel so that
lands in one glance instead of requiring arithmetic.

### Header actions

`Refresh · View on <platform> · Edit URL · Combine · Close`

## Overlay B — Edit URL

Platform-aware. Validates the host against the selected platform (an instagram.com URL under the
TikTok chip is an error, not a warning). States that saving re-runs enrichment **for that platform
only**.

## Overlay C — Combine

Keep / Combine-in. Confirm stays **disabled until a target is chosen**. The dialog must say it
**cannot be undone**: shortlist and quotation lines pointing at the duplicate get re-pointed.

## Overlay D — Add creators drawer

Right drawer, 2 tabs: `Search · Paste links`.

- **Search** — candidate cards with per-platform stats. **Creators already on the shortlist are
  dimmed and unselectable.** The live drawer lets you add a duplicate, which then needs Combine to
  fix — prevent it at the point of entry instead.
- **Paste links** — up to 50 per batch. Show `Detected / Already in Discovery / Will be created`
  **before** committing, not after.

## Acceptance

- [ ] Track list byte-identical; Statistics is 296px, feed is 166px.
- [ ] Reem renders **3 platform rows**, one per connected platform, headers once.
- [ ] Reem's IG avg-views is `—` in `#B6BECD`, not `0`.
- [ ] `Karim Kabbany | كريم قباني` renders intact, ellipsised, row not broken.
- [ ] Creator name is a `<button>`, reachable by Tab, opens on Enter.
- [ ] Clicking any of the 3 names opens the profile. **Test all three, not one.**
- [ ] Similar creators shows 8 rows with 4 distinct scores.
- [ ] Switching IG→TT changes 6 figures and the publication list; score and price do not move.
- [ ] Contact tab shows the empty state with both actions — it is not a bug.
- [ ] Combine confirm is disabled until a target is picked.
- [ ] Add-creators drawer disables a creator already on the shortlist.
- [ ] No handler named `open` (see §0.12) — the symptom is a blank page, not an error.
- [ ] Class-coverage script passes across **all overlay states**, not just the default page.
