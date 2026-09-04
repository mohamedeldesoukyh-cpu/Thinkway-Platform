# 6 · Intelligence library

**Route:** `/discovery/intelligence/library` — **not** `/intelligence`. The label and the path differ;
an unknown param must render an explicit 404, never another page's content.
**`PG='intel'`** · function `pgIntel()`
**Prerequisite:** `00-FOUNDATION.md`. **Owns no overlays.**
**Delivery:** **Adapted** from live `CampaignIntelligenceLibrary` (not greenfield).

---

## Track list — 6 columns

```js
const C='34px minmax(200px,1.4fr) 150px minmax(170px,1fr) 150px 132px';
```

`grid(C, 1080, H, rows, foot)` · live: `DiscoverySuiteGrid` `cols="intel"`

## Header

```
☐ · Brief · Brand · Legal entity · Created · Action
```

`Action` right-aligned.

## Data — mock vs live

The HTML mock used **8 sample rows** (including two NBK Bank records). Live Development
(`campaign_intelligence_profiles`) holds **64 records**, of which **~52** match the duplicate rule
(same brief title + brand + legal entity, same calendar day) — about **81%**. Treat the mock as a
shape reference, not as production counts.

## Cell rendering

| Column | Render |
|---|---|
| Brief | `.tw-nm` |
| Brand | `.tw-br` |
| Legal entity | `.tw-t` with a `title` attribute — these truncate |
| Created | `.tw-d` → `D(…)+' · '+time` → `04 Aug 26 · 04:30` |
| Action | `Open` + `Search` (primary) |

Card: **Campaign intelligence library** / *N records · shared brief intelligence for Discovery,
campaigns, Studio and AI*.
Toolbar: `All legal entities` · `All brands` · `All campaigns` · `All statuses` · `Creator search` (primary)
· **`Duplicates only · N`** when duplicates exist.
Footer: `{shown} of {portfolio} shown`.

## The two actions do different things — label them

Each row is a **saved brief**, not a campaign:

- **Search** runs Discovery *against* the brief.
- **Open** shows the brief itself.

Two verbs on one row with no explanation is a coin flip. Keep that in the note under the grid.

## Duplicate warning — required (scale-first)

Lead with the live fraction, then one concrete example, then the review CTA. Naming only NBK when
four-fifths of the library is duplicated under-reports the problem.

```
52 of 64 records look like duplicates — same brief title, brand and legal entity, created the same day.
Two NBK Bank records were created 3 hours apart. Review before running Discovery against these briefs.
Each row is a saved brief. Search runs Discovery against it; Open shows the brief itself.
```

`.tw-note wrn` when `duplicateCount > 0`. Masthead **Duplicates** reads `52 of 64` (live counts),
not a hardcoded `2`.

**Action path (required):** a **Duplicates only** filter (toolbar toggle + note button
“Show duplicate groups”) that restricts the grid to rows in duplicate groups. A note this large
without a path to the groups is decoration.

## Masthead

```
Records 64 · Brands … · Legal entities … · Campaigns … · Newest DD Mon YY (s) · Duplicates 52 of 64 (r)
```

(Brand / legal entity / campaign figures come from live data.)

## Acceptance

- [ ] Track list byte-identical.
- [ ] Route is `/discovery/intelligence/library`; a wrong param 404s explicitly.
- [ ] Dates read `DD Mon YY · HH:MM` — one Discovery date helper, no `Intl` here.
- [ ] Legal entity truncates **and** carries a `title`.
- [ ] Duplicate note is scale-first; masthead shows live `N of M`.
- [ ] Duplicates-only filter (or equivalent) exists so the note is actionable.
- [ ] Footer says `{shown} of {portfolio} shown` — never imply the page equals the portfolio.
- [ ] Class-coverage script passes.
