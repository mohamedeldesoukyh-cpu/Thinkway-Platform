# 6 · Intelligence library

**Route:** `/discovery/intelligence/library` — **not** `/intelligence`. The label and the path differ;
an unknown param must render an explicit 404, never another page's content.
**`PG='intel'`** · function `pgIntel()`
**Prerequisite:** `00-FOUNDATION.md`. **Owns no overlays.** Small page — 30 minutes.

---

## Track list — 6 columns

```js
const C='34px minmax(200px,1.4fr) 150px minmax(170px,1fr) 150px 132px';
```

`grid(C, 1080, H, rows, foot)`

## Header

```
☐ · Brief · Brand · Legal entity · Created · Action
```

`Action` right-aligned.

## Data — 8 rows

```js
const INTEL=[
 ['Dar Global','Dar Global','Bundle Plus Communication','Aug 4, 2026','04:30'],
 ['FirstCry','FirstCry','Bundle Plus Communication','Aug 4, 2026','04:27'],
 ['Alshaya','Alshaya','Bundle Plus Communication','Aug 4, 2026','04:25'],
 ['NBK Bank','NBK Bank','Wavemaker','Aug 4, 2026','03:26'],
 ['e& Enterprise Soak Aug 2026','E&','Essencemediacom','Aug 4, 2026','03:02'],
 ['Noon','Noon','Bundle Plus Communication','Aug 4, 2026','01:16'],
 ['NBK Bank','NBK Bank','Wavemaker','Aug 4, 2026','00:37'],
 ['Arab Bank','Arab Bank','Mind Share Egypt LTD','Aug 3, 2026','23:38']];
// [brief, brand, legalEntity, date, time]
```

## Cell rendering

| Column | Render |
|---|---|
| Brief | `.tw-nm` |
| Brand | `.tw-br` |
| Legal entity | `.tw-t` with a `title` attribute — these truncate |
| Created | `.tw-d` → `D(r[3])+' · '+r[4]` → `04 Aug 26 · 04:30` |
| Action | `Open` + `Search` (primary) |

Card: **Campaign intelligence library** / *64 records · shared brief intelligence for Discovery,
campaigns, Studio and AI*.
Toolbar: `All legal entities` · `All brands` · `All campaigns` · `All statuses` · `Creator search` (primary).
Footer: `8 of 64 shown`.

## The two actions do different things — label them

Each row is a **saved brief**, not a campaign:

- **Search** runs Discovery *against* the brief.
- **Open** shows the brief itself.

Two verbs on one row with no explanation is a coin flip. Put it in the note under the grid.

## Duplicate warning — required

```
Two NBK Bank records were created 3 hours apart on the same day — worth checking one is not a duplicate.
```

`.tw-note wrn`. Rows 4 and 7: same brief, same brand, same legal entity, `04 Aug 26 · 03:26` and
`00:37`. The masthead already counts `Duplicates 2` — the note is what makes that count actionable
instead of decorative.

## Masthead

```
Records 64 · Brands 12 · Legal entities 6 · Campaigns 18 · Newest 04 Aug 26 (s) · Duplicates 2 (r)
```

## Acceptance

- [ ] Track list byte-identical.
- [ ] Route is `/discovery/intelligence/library`; a wrong param 404s explicitly.
- [ ] Dates read `04 Aug 26 · 04:30` — one `D()` call, no `Intl` here.
- [ ] Legal entity truncates **and** carries a `title`.
- [ ] Duplicate note present and pointing at NBK Bank.
- [ ] Footer says `8 of 64 shown` — never show 8 rows implying 8 records.
- [ ] Class-coverage script passes.
