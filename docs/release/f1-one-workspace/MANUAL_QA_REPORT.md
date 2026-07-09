# F1.1 Manual QA Report

Generated: 2026-07-04T19:28:52.005Z

## Status: PASS

- Checks passed: 18
- Checks failed: 0
- Build: PASS
- TypeScript: PASS

## Root Causes

| Issue | Root cause | Fix |
| --- | --- | --- |
| Budget totals 90% | Partial parsed allocations not normalized to 100% | `normalizeBudgetAllocationPercents` + `resolveBudgetAllocations` |
| Wrong campaign in Presentation Status | Stale `presentation.content` returned verbatim | Always derive brand/campaign from `summaryCards` |
| Week 1 loading when complete | Week 1 forced `in_progress`; milestones kept `pending` | `applyTimelineCompletionStatus` when campaign complete |
| Generic budget categories | Industry profiles used Production/Management labels | Influencer categories + grounded rationale per line |
| Internal timeline phases | `deriveTimelineWeeks` used agency prep phases | Client execution phases only; filter internal milestones |
| Opportunity Finder label | Name implied search tool; section shows strategy gaps | Renamed to **Strategic Opportunities** |

## Campaign Results

| Campaign | Passed | Failed | Status |
| --- | ---: | ---: | --- |
| BabyJoy | 8 | 0 | PASS |
| Coca-Cola | 8 | 0 | PASS |

## Verified Checks

- Budget totals 100%
- Budget rationale matches influencer campaigns
- No cross-campaign data leakage in Presentation Status
- Timeline has no loading state when complete
- Timeline = campaign execution only (no internal prep)
- Presentation Status references correct campaign
- Strategic Opportunities section populated

## Files Changed

- `features/campaign-studio/services/budget-allocation.ts` — normalization + influencer allocation derivation
- `features/campaign-studio/services/industry-intelligence.ts` — influencer budget categories + Coca-Cola retail signal
- `features/campaign-intelligence/services/structured-section-builders.ts` — budget parse + client timeline defaults
- `features/campaign-intelligence/services/studio-section-data-builders.ts` — normalized budget extras + timeline completion
- `features/campaign-studio/services/presentation-intelligence.ts` — client-facing timeline + completion status
- `features/campaign-studio/services/section-data-resolver.ts` — presentation brand resolution + timeline completion
- `features/campaign-studio/types/campaign-studio.ts` — Strategic Opportunities label
- `features/campaign-decision-engine/fixtures/campaign-fixtures.ts` — BabyJoy + Coca-Cola fixtures
- `scripts/validate-f1-manual-qa.mjs` — validation runner
