# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Remaining Media Plan creator drag (“Could not move creator — check the target week”)

## In progress / ready to ship

- Schedule move no longer silently no-ops when calendar weeks exceed facts `durationWeeks`
- Creator resolve: ID → display name → synthesize pin (Remaining influencer UUID vs Studio slate ID)
- UI/action pass `creatorName`; clearer error copy
- Regression tests in `media-plan-schedule.test.ts`

## Shipped

- `ready_to_invoice` no longer treated as billing-locked for Remaining reschedule · `a67c847f`
- Grain lock scoped to deliverable types being moved
- Remaining sibling Live/Partial drag lock · `8b35f54d`
- Invoice template redesign + VAT · `18052200`

## Shipped prior

- Prod TW-2026-0003 AF/billable repair · Home Recent campaigns FX parity
