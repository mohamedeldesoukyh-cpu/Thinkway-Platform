# F1.1 Component Reuse Report

## Principle

Decision Workspace became an **internal module**. Campaign Studio is the **host shell**. No duplicate implementations.

## Reuse Map

| Decision Workspace Component | Role in One Workspace |
| --- | --- |
| `use-decision-workspace.ts` | Hook wired in `CampaignStudioHost` |
| `scenario-store.ts` + `SCENARIO_PRESETS` | Scenario Bar preset chips |
| `ScenarioListPanel` | Unchanged; used by standalone `DecisionWorkspace` dev module |
| `ScenarioBar` (new) | Horizontal bar — reuses preset/store APIs from hook |
| `BudgetSliderControl` | Right panel + mirrored inline overlay on Budget Planner |
| `RecommendationPanel` | Right Decision Panel |
| `ScoreBreakdown` | Right Decision Panel |
| `ScenarioComparisonTable` | Below studio in Decision Mode |
| `ClientCreatorEvaluator` | Below studio in Decision Mode |
| `CreatorActionControls` | Below studio + vendor overlay quick actions |
| `DecisionTimeline` | Below studio in Decision Mode |
| `PromoteScenarioDialog` | Right Decision Panel |
| `promote-scenario.ts` | Display deltas + Promote API |
| `CreatorDrawer` (new) | Placeholder sheet on creator click |

## Campaign Studio Integration (minimal)

| File | Change |
| --- | --- |
| `campaign-studio.tsx` | Optional `decisionMode` prop; section footers for budget/vendor only when set |
| `studio-section-card.tsx` | Optional `sectionFooter`; passes `decisionMode` to vendor section |
| `section-renderer.tsx` | Passes `onCreatorClick` to vendor recommendations when in decision mode |
| `vendor-recommendations-section.tsx` | Optional click handlers — no change when prop absent |
| `budget-decision-overlay.tsx` | New additive overlay |
| `vendor-decision-overlay.tsx` | New additive overlay |

## Presentation Parity

When `decisionMode` is **undefined**:

- `CampaignStudio` grid, header, specialists, sections identical
- `VendorRecommendationsSection` renders non-clickable creators (original markup path)
- No footers on section cards

## Exports

Barrel: `features/campaign-decision-workspace/index.ts` — all reusable components exported for host and dev route.
