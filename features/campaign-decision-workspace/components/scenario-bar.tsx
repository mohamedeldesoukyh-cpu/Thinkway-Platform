"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { UseDecisionWorkspaceReturn } from "../hooks/use-decision-workspace";
import { SCENARIO_PRESETS } from "../services/scenario-store";

const BAR_PRESET_IDS = ["budget_cut", "client_selection", "luxury_positioning"] as const;

type ScenarioBarProps = {
  workspace: Pick<
    UseDecisionWorkspaceReturn,
    | "scenarios"
    | "selectedScenarioId"
    | "selectScenario"
    | "createScenarioFromPreset"
    | "createCustomScenario"
  >;
  className?: string;
};

export function ScenarioBar({ workspace, className }: ScenarioBarProps) {
  const {
    scenarios,
    selectedScenarioId,
    selectScenario,
    createScenarioFromPreset,
    createCustomScenario,
  } = workspace;

  const original = scenarios.find((s) => s.isOriginal);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-2 py-2",
        className
      )}
    >
      {original ? (
        <ScenarioChip
          label="Original"
          selected={original.id === selectedScenarioId}
          score={original.thinkwayScore.total}
          onClick={() => selectScenario(original.id)}
        />
      ) : null}

      {BAR_PRESET_IDS.map((presetId) => {
        const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
        if (!preset) return null;
        const label = presetId === "luxury_positioning" ? "Luxury Version" : preset.label;
        const existing = scenarios.find(
          (s) => s.name === label || s.name.startsWith(`${preset.label}`)
        );
        return (
          <ScenarioChip
            key={presetId}
            label={label}
            selected={existing?.id === selectedScenarioId}
            score={existing?.thinkwayScore.total}
            onClick={() => {
              if (existing) {
                selectScenario(existing.id);
              } else {
                createScenarioFromPreset(presetId);
              }
            }}
          />
        );
      })}

      {scenarios
        .filter((s) => !s.isOriginal && !BAR_PRESET_IDS.some((id) => {
          const preset = SCENARIO_PRESETS.find((p) => p.id === id);
          return preset && (s.name === preset.label || s.name.startsWith(`${preset.label} `));
        }))
        .map((scenario) => (
          <ScenarioChip
            key={scenario.id}
            label={scenario.name}
            selected={scenario.id === selectedScenarioId}
            score={scenario.thinkwayScore.total}
            onClick={() => selectScenario(scenario.id)}
          />
        ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 rounded-full border-dashed px-2.5 text-[11px]"
        onClick={() =>
          createCustomScenario(`Scenario ${scenarios.length}`, {}, "Custom scenario")
        }
      >
        <PlusIcon className="size-3" />
        New Scenario
      </Button>
    </div>
  );
}

function ScenarioChip({
  label,
  selected,
  score,
  onClick,
}: {
  label: string;
  selected: boolean;
  score?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors",
        selected
          ? "border-[#1D9E75]/50 bg-[#1D9E75]/10 text-[#1D9E75]"
          : "border-border/60 bg-background text-foreground hover:border-[#1D9E75]/30 hover:bg-[#1D9E75]/5"
      )}
    >
      {label}
      {score != null ? (
        <span className="tabular-nums text-[10px] opacity-80">{score}</span>
      ) : null}
    </button>
  );
}
