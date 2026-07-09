"use client";

import { useMemo, useState } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { cn } from "@/lib/utils";

import { BaselinePanel } from "./baseline-panel";
import { BudgetSliderControl } from "./budget-slider-control";
import { ClientCreatorEvaluator } from "./client-creator-evaluator";
import { CreatorActionControls } from "./creator-action-controls";
import { DecisionTimeline } from "./decision-timeline";
import { PromoteScenarioDialog } from "./promote-scenario-dialog";
import { RecommendationPanel } from "./recommendation-panel";
import { ScenarioComparisonTable } from "./scenario-comparison-table";
import { ScenarioDetailPanel } from "./scenario-detail-panel";
import { ScenarioListPanel } from "./scenario-list-panel";
import { ScoreBreakdown } from "./score-breakdown";
import { useDecisionWorkspace } from "../hooks/use-decision-workspace";

type DecisionWorkspaceProps = {
  campaignObject: CampaignObject;
  conversationId: string;
  userId?: string;
  onCampaignObjectPromoted?: (campaignObject: CampaignObject) => void;
  className?: string;
};

export function DecisionWorkspace({
  campaignObject,
  conversationId,
  userId,
  onCampaignObjectPromoted,
  className,
}: DecisionWorkspaceProps) {
  const workspace = useDecisionWorkspace({
    campaignObject,
    conversationId,
    userId,
    onCampaignObjectPromoted,
  });

  const [budgetSlider, setBudgetSlider] = useState(0);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const creators = useMemo(
    () =>
      workspace.selectedScenario?.simulationResult.creators.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        handle: c.handle,
      })) ?? [],
    [workspace.selectedScenario]
  );

  const handleBudgetChange = (value: number) => {
    setBudgetSlider(value);
    workspace.applyBudgetChange(value);
  };

  if (!workspace.selectedScenario) {
    return (
      <div className={cn("flex min-h-[200px] items-center justify-center text-sm text-muted-foreground", className)}>
        Loading scenarios…
      </div>
    );
  }

  const { selectedScenario } = workspace;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Decision Workspace</h2>
          <p className="text-xs text-muted-foreground">
            Sandbox scenarios beside Campaign Studio · CampaignObject immutable until promote
          </p>
        </div>
        <PromoteScenarioDialog
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          scenarioName={selectedScenario.name}
          isPromoting={workspace.isPromoting}
          error={workspace.promoteError}
          disabled={selectedScenario.isOriginal}
          onConfirm={async (reason) => {
            const result = await workspace.promoteSelectedScenario(reason);
            if (result) setPromoteOpen(false);
          }}
        />
      </header>

      {/* Desktop: 3-panel layout */}
      <div className="hidden min-h-0 flex-1 gap-3 lg:grid lg:grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)_minmax(280px,1.2fr)]">
        <BaselinePanel workspace={workspace} className="min-h-0 overflow-y-auto" />
        <ScenarioListPanel workspace={workspace} className="min-h-0" />
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <ScenarioDetailPanel
            scenarioName={selectedScenario.name}
            metrics={workspace.metricComparisons}
          />
          <ScoreBreakdown
            baseline={workspace.baseline}
            score={selectedScenario.thinkwayScore}
            scenarioName={selectedScenario.name}
          />
          <BudgetSliderControl value={budgetSlider} onChange={handleBudgetChange} />
          <CreatorActionControls
            creators={creators}
            onAction={workspace.applyCreatorAction}
          />
          <ClientCreatorEvaluator
            assessments={workspace.clientCreatorAssessments}
            onEvaluateUrls={workspace.evaluateClientCreatorUrls}
          />
          <RecommendationPanel recommendation={workspace.topRecommendation} />
          <ScenarioComparisonTable comparison={workspace.comparison} />
          <DecisionTimeline entries={workspace.timeline} />
        </div>
      </div>

      {/* Mobile: stacked tabs-like sections */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:hidden">
        <BaselinePanel workspace={workspace} />
        <ScenarioListPanel workspace={workspace} />
        <ScenarioDetailPanel
          scenarioName={selectedScenario.name}
          metrics={workspace.metricComparisons}
        />
        <ScoreBreakdown
          baseline={workspace.baseline}
          score={selectedScenario.thinkwayScore}
          scenarioName={selectedScenario.name}
        />
        <BudgetSliderControl value={budgetSlider} onChange={handleBudgetChange} />
        <CreatorActionControls creators={creators} onAction={workspace.applyCreatorAction} />
        <ClientCreatorEvaluator
          assessments={workspace.clientCreatorAssessments}
          onEvaluateUrls={workspace.evaluateClientCreatorUrls}
        />
        <RecommendationPanel recommendation={workspace.topRecommendation} />
        <ScenarioComparisonTable comparison={workspace.comparison} />
        <DecisionTimeline entries={workspace.timeline} />
      </div>
    </div>
  );
}
