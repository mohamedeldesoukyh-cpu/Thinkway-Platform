# Discovery redesign — build order

Nine files. **Build one page per Cursor session** (or adapt a live surface when one already exists —
ask first). The reason the last attempt stalled is that one 27KB spec covering 8 pages puts Cursor in
a position where it holds the whole module in context, touches shared CSS on every page, and has no
point at which anything is finishable. These files fix that: each page is one session, one file, one
acceptance test.

## Thinkway repo mapping (Session 0 — FROZEN)

| Pack | Destination |
|---|---|
| `discovery.css` | [`app/styles/discovery.css`](../../app/styles/discovery.css) — **read-only** after Session 0 |
| Helpers `D F AB E ini pf` | [`lib/discovery/suite/`](../../lib/discovery/suite/) |
| Class-coverage + §0.12 | `npm run test:discovery-foundation` |
| Cursor rule | [`.cursor/rules/thinkway-discovery-css-readonly.mdc`](../../.cursor/rules/thinkway-discovery-css-readonly.mdc) |
| Layout wire | [`app/(dashboard)/discovery/layout.tsx`](../../app/(dashboard)/discovery/layout.tsx) (`.discovery-suite` + import) |
| Full pack gate | `npm run test:discovery-pack` (pages 1–8 + foundation + class-coverage crawl) |

**Do not start page 1 until** `npm run test:discovery-foundation` passes. Missing `.tw-*` class → reopen Session 0; never page-level CSS overrides.

## What actually shipped (2026-09) — not all greenfield

| # | File | Delivery | Notes |
|---|---|---|---|
| 0 | `00-FOUNDATION.md` | Built | Frozen CSS + helpers. |
| 1 | `01-shortlists.md` | **Built fresh** | Grid engine proof. |
| 2 | `02-shortlist-detail.md` | **Adapted** | Live shortlist workspace + creator modal; suite grid + overlays. |
| 3 | `03-quotations.md` | **Built fresh** | Same shape as #1. |
| 4 | `04-quotation-detail.md` | **Adapted** | Live quotation workspace. Overlays B/C built; **D/E/F adapted** (CW shared-draft, add-creators, document-output). |
| 5 | `05-search.md` | **Adapted** | Live `CreatorSearchWorkspace`; virtualizer + inherited `--cols`. |
| 6 | `06-intelligence.md` | **Adapted** | Live library; scale-first duplicate note + Duplicates-only filter. |
| 7 | `07-campaign-match.md` | **Adapted** | Live match workspace; honest empty + Load from library. |
| 8 | `08-import-center.md` | **Adapted** | Live import center; deletion warning + summed footer. `cols="import"` ≠ `PG='imp'` (see page 8). |

### Foundation amendments (Session 0 reopen — twice)

1. **Client-link none vs off** — `.tw-live.none` (grey / not set up) distinct from Off; busy = switch opacity. Required so list page 1 honesty held.
2. **Overlay D shared-draft model** — Commercial Workspace staging shares drafts with the Creators grid; Close is a no-op (not “discard”). Pack Overlay D table amended; violet reserved for machine-derived only.

## Order — do not reorder for first-time builds

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
**Before coding any page:** ask whether a live implementation already exists; prefer adapt over rebuild.

## How to prompt Cursor

One page at a time:

> Read `00-FOUNDATION.md`, then `01-shortlists.md`. Build only the page in the second file.
> Do not modify `discovery.css` — if you need a class that isn't there, stop and tell me.
> Ask first whether this page already exists live.

That last pair of sentences is the important one. The previous run failed because Cursor edited shared
CSS while building page 6, which silently broke pages 1–5, and nothing caught it until the end.
Later sessions wasted time rebuilding working product surfaces.

## After each page

Run the checks at the bottom of that page's file. They are mechanical — a class-coverage check, a
column-width check, an SVG check. **Do not start the next page until they pass.** Four of the bugs in
this build were invisible on screen and only a script found them.

Closing the module: `npm run test:discovery-pack` must pass in **one** command (all page gates + one
class-coverage crawl).

## Shared rule

`discovery.css` is written once in step 0 and is read-only afterwards. Every page file below lists
the exact classes it needs; if one is missing, that is a bug in step 0, and the fix belongs there —
not in a page override. Stale overriding rules are what produced clipped headers, pinned columns and
a selection bar that would not float.
