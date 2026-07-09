export { DecisionWorkspace } from "./components/decision-workspace";
export { CampaignStudioHost } from "./components/campaign-studio-host";
export { ScenarioBar } from "./components/scenario-bar";
export { DecisionRightPanel } from "./components/decision-right-panel";
export { CreatorDrawer } from "./components/creator-drawer";
export type { CreatorDrawerSelection } from "./components/creator-drawer";
export { StudioModeToggle } from "./components/studio-mode-toggle";
export type { StudioWorkspaceMode } from "./components/studio-mode-toggle";
export { BaselinePanel } from "./components/baseline-panel";
export { ScenarioListPanel } from "./components/scenario-list-panel";
export { BudgetSliderControl } from "./components/budget-slider-control";
export { RecommendationPanel } from "./components/recommendation-panel";
export { ScoreBreakdown } from "./components/score-breakdown";
export { ScenarioComparisonTable } from "./components/scenario-comparison-table";
export { ClientCreatorEvaluator } from "./components/client-creator-evaluator";
export { DecisionTimeline } from "./components/decision-timeline";
export { PromoteScenarioDialog } from "./components/promote-scenario-dialog";
export { useDecisionWorkspace } from "./hooks/use-decision-workspace";
export type { UseDecisionWorkspaceReturn } from "./hooks/use-decision-workspace";
export type { CampaignStudioDecisionMode } from "./types/studio-decision-mode";
export { WorkspaceScenarioStore, SCENARIO_PRESETS } from "./services/scenario-store";
export { applyScenarioToCampaignObject, buildPromotedCampaignObject } from "./services/promote-scenario";
export { buildScoreExplanations } from "./services/score-explainability";
export {
  assessClientCreator,
  recommendationLabel,
  parseCreatorUrl,
  creatorIdFromUrl,
} from "./services/client-creator-assessment";
export type * from "./types";
