# 7 · Campaign match

**Route:** `/discovery/match` · **`PG='match'`** · function `pgMatch()`
**Prerequisite:** `00-FOUNDATION.md`. **No grid. No overlays.** Smallest page in the module.

An unconfigured feature: `Matches 0 · Brief not set · Creators scanned 0 · Shortlisted 0`.
**Design it as one honest form plus one honest empty state.** Do not dress zero state as a dashboard
— four KPI cards all reading 0 tell the user nothing and imply something is broken.

---

## Layout

**Card: Match workspace** / *score creators against your brief using unified browse and fit ranking*

Field grid: `repeat(auto-fit,minmax(170px,1fr))`, 11px gap.

| Field | Type | Options / placeholder |
|---|---|---|
| Campaign | select | `Choose a campaign…` · `TW-2026-18 · Test 6` · `TW-2026-16 · Dar Global` |
| Brand | select | `All brands` · `Alshaya` · `NBK Bank` · `Dar Global` |
| Market | select | `Egypt` · `United Arab Emirates` · `Saudi Arabia` |
| Budget | input | `e.g. 500,000` |
| Creators needed | input | `e.g. 8` |

Then full width:

**Campaign brief** — `<textarea class="tw-in">`, height 96px, `resize:vertical`,
placeholder *"Describe the campaign — audience, tone, deliverables, must-haves…"*

Footer strip: *"Matching scores every creator in Discovery against the brief and ranks by fit."*
→ `Load from library` · **`Match creators`** (primary).

**Card: Ranked creators** / *no matches yet* → empty state:

> **No matches yet**
> Enter a campaign brief and run match to see ranked creators. You can also load a saved brief from
> the Intelligence library instead of writing one.

## Two rules for this page

**The empty state names a cause and a next action.** Never a bare "No data". Both routes forward are
in the copy: write a brief, or load one from page 6.

**`Load from library` must actually reach page 6.** A brief written here and a brief saved there are
the same object; if these two screens don't connect, the Intelligence library has no consumer and
this page makes the user retype something they already have.

## Masthead

```
Matches 0 (r) · Brief not set (s) · Creators scanned 0 · Shortlisted 0
```

Badge: `No matches`.

## Acceptance

- [ ] No grid, no KPI cards, no fake charts.
- [ ] All 5 fields plus the textarea render; textarea resizes vertically only.
- [ ] Empty state gives a cause **and** two next actions.
- [ ] `Load from library` navigates to `/discovery/intelligence/library`.
- [ ] `Match creators` is the only primary button on the page.
- [ ] Page is readable at 860px.
- [ ] Class-coverage script passes.
