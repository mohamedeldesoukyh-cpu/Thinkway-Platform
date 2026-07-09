"use client";

import { CheckCircle2Icon, CircleIcon, CircleDotIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { WorkflowResponseMetadata, WorkflowSummarySection } from "@/features/ai-workflows";
import {
  deserializeCampaignObject,
  type CampaignObject,
  type CampaignObjectSnapshot,
} from "@/features/campaign-intelligence";
import { WORKFLOW_STATUS_LABELS } from "../constants/ai-copy";

type WorkflowDashboardPanelProps = {
  metadata: WorkflowResponseMetadata;
  className?: string;
};

export function WorkflowDashboardPanel({
  metadata,
  className,
}: WorkflowDashboardPanelProps) {
  const percent = metadata.totalSteps
    ? Math.round((metadata.completedTasks.length / metadata.totalSteps) * 100)
    : 0;

  const statusLabel =
    metadata.status === "paused"
      ? metadata.pauseReason === "approval_required"
        ? WORKFLOW_STATUS_LABELS.awaitingApproval
        : metadata.pauseReason === "disambiguation"
          ? WORKFLOW_STATUS_LABELS.needsClarification
          : metadata.pauseReason === "missing_info"
            ? WORKFLOW_STATUS_LABELS.missingInfo
            : WORKFLOW_STATUS_LABELS.paused
      : metadata.status === "completed" || (metadata.summarySections?.length ?? 0) > 0
        ? WORKFLOW_STATUS_LABELS.completed
        : metadata.status === "running"
          ? WORKFLOW_STATUS_LABELS.running
          : metadata.status;

  return (
    <div
      className={cn(
        "mt-2.5 space-y-3 rounded-lg border border-border bg-muted/40 p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CircleDotIcon className="size-4 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-medium">{metadata.workflowName}</span>
        </div>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {metadata.currentStep}/{metadata.totalSteps}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="ai-progress-bar h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {metadata.summarySections?.length ? (
        <WorkflowSummarySections sections={metadata.summarySections} />
      ) : null}

      {metadata.completedTasks.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Completed
          </p>
          <ul className="space-y-0.5">
            {metadata.completedTasks.map((task) => (
              <li key={task} className="flex items-center gap-1.5 text-xs">
                <CheckCircle2Icon className="size-3 shrink-0 text-[#1D9E75]" />
                {task}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {metadata.pendingTasks.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Pending
          </p>
          <ul className="space-y-0.5">
            {metadata.pendingTasks.slice(0, 5).map((task) => (
              <li key={task} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CircleIcon className="size-3 shrink-0" />
                {task}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {metadata.clarificationQuestion ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-[11px] font-bold tracking-wide text-amber-800 uppercase dark:text-amber-300">
            {WORKFLOW_STATUS_LABELS.needsClarification}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            {metadata.clarificationQuestion}
          </p>
        </div>
      ) : null}

      {metadata.recommendedNextAction ? (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Next: </span>
          {metadata.recommendedNextAction}
        </p>
      ) : null}
    </div>
  );
}

export function isWorkflowMetadata(
  metadata: Record<string, unknown> | undefined
): metadata is WorkflowResponseMetadata & Record<string, unknown> {
  return metadata?.workflow === true && typeof metadata.workflowId === "string";
}

/** Build display metadata from message metadata fields. */
export function toWorkflowDisplayMetadata(
  metadata: Record<string, unknown>
): WorkflowResponseMetadata & { campaignObject?: CampaignObject } {
  return {
    workflow: true,
    workflowId: metadata.workflowId as WorkflowResponseMetadata["workflowId"],
    workflowName: String(metadata.workflowName ?? "Workflow"),
    status: (metadata.workflowStatus ?? metadata.status ?? "completed") as WorkflowResponseMetadata["status"],
    currentStep: Number(metadata.workflowStep ?? metadata.currentStep ?? 0),
    totalSteps: Number(metadata.workflowTotalSteps ?? metadata.totalSteps ?? 0),
    completedTasks: (metadata.completedTasks as string[]) ?? [],
    pendingTasks: (metadata.pendingTasks as string[]) ?? [],
    currentTaskTitle: metadata.currentTaskTitle as string | undefined,
    recommendedNextAction: metadata.recommendedNextAction as string | undefined,
    pauseReason: metadata.pauseReason as WorkflowResponseMetadata["pauseReason"],
    clarificationQuestion: metadata.clarificationQuestion as string | undefined,
    summarySections: metadata.summarySections as WorkflowSummarySection[] | undefined,
    inferredFields: metadata.inferredFields as string[] | undefined,
    campaignObject: metadata.campaignObject
      ? deserializeCampaignObject(metadata.campaignObject as CampaignObjectSnapshot)
      : undefined,
  };
}

function WorkflowSummarySections({ sections }: { sections: WorkflowSummarySection[] }) {
  return (
    <div className="space-y-2 border-t border-border pt-2">
      <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        Results
      </p>
      <div className="space-y-2.5">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-md border border-border/80 bg-background/80 p-2.5"
          >
            <p className="text-xs font-semibold text-foreground">{section.title}</p>
            <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {section.content.length > 600
                ? `${section.content.slice(0, 600).trim()}…`
                : section.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
