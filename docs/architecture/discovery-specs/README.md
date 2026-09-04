# Discovery redesign — build order

Nine files. **Build one page per Cursor session.** The reason the last attempt stalled is that one
27KB spec covering 8 pages puts Cursor in a position where it holds the whole module in context,
touches shared CSS on every page, and has no point at which anything is finishable. These files fix
that: each page is one session, one file, one acceptance test.

## Thinkway repo mapping (Session 0 — FROZEN)

| Pack | Destination |
|---|---|
| `discovery.css` | [`app/styles/discovery.css`](../../app/styles/discovery.css) — **read-only** after Session 0 |
| Helpers `D F AB E ini pf` | [`lib/discovery/suite/`](../../lib/discovery/suite/) |
| Class-coverage + §0.12 | `npm run test:discovery-foundation` |
| Cursor rule | [`.cursor/rules/thinkway-discovery-css-readonly.mdc`](../../.cursor/rules/thinkway-discovery-css-readonly.mdc) |
| Layout wire | [`app/(dashboard)/discovery/layout.tsx`](../../app/(dashboard)/discovery/layout.tsx) (`.discovery-suite` + import) |

**Do not start page 1 until** `npm run test:discovery-foundation` passes. Missing `.tw-*` class → reopen Session 0; never page-level CSS overrides.

## Order — do not reorder

| # | File | Build | Why here |
|---|---|---|---|
| 0 | `00-FOUNDATION.md` | `discovery.css` + 6 helpers | Everything else imports it. Nothing renders yet. |
| 1 | `01-shortlists.md` | Shortlists list | Simplest grid. Proves the engine. |
| 2 | `02-shortlist-detail.md` | Shortlist detail | Adds the Statistics cell + creator modal. |
| 3 | `03-quotations.md` | Quotations list | Same shape as #1. Fast. |
| 4 | `04-quotation-detail.md` | Quotation detail | Heaviest page. Calculator, cost detail, Commercial Workspace. |
| 5 | `05-search.md` | Creator search | Reuses the modal from #2. Adds the 24-filter panel. |
| 6 | `06-intelligence.md` | Intelligence library | Small. |
| 7 | `07-campaign-match.md` | Campaign match | Form + empty state. Smallest. |
| 8 | `08-import-center.md` | Import center | Standalone. |

Pages 6, 7 and 8 depend on nothing but the foundation — build them in any order, or in parallel.

## How to prompt Cursor

One page at a time:

> Read `00-FOUNDATION.md`, then `01-shortlists.md`. Build only the page in the second file.
> Do not modify `discovery.css` — if you need a class that isn't there, stop and tell me.

That last sentence is the important one. The previous run failed because Cursor edited shared CSS
while building page 6, which silently broke pages 1–5, and nothing caught it until the end.

## After each page

Run the checks at the bottom of that page's file. They are mechanical — a class-coverage check, a
column-width check, an SVG check. **Do not start the next page until they pass.** Four of the bugs in
this build were invisible on screen and only a script found them.

## Shared rule

`discovery.css` is written once in step 0 and is read-only afterwards. Every page file below lists
the exact classes it needs; if one is missing, that is a bug in step 0, and the fix belongs there —
not in a page override. Stale overriding rules are what produced clipped headers, pinned columns and
a selection bar that would not float.
