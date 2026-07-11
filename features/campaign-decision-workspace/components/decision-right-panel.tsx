"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STUDIO_CLASSES } from "@/features/campaign-studio/constants/studio-tokens";

import { DecisionTimeline } from "./decision-timeline";
import { PromoteScenarioDialog } from "./promote-scenario-dialog";
import { RecommendationPanel } from "./recommendation-panel";
import { ScenarioComparisonTable } from "./scenario-comparison-table";
import { ScoreBreakdown } from "./score-breakdown";
import type { UseDecisionWorkspaceReturn } from "../hooks/use-decision-workspace";

type DecisionRightPanelProps = {
  workspace: UseDecisionWorkspaceReturn;
  className?: string;
  /** Sidebar rail (desktop) vs stacked below studio (mobile/tablet). */
  variant?: "sidebar" | "stacked";
};

export function DecisionRightPanel({
  workspace,
  className,
  variant = "sidebar",
}: DecisionRightPanelProps) {
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { selectedScenario } = workspace;

  if (!selectedScenario) {
    return null;
  }

  return (
    <aside
      className={cn(
        variant === "sidebar"
          ? "hidden w-[min(100%,320px)] shrink-0 flex-col gap-3 xl:flex"
          : "flex w-full flex-col gap-3",
        className
      )}
    >
      <Card size="sm" className={cn(STUDIO_CLASSES.card, "rounded-2xl")}>
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
                  "border-brand-product/40 text-brand-product"
              )}
            >
              {selectedScenario.thinkwayScore.total}
            </Badge>
          </div>
          <select
            className={cn(
              "h-8 w-full rounded-lg border border-border bg-background px-2 text-xs",
              STUDIO_CLASSES.focusRing
            )}
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

      <Card size="sm" className={cn(STUDIO_CLASSES.card, "rounded-2xl")}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between px-4 py-3 text-left",
            STUDIO_CLASSES.focusRing
          )}
          onClick={() => setTimelineOpen((open) => !open)}
          aria-expanded={timelineOpen}
          aria-controls="decision-timeline-panel"
        >
          <span className="text-sm font-semibold">Decision Timeline</span>
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              timelineOpen && "rotate-180"
            )}
          />
        </button>
        {timelineOpen ? (
          <CardContent
            id="decision-timeline-panel"
            className="border-t border-border/60 pt-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          >
            <DecisionTimeline entries={workspace.timeline} bare />
          </CardContent>
        ) : null}
      </Card>

      <div
        className={cn(
          "sticky bottom-0 z-10 pt-2",
          variant === "stacked" &&
            "-mx-1 border-t border-border/60 bg-background/85 px-1 pb-1 backdrop-blur supports-[backdrop-filter]:bg-background/70"
        )}
      >
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
