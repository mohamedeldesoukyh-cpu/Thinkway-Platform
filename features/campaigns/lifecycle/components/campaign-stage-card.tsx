"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { BUSINESS_PROCESS_STAGES } from "@/features/campaigns/lifecycle/campaign-stage-policy";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  onSelectStage?: (stageId: CampaignLifecycleView["businessStageId"]) => void;
  className?: string;
};

/** Epic 8 — reusable stage cards for process navigation. */
export function CampaignStageCards({ lifecycle, onSelectStage, className }: Props) {
  const signals = lifecycle.processCue.stageSignals;

  return (
    <div className={cn("thinkway-lc-stage-cards", className)} aria-label="Lifecycle stages">
      {BUSINESS_PROCESS_STAGES.map((stage) => {
        const signal = signals[stage.id] ?? "upcoming";
        const isBusiness = stage.id === lifecycle.businessStageId;
        return (
          <button
            key={stage.id}
            type="button"
            className={cn(
              "thinkway-lc-stage-card",
              isBusiness && "is-business-current",
              `is-${signal}`
            )}
            onClick={() => onSelectStage?.(stage.id)}
          >
            <div className="thinkway-lc-stage-card-label">{stage.label}</div>
            <div className="thinkway-lc-stage-card-meta">
              {isBusiness ? lifecycle.businessStateLabel : signal.replaceAll("_", " ")}
            </div>
            <div className="thinkway-lc-stage-card-owner">Owner: {stage.owner}</div>
          </button>
        );
      })}
    </div>
  );
}
