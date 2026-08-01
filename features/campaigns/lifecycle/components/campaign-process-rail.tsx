"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { BUSINESS_PROCESS_STAGES } from "@/features/campaigns/lifecycle/campaign-stage-policy";
import type { BusinessProcessLifecycleSignal } from "@/lib/business-process/types";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  onSelectStage?: (stageId: CampaignLifecycleView["businessStageId"]) => void;
  className?: string;
  /** hero = compact decision rail; full = labeled overview rail */
  density?: "hero" | "full";
};

function railState(
  signal: BusinessProcessLifecycleSignal | undefined,
  isBusiness: boolean,
  businessState: CampaignLifecycleView["businessState"]
): string {
  if (isBusiness) {
    if (businessState === "waiting") return "waiting";
    if (businessState === "needs_attention") return "attention";
    if (businessState === "blocked") return "blocked";
    if (businessState === "ready") return "ready";
    if (businessState === "completed" || businessState === "closed") return "completed";
    return "current";
  }
  switch (signal) {
    case "completed":
      return "completed";
    case "current":
      return "current";
    case "waiting_client":
    case "waiting_vendor":
    case "waiting_internal":
      return "waiting";
    case "attention_required":
      return "attention";
    case "blocked":
      return "blocked";
    default:
      return "upcoming";
  }
}

function stateLabel(
  rail: string,
  isBusiness: boolean,
  businessStateLabel: string
): string {
  if (isBusiness) return businessStateLabel;
  switch (rail) {
    case "completed":
      return "Completed";
    case "current":
      return "Current";
    case "waiting":
      return "Waiting";
    case "attention":
      return "Needs Attention";
    case "blocked":
      return "Blocked";
    case "ready":
      return "Ready";
    default:
      return "Upcoming";
  }
}

/** ERP-style process progression rail — extends BPN; never disables navigation. */
export function CampaignProcessRail({
  lifecycle,
  onSelectStage,
  className,
  density = "full",
}: Props) {
  const signals = lifecycle.processCue.stageSignals;
  const currentIndex = Math.max(
    0,
    BUSINESS_PROCESS_STAGES.findIndex((stage) => stage.id === lifecycle.businessStageId)
  );
  const progressPct =
    BUSINESS_PROCESS_STAGES.length <= 1
      ? 100
      : Math.round((currentIndex / (BUSINESS_PROCESS_STAGES.length - 1)) * 100);

  return (
    <nav
      className={cn("thinkway-lc-process-rail", `is-${density}`, className)}
      aria-label="Campaign business process"
    >
      <div className="thinkway-lc-process-rail-head">
        <div>
          <div className="thinkway-bp-label">Campaign journey</div>
          <div className="thinkway-lc-process-rail-head-title">
            {lifecycle.businessStageLabel}
            <span className="thinkway-lc-pill">{lifecycle.businessStateLabel}</span>
          </div>
        </div>
        <div className="thinkway-lc-process-rail-legend" aria-hidden>
          <span data-rail="completed">Completed</span>
          <span data-rail="current">Current</span>
          <span data-rail="waiting">Waiting</span>
          <span data-rail="upcoming">Upcoming</span>
        </div>
      </div>

      <div className="thinkway-lc-process-rail-body">
        <div className="thinkway-lc-process-rail-trackline" aria-hidden>
          <div
            className="thinkway-lc-process-rail-trackfill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <ol className="thinkway-lc-process-rail-track">
          {BUSINESS_PROCESS_STAGES.map((stage, index) => {
            const signal = signals[stage.id] ?? "upcoming";
            const isBusiness = stage.id === lifecycle.businessStageId;
            const rail = railState(signal, isBusiness, lifecycle.businessState);
            return (
              <li
                key={stage.id}
                className="thinkway-lc-process-rail-step"
                data-rail={rail}
                data-business={isBusiness ? "true" : "false"}
              >
                <button
                  type="button"
                  className={cn(
                    "thinkway-lc-process-rail-node",
                    isBusiness && "is-business-current"
                  )}
                  onClick={() => onSelectStage?.(stage.id)}
                  title={`${stage.label} · ${stateLabel(rail, isBusiness, lifecycle.businessStateLabel)} · Owner ${stage.owner}`}
                >
                  <span className="thinkway-lc-process-rail-dot" aria-hidden>
                    {rail === "completed" ? "✓" : index + 1}
                  </span>
                  <span className="thinkway-lc-process-rail-copy">
                    <span className="thinkway-lc-process-rail-label">{stage.label}</span>
                    <span className="thinkway-lc-process-rail-meta">
                      {stateLabel(rail, isBusiness, lifecycle.businessStateLabel)}
                    </span>
                    {density === "full" || isBusiness ? (
                      <span className="thinkway-lc-process-rail-owner">{stage.owner}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
