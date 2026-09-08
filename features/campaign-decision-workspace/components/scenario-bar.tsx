"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { UseDecisionWorkspaceReturn } from "../hooks/use-decision-workspace";
import { STUDIO_CLASSES } from "@/features/campaign-studio/constants/studio-tokens";
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
        "cs-scn-bar flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="tablist"
      aria-label="Campaign scenarios"
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
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "cs-scn",
        selected && "on",
        "inline-flex !grid-cols-none h-auto shrink-0 !flex-row items-center gap-2 !border-0 !px-3 !py-2",
        STUDIO_CLASSES.focusRingInset,
        selected
          ? "bg-[#EFF4FF] text-[#0B52E0]"
          : "bg-background text-foreground hover:bg-[#EFF4FF]/60"
      )}
    >
      <span className="min-w-0">
        <b className="block truncate text-[13px]">{label}</b>
        {score != null ? (
          <p className="m-0 text-[11px] text-[#64748B]">Score {score}</p>
        ) : (
          <p className="m-0 text-[11px] text-[#64748B]">Create scenario</p>
        )}
      </span>
    </button>
  );
}
