"use client";

import { useMemo } from "react";
import { SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CampaignStudioHost } from "@/features/campaign-decision-workspace/components/campaign-studio-host";

import type { CopilotChangeLogEntry } from "@/features/campaign-intelligence/types/campaign-object";

import type { AiActionCard, AiMessage } from "../types";
import { CampaignHistoryPanel } from "./campaign-history-panel";
import { findLatestStudioMessage } from "./campaign-studio-panel-utils";
import { toWorkflowDisplayMetadata } from "./workflow-dashboard-panel";

export { findLatestStudioMessage };

type CampaignStudioPanelProps = {
  message: AiMessage;
  conversationId?: string;
  onCardUpdated?: (messageId: string, cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    messageId: string,
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  /** Restore sends a Copilot message through the normal chat flow. */
  onSendMessage?: (message: string) => void;
  /** Studio card id currently selected as the "this section" edit target. */
  focusedSectionId?: string;
  onFocusSection?: (sectionId?: string) => void;
  /** "main" fills the whole workspace (Campaign Mode); "side" is the bordered right pane. */
  variant?: "main" | "side";
};

/** Sections the Copilot can author — clicking one sets "this section" for the next message. */
const FOCUSABLE_SECTIONS: Array<{ id: string; label: string }> = [
  { id: "executive-strategy", label: "Strategy" },
  { id: "executive-summary", label: "Exec summary" },
  { id: "creative-concepts", label: "Concepts" },
  { id: "kpi-forecast", label: "KPIs" },
  { id: "risk-analysis", label: "Risks" },
];

/**
 * The persistent right-pane Campaign Studio. It binds to the latest campaign
 * object in the conversation, so Copilot edits (which append a fresh studio
 * message) update this panel in place while the chat on the left stays clean.
 */
export function CampaignStudioPanel({
  message,
  conversationId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onSendMessage,
  focusedSectionId,
  onFocusSection,
  variant = "side",
}: CampaignStudioPanelProps) {
  const display = useMemo(
    () => toWorkflowDisplayMetadata(message.metadata),
    [message.id, message.metadata]
  );

  if (!display.campaignObject) return null;

  const campaignObjectId = display.campaignObject.id;
  const changeLog = (display.campaignObject.meta.copilotChangeLog ?? []) as CopilotChangeLogEntry[];

  const progressPercent = display.totalSteps
    ? Math.round((display.completedTasks.length / display.totalSteps) * 100)
    : 100;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        variant === "side" ? "border-l border-border/80 bg-muted/20" : "bg-background"
      )}
    >
      <div className="border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-[#1D9E75]" />
          <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
            Live Campaign Studio
          </p>
        </div>
        {onFocusSection ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Edit target:</span>
            {FOCUSABLE_SECTIONS.map((s) => {
              const active = focusedSectionId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={
                    active
                      ? "rounded-full border border-[#1D9E75] bg-[#1D9E75]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9E75]"
                      : "rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-[#1D9E75]/50 hover:text-foreground"
                  }
                  aria-pressed={active}
                  onClick={() => onFocusSection(active ? undefined : s.id)}
                  title={active ? `"this section" = ${s.label} (click to clear)` : `Set "this section" to ${s.label}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <CampaignStudioHost
          workflowId={display.workflowId}
          workflowName={display.workflowName}
          workflowStatus={display.status}
          currentStep={display.currentStep}
          totalSteps={display.totalSteps}
          progressPercent={progressPercent}
          campaignObject={display.campaignObject}
          summarySections={display.summarySections}
          clarificationQuestion={display.clarificationQuestion}
          completedTasks={display.completedTasks}
          pendingTasks={display.pendingTasks}
          inferredFields={message.metadata.inferredFields as string[] | undefined}
          actionCards={message.metadata.actionCards as AiActionCard[] | undefined}
          conversationId={conversationId}
          messageId={message.id}
          onCardUpdated={(cardId, status) => onCardUpdated?.(message.id, cardId, status)}
          onVendorDecisionsUpdated={(decisions) =>
            onVendorDecisionsUpdated?.(message.id, decisions)
          }
        />
      </div>
      {campaignObjectId ? (
        <CampaignHistoryPanel
          campaignObjectId={campaignObjectId}
          changeLog={changeLog}
          onRestore={
            onSendMessage ? (version) => onSendMessage(`Restore version ${version}`) : undefined
          }
        />
      ) : null}
    </div>
  );
}
