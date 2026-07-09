# F1.1 One Workspace Report

Generated: Sprint F1.1 — Release 1.0 FINAL (architecture fix 2026-07-04)

## Summary

Campaign Studio at `/ai/[conversationId]` is the single host for AI chat, presentation, and decision simulation. Decision Mode **enhances existing studio cards in place** — it does not append a second application below the studio grid.

Decision Workspace remains as an internal module; the separate `/decisions` tab navigation was removed from user-facing flows.

## Route Structure

| Route | Purpose | Nav visibility |
| --- | --- | --- |
| `/ai/[conversationId]` | Primary workspace: chat + Campaign Studio + Decision Mode toggle | Yes |
| `/ai/[conversationId]/decisions` | Dev-only shell for isolated host testing | No links in app nav |

## Mode Behavior

### Presentation (default)

- Renders `CampaignStudio` with the approved `CampaignObject`
- Only addition: mode toggle control above the studio
- No scenario bar, right panel, or section overlays
- `decisionMode` prop is **not** passed — identical section render path

### Decision Mode

Campaign Studio is the **only** workspace surface:

| Surface | Behavior |
| --- | --- |
| **Scenario Bar** | Original, Budget Cut, Client Selection, Luxury Version, + New Scenario |
| **Campaign Studio cards** | Live updates via `displayCampaignObject` (KPI, risk, creator mix, rationale) |
| **Budget Planner card** | Inline `BudgetDecisionOverlay` slider |
| **Vendor Recommendations card** | Clickable creators + `VendorDecisionOverlay` (creator actions + client creator evaluator) |
| **Right Decision Panel** | Active scenario, score breakdown, recommendation, compact scenario compare, collapsible timeline, Promote |

**Removed from below studio** (architecture fix):

- Scenario comparison table
- Creator action controls block
- Client creator evaluator block
- Decision timeline block
- Duplicate budget slider in right panel

See `DECISION_MODE_INTEGRATION_MAP.md` for full before/after layout.

## Live Updates

```
ScenarioBar / budget slider / creator actions
  → useDecisionWorkspace.selectedScenario
  → applyScenarioToCampaignObject(source, scenario)
  → displayCampaignObject → CampaignStudio sections
```

Sections updating in place: Budget Planner, Vendor Recommendations, KPI Forecast, Risk Analysis, Creator Mix, Thinkway Decision Rationale.

## Immutability

- Scenario switching applies `applyScenarioToCampaignObject()` on a **clone** for display only
- Source `CampaignObject` snapshot verified unchanged until Promote
- Promote uses existing `promote-scenario.ts` + `POST /api/ai/campaign-objects/[id]/promote-scenario`

## Host Component

`CampaignStudioHost` (`features/campaign-decision-workspace/components/campaign-studio-host.tsx`):

1. Ineligible (in-progress workflow) → passthrough to `CampaignStudio`
2. Eligible + Presentation → toggle + unchanged `CampaignStudio`
3. Eligible + Decision → Scenario Bar + Campaign Studio (enhanced) + Right Panel only

## Validation

Run: `node scripts/validate-f1-one-workspace.mjs`

Fixtures: BabyJoy, Adidas, Tourism, Finance, Luxury

Static checks verify Decision Mode host does not import forbidden below-studio components.

## Unchanged Systems

- Discovery, AI workflows, CampaignObject architecture, Creator DNA, Search
- `DecisionWorkspace` component preserved for module reuse
- Presentation section components unchanged when `decisionMode` is undefined
