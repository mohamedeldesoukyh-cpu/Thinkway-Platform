"use client";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";
import { cn } from "@/lib/utils";

type BudgetDecisionOverlayProps = {
  decisionMode: CampaignStudioDecisionMode;
  className?: string;
};

export function BudgetDecisionOverlay({ decisionMode, className }: BudgetDecisionOverlayProps) {
  const { value, onChange } = decisionMode.budgetSlider;

  return (
    <div
      className={cn(
        "mt-4 rounded-xl border border-[#1D9E75]/30 bg-[#1D9E75]/5 p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-[#1D9E75]">Decision Mode · Budget Simulation</span>
        <span className="font-semibold tabular-nums">
          {value > 0 ? "+" : ""}
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={-50}
        max={50}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[#1D9E75]"
        aria-label="Budget adjustment percentage"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>-50%</span>
        <span>0%</span>
        <span>+50%</span>
      </div>
    </div>
  );
}
