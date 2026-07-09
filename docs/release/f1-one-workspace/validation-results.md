# F1.1 One Workspace — Validation Report

Generated: 2026-07-05T21:18:55.566Z

## Status: FAIL

- Checks passed: 58
- Checks failed: 2
- Build: FAIL
- TypeScript: FAIL

## Campaign Results

| Campaign | Passed | Failed | Status |
| --- | ---: | ---: | --- |
| BabyJoy | 9 | 0 | PASS |
| Adidas | 9 | 0 | PASS |
| Tourism | 9 | 0 | PASS |
| Finance | 9 | 0 | PASS |
| Luxury | 9 | 0 | PASS |

## Verified

- Routing composition: main page uses IntelligenceWorkspace + chat-thread embeds CampaignStudioHost
- Presentation Mode: CampaignObject unchanged, CampaignStudio render path preserved
- Decision Mode: sandbox scenarios, display-only deltas, comparison, promotion immutability
- Decision Mode architecture: no ScenarioComparisonTable, RecommendationPanel, DecisionTimeline, ClientCreatorEvaluator, or ScoreBreakdown below CampaignStudio
- Promote: only path that mutates CampaignObject

**Manual QA:** Awaiting verification — see ROUTING_COMPOSITION_FIX.md
