"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { DecisionTimeline } from "./decision-timeline";
import { PromoteScenarioDialog } from "./promote-scenario-dialog";
import { RecommendationPanel } from "./recommendation-panel";
import { ScenarioComparisonTable } from "./scenario-comparison-table";
import { ScoreBreakdown } from "./score-breakdown";
import type { UseDecisionWorkspaceReturn } from "../hooks/use-decision-workspace";

type DecisionRightPanelProps = {
  workspace: UseDecisionWorkspaceReturn;
  className?: string;
};

export function DecisionRightPanel({ workspace, className }: DecisionRightPanelProps) {
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { selectedScenario } = workspace;

  if (!selectedScenario) {
    return null;
  }

  return (
    <aside
      className={cn(
        "hidden w-[min(100%,320px)] shrink-0 flex-col gap-3 xl:flex",
        className
      )}
    >
      <Card size="sm" className="rounded-2xl border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Active Scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{selectedScenario.name}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] tabular-nums",
                selectedScenario.thinkwayScore.total >= 75 &&
                  "border-[#1D9E75]/40 text-[#1D9E75]"
              )}
            >
              {selectedScenario.thinkwayScore.total}
            </Badge>
          </div>
          <select
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
            value={workspace.selectedScenarioId}
            onChange={(e) => workspace.selectScenario(e.target.value)}
            aria-label="Select scenario"
          >
            {workspace.scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <ScoreBreakdown
        baseline={workspace.baseline}
        score={selectedScenario.thinkwayScore}
        scenarioName={selectedScenario.name}
      />

      <RecommendationPanel recommendation={workspace.topRecommendation} />

      <ScenarioComparisonTable comparison={workspace.comparison} compact />

      <Card size="sm" className="rounded-2xl border-border/80 shadow-none">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setTimelineOpen((open) => !open)}
          aria-expanded={timelineOpen}
        >
          <span className="text-sm font-semibold">Decision Timeline</span>
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              timelineOpen && "rotate-180"
            )}
          />
        </button>
        {timelineOpen ? (
          <CardContent className="border-t border-border/60 pt-3">
            <DecisionTimeline entries={workspace.timeline} bare />
          </CardContent>
        ) : null}
      </Card>

      <div className="sticky bottom-0 pt-1">
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
      </div>
    </aside>
  );
}
