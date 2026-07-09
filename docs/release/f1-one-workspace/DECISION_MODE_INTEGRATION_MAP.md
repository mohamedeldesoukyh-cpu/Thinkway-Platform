# Decision Mode Integration Map — F1.1 One Workspace Fix

Generated: 2026-07-04

## Problem

Decision Mode rendered a second application **below** Campaign Studio: scenario comparison, creator actions, client creator evaluator, and decision timeline as sibling blocks. Manual QA failed — two apps on one page.

## Required Architecture

Campaign Studio is the **only** workspace. Decision Mode enhances existing cards in place via scenario deltas (`displayCampaignObject`) and card footers/overlays. Scenario Bar + Right Decision Panel remain. Nothing appends below the studio grid.

---

## Components Currently Rendered Below Campaign Studio (Before)

| Component | Location in host | Purpose |
| --- | --- | --- |
| `DecisionRightPanel` (mobile) | Below studio, `xl:hidden` | Mobile-only panel stack |
| `ScenarioComparisonTable` | Below studio, main column | Side-by-side scenario metrics |
| `CreatorActionControls` | Below studio, main column | Sandbox creator actions |
| `ClientCreatorEvaluator` | Below studio, main column | URL-based client creator assessment |
| `DecisionTimeline` | Below studio, main column | Audit log of scenario changes |

**Already in-place (correct):**

| Component | Location | Purpose |
| --- | --- | --- |
| `ScenarioBar` | Above studio | Scenario chips + New Scenario |
| `CampaignStudio` | Main column | All section cards with `displayCampaignObject` |
| `BudgetDecisionOverlay` | Footer of Budget Planner card | Budget slider simulation |
| `VendorDecisionOverlay` | Footer of Vendor Recommendations card | Basic creator actions |
| `DecisionRightPanel` (desktop) | Right sidebar `xl:flex` | Score, budget slider, recommendation, promote |
| `CreatorDrawer` | Modal | Creator profile on click |

---

## Integration Decisions

| Component | Decision | Target | Rationale |
| --- | --- | --- | --- |
| `ScenarioComparisonTable` | **Move to right panel** | `DecisionRightPanel` — compact table | Needed for compare; not a main-workspace block |
| `CreatorActionControls` | **Integrate into card** | `VendorDecisionOverlay` on `creator-recommendations` | Reuse full action set inline; no duplicate block |
| `ClientCreatorEvaluator` | **Integrate into card** | `VendorDecisionOverlay` on `creator-recommendations` | Client creator flow belongs with vendor card |
| `DecisionTimeline` | **Move to right panel** | `DecisionRightPanel` — collapsible section | Audit trail; redundant with scenario bar for selection |
| `ScoreBreakdown` | **Keep in right panel** | Already in `DecisionRightPanel` | Score detail belongs in decision sidebar |
| `RecommendationPanel` | **Keep in right panel** | Already in `DecisionRightPanel` | Consolidated recommendation summary |
| `BudgetSliderControl` | **Remove from right panel** | Budget Planner card overlay only | Duplicate of `BudgetDecisionOverlay` |
| `BudgetDecisionOverlay` | **Keep in card** | Budget Planner footer | Interactive budget simulation in place |
| `VendorDecisionOverlay` | **Enhance in card** | Vendor Recommendations footer | Full creator actions + client evaluator |
| KPI Forecast | **Live via `displayCampaignObject`** | Existing `KpiForecastSection` | `applyScenarioToCampaignObject` updates performance section |
| Risk Analysis | **Live via `displayCampaignObject`** | Existing `RiskAnalysisSection` | Scenario simulation reflected in campaign object |
| Creator Mix | **Live via `displayCampaignObject`** | Existing `CreatorMixSection` | Creator IDs/counts updated from simulation |
| Thinkway Decision Rationale | **Live via `displayCampaignObject`** | Existing `WhyAiSection` | Section content follows promoted display object |
| `ScenarioBar` | **Keep** | Above studio | Primary scenario navigation |
| `StudioModeToggle` | **Keep** | Above studio | Only visible addition in Presentation Mode |

---

## Live Update Wiring

```
ScenarioBar.selectScenario / applyBudgetChange / applyCreatorAction
        ↓
useDecisionWorkspace → selectedScenario
        ↓
applyScenarioToCampaignObject(sourceCampaignObject, selectedScenario)
        ↓
displayCampaignObject → CampaignStudio campaignObject prop
        ↓
Section renderers read updated sections (budget, KPIs, creators, rationale)
```

Presentation Mode passes `sourceCampaignObject` unchanged; `decisionMode` is undefined.

---

## Layout Diagrams

### Before (NOT approved)

```
┌─────────────────────────────────────────────────────────────┐
│ Scenario Bar                                    [Mode Toggle]│
├──────────────────────────────────────┬──────────────────────┤
│                                      │  Right Panel         │
│  ┌──────────────────────────────┐   │  · Active Scenario   │
│  │     CAMPAIGN STUDIO          │   │  · Score Breakdown   │
│  │  (section cards)             │   │  · Budget Slider ⚠dup│
│  └──────────────────────────────┘   │  · Recommendation    │
│                                      │  · Promote           │
│  ┌─────────────┐ ┌─────────────┐   │                      │
│  │ Scenario    │ │ Creator     │   │                      │
│  │ Comparison  │ │ Actions     │   │                      │
│  └─────────────┘ └─────────────┘   │                      │
│  ┌─────────────────────────────┐   │                      │
│  │ Client Creator Evaluator      │   │                      │
│  └─────────────────────────────┘   │                      │
│  ┌─────────────────────────────┐   │                      │
│  │ Decision Timeline             │   │                      │
│  └─────────────────────────────┘   │                      │
└──────────────────────────────────────┴──────────────────────┘
         ↑ Second app below studio — REJECTED
```

### After (approved)

```
┌─────────────────────────────────────────────────────────────┐
│ Scenario Bar                                    [Mode Toggle]│
├──────────────────────────────────────┬──────────────────────┤
│                                      │  Right Panel         │
│  ┌──────────────────────────────┐   │  · Active Scenario   │
│  │     CAMPAIGN STUDIO          │   │  · Score Breakdown   │
│  │  ┌ Budget Planner ─────────┐ │   │  · Recommendation    │
│  │  │ + budget overlay slider │ │   │  · Scenario Compare  │
│  │  └─────────────────────────┘ │   │  · Timeline (fold)   │
│  │  ┌ Vendor Recs ────────────┐ │   │  · Promote           │
│  │  │ clickable + actions +   │ │   │                      │
│  │  │ client creator eval     │ │   │                      │
│  │  └─────────────────────────┘ │   │                      │
│  │  KPI / Risk / Mix / Rationale│   │                      │
│  │  (live from displayObject)   │   │                      │
│  └──────────────────────────────┘   │                      │
│         NO blocks below studio      │                      │
└──────────────────────────────────────┴──────────────────────┘
```

### Presentation Mode (unchanged)

```
┌─────────────────────────────────────────┐
│                           [Mode Toggle] │
│  ┌───────────────────────────────────┐  │
│  │     CAMPAIGN STUDIO               │  │
│  │  (original CampaignObject)        │  │
│  │  no overlays · no scenario bar    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Files to Change

| File | Change |
| --- | --- |
| `campaign-studio-host.tsx` | Remove below-studio blocks; extend `decisionMode` props |
| `decision-right-panel.tsx` | Add comparison + timeline; remove budget slider |
| `vendor-decision-overlay.tsx` | Embed `CreatorActionControls` + `ClientCreatorEvaluator` |
| `studio-decision-mode.ts` | Extend type for client creator evaluation |
| `validate-f1-one-workspace.mjs` | Static host checks + fixture runs |
| `ONE_WORKSPACE_REPORT.md` | Architecture fix notes |

## Preserved (no changes)

- `decision-workspace.tsx` — internal/dev module
- `/ai/[conversationId]/decisions` dev route
- Discovery, AI workflows, CampaignObject architecture, simulators
- Presentation Mode render path
