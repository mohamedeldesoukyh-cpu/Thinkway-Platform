"use client";

import type { BusinessProcessProgress } from "@/lib/business-process/types";
import { cn } from "@/lib/utils";

type BusinessProcessStageSummaryProps = {
  progress: BusinessProcessProgress;
  onContinue?: () => void;
  className?: string;
  /** Compact = single meta row; default = labeled grid for workspace hero. */
  density?: "default" | "compact";
  /** Open workspace tab label — independent of business stage (Epic 3). */
  workspaceLabel?: string;
  /** Richer business-state wording when lifecycle orchestration is available. */
  businessStateLabel?: string;
};

function signalTone(signal: BusinessProcessProgress["lifecycleSignal"]): string {
  switch (signal) {
    case "blocked":
      return "thinkway-bp-tone-blocked";
    case "attention_required":
      return "thinkway-bp-tone-attention";
    case "waiting_client":
    case "waiting_vendor":
    case "waiting_internal":
      return "thinkway-bp-tone-waiting";
    case "completed":
      return "thinkway-bp-tone-complete";
    default:
      return "thinkway-bp-tone-current";
  }
}

/**
 * Reusable business-process context strip.
 * Explains operational progress — not page/tab chrome.
 */
export function BusinessProcessStageSummary({
  progress,
  onContinue,
  className,
  density = "default",
  workspaceLabel,
  businessStateLabel,
}: BusinessProcessStageSummaryProps) {
  const statusText = businessStateLabel ?? progress.statusLabel;

  if (density === "compact") {
    return (
      <div
        className={cn("thinkway-bp-summary thinkway-bp-summary-compact", className)}
        aria-label="Business process"
      >
        <span className={cn("thinkway-bp-stage", signalTone(progress.lifecycleSignal))}>
          {progress.currentStageLabel}
        </span>
        <span className="thinkway-bp-sep">·</span>
        <span>{statusText}</span>
        {workspaceLabel ? (
          <>
            <span className="thinkway-bp-sep">·</span>
            <span>Workspace: {workspaceLabel}</span>
          </>
        ) : null}
        <span className="thinkway-bp-sep">·</span>
        {onContinue ? (
          <button type="button" className="thinkway-bp-continue" onClick={onContinue}>
            {progress.nextActionLabel}
          </button>
        ) : (
          <span>{progress.nextActionLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("thinkway-bp-summary", className)}
      aria-label="Business process progress"
    >
      <div className="thinkway-bp-summary-grid">
        <div className="thinkway-bp-field">
          <span className="thinkway-bp-label">Business Stage</span>
          <span className={cn("thinkway-bp-value", signalTone(progress.lifecycleSignal))}>
            {progress.currentStageLabel}
          </span>
        </div>
        <div className="thinkway-bp-field">
          <span className="thinkway-bp-label">Owner</span>
          <span className="thinkway-bp-value">{progress.owner}</span>
        </div>
        <div className="thinkway-bp-field">
          <span className="thinkway-bp-label">Business State</span>
          <span className={cn("thinkway-bp-value", signalTone(progress.lifecycleSignal))}>
            {statusText}
          </span>
        </div>
        {workspaceLabel ? (
          <div className="thinkway-bp-field">
            <span className="thinkway-bp-label">Workspace</span>
            <span className="thinkway-bp-value">{workspaceLabel}</span>
          </div>
        ) : null}
        <div className="thinkway-bp-field">
          <span className="thinkway-bp-label">Next</span>
          <span className="thinkway-bp-value">
            {progress.nextStageLabel ?? "—"}
          </span>
        </div>
        <div className="thinkway-bp-field">
          <span className="thinkway-bp-label">Waiting For</span>
          <span className="thinkway-bp-value">
            {progress.waitingFor === "None" ? "—" : progress.waitingFor}
          </span>
        </div>
        <div className="thinkway-bp-field thinkway-bp-field-action">
          <span className="thinkway-bp-label">Expected Action</span>
          {onContinue ? (
            <button type="button" className="thinkway-bp-continue" onClick={onContinue}>
              {progress.nextActionLabel}
            </button>
          ) : (
            <span className="thinkway-bp-value">{progress.nextActionLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
