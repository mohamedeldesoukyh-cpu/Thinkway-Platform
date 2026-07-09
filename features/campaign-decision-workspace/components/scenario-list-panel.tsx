"use client";

import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { UseDecisionWorkspaceReturn } from "../hooks/use-decision-workspace";
import { SCENARIO_PRESETS } from "../services/scenario-store";

type ScenarioListPanelProps = {
  workspace: Pick<
    UseDecisionWorkspaceReturn,
    | "scenarios"
    | "selectedScenarioId"
    | "comparisonScenarioIds"
    | "selectScenario"
    | "toggleComparisonScenario"
    | "createScenarioFromPreset"
    | "createCustomScenario"
  >;
  className?: string;
};

export function ScenarioListPanel({ workspace, className }: ScenarioListPanelProps) {
  const {
    scenarios,
    selectedScenarioId,
    comparisonScenarioIds,
    selectScenario,
    toggleComparisonScenario,
    createScenarioFromPreset,
    createCustomScenario,
  } = workspace;

  return (
    <Card size="sm" className={cn("flex h-full flex-col rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Scenarios</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              createCustomScenario(`Scenario ${scenarios.length}`, {}, "Custom scenario")
            }
          >
            <PlusIcon className="size-3" />
            New Scenario
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex flex-wrap gap-1.5">
          {SCENARIO_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full border border-border/60 px-2.5 text-[11px] hover:border-[#1D9E75]/40 hover:bg-[#1D9E75]/5"
              onClick={() => createScenarioFromPreset(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {scenarios.map((scenario) => {
            const selected = scenario.id === selectedScenarioId;
            const inComparison = comparisonScenarioIds.includes(scenario.id);
            return (
              <div
                key={scenario.id}
                className={cn(
                  "rounded-xl border p-2.5 transition-colors",
                  selected
                    ? "border-[#1D9E75]/50 bg-[#1D9E75]/5"
                    : "border-border/60 bg-background hover:border-border"
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => selectScenario(scenario.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{scenario.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] tabular-nums",
                        scenario.thinkwayScore.total >= 75 && "border-[#1D9E75]/40 text-[#1D9E75]"
                      )}
                    >
                      {scenario.thinkwayScore.total}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {scenario.isOriginal ? "Original campaign" : scenario.reason ?? "Simulated delta"}
                  </p>
                </button>
                {!scenario.isOriginal && (
                  <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={inComparison}
                      onChange={() => toggleComparisonScenario(scenario.id)}
                      className="size-3 rounded border-border accent-[#1D9E75]"
                    />
                    Compare
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
