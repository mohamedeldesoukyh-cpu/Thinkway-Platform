"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayersIcon, LayoutDashboardIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CampaignStudioHost } from "@/features/campaign-decision-workspace/components/campaign-studio-host";
import { GenerateCampaignLauncher } from "@/features/campaign-plan/components/generate-campaign-launcher";
import { GenerateQuotationLauncher } from "@/features/campaign-plan/components/generate-quotation-launcher";
import { CampaignBriefCard } from "@/features/campaign-studio/components/sections/campaign-brief-card";
import { hasCampaignBriefText } from "@/features/campaign-outputs/brief-media-plan-schedule";
import { StudioOutputsView } from "@/features/campaign-outputs/components/studio-outputs-view";

import type { CopilotChangeLogEntry } from "@/features/campaign-intelligence/types/campaign-object";
import type { CampaignStudioInput } from "@/features/campaign-studio/types/campaign-studio";

import type { AiActionCard, AiMessage, ConversationListItem } from "../types";
import { logStudioBindEvent } from "../debug/studio-bind-logger";
import { CampaignHistoryPanel } from "./campaign-history-panel";
import { findLatestStudioMessage } from "./campaign-studio-panel-utils";
import { StudioConversationControls } from "./studio-conversation-controls";
import { toWorkflowDisplayMetadata } from "./workflow-dashboard-panel";

type StudioView = "studio" | "outputs" | "director";

const STUDIO_TABS: Array<{ id: StudioView; label: string; icon: typeof LayoutDashboardIcon }> = [
  { id: "studio", label: "Studio", icon: LayoutDashboardIcon },
  { id: "outputs", label: "Outputs", icon: LayersIcon },
  { id: "director", label: "Director", icon: SparklesIcon },
];

export { findLatestStudioMessage };

type CampaignStudioPanelProps = {
  message?: AiMessage;
  /** Live workflow input while the studio object is still being generated. */
  streamingInput?: CampaignStudioInput;
  conversationId?: string;
  onCardUpdated?: (messageId: string, cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    messageId: string,
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onSlateUpdated?: (messageId: string, campaignObject: Record<string, unknown>) => void;
  /** Restore sends a Copilot message through the normal chat flow. */
  onSendMessage?: (message: string) => void;
  /** True while the Copilot is streaming a response. */
  isCopilotStreaming?: boolean;
  /** Studio card id currently selected as the "this section" edit target. */
  focusedSectionId?: string;
  onFocusSection?: (sectionId?: string) => void;
  /** "main" fills the whole workspace (Campaign Mode); "side" is the bordered right pane. */
  variant?: "main" | "side";
  /** Deep-link target: open directly to Studio / Outputs / Director. */
  initialView?: StudioView;
  /** Campaign Mode — switch chats without leaving the Studio shell. */
  conversations?: ConversationListItem[];
  conversationsLoading?: boolean;
  conversationsError?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onRefreshConversations?: () => void;
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
  streamingInput,
  conversationId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onSlateUpdated,
  onSendMessage,
  isCopilotStreaming,
  focusedSectionId,
  onFocusSection,
  variant = "side",
  initialView,
  conversations,
  conversationsLoading,
  conversationsError,
  onSelectConversation,
  onNewChat,
  onRefreshConversations,
}: CampaignStudioPanelProps) {
  const display = useMemo(
    () => (message ? toWorkflowDisplayMetadata(message.metadata) : null),
    [message?.id, message?.metadata]
  );
  const [view, setView] = useState<StudioView>(initialView ?? "studio");
  const noopSendMessage = useCallback(() => {}, []);
  const sendMessage = onSendMessage ?? noopSendMessage;

  const hasCampaignObject = Boolean(display?.campaignObject);

  // Diagnostics: which object is the Studio actually rendering right now?
  useEffect(() => {
    const sections = display?.campaignObject
      ? Object.entries(
          display.campaignObject.sections as Record<string, { status?: string }>
        )
      : null;
    logStudioBindEvent("panel render", {
      boundMessageId: message?.id ?? null,
      streamingInputActive: Boolean(streamingInput) && !hasCampaignObject,
      hasCampaignObject,
      workflowStatus: display?.status ?? streamingInput?.workflowStatus ?? null,
      completedTasksLength:
        display?.completedTasks?.length ?? streamingInput?.completedTasks?.length ?? 0,
      campaignObjectSectionCount: sections?.length ?? null,
      sectionStatuses: sections
        ? sections.map(([key, section]) => `${key}:${section?.status ?? "?"}`).join(" ")
        : null,
      willRenderNothing: !hasCampaignObject && !streamingInput,
    });
  }, [message?.id, display, streamingInput, hasCampaignObject]);

  if (!hasCampaignObject && !streamingInput) return null;

  const campaignObjectId = display?.campaignObject?.id;
  const changeLog = (display?.campaignObject?.meta.copilotChangeLog ?? []) as CopilotChangeLogEntry[];

  const progressPercent = display?.totalSteps
    ? Math.round((display.completedTasks.length / display.totalSteps) * 100)
    : streamingInput?.progressPercent ?? 0;

  const studioHostProps: CampaignStudioInput & {
    conversationId?: string;
    messageId?: string;
  } = hasCampaignObject
    ? {
        workflowId: display!.workflowId,
        workflowName: display!.workflowName,
        workflowStatus: display!.status,
        currentStep: display!.currentStep,
        totalSteps: display!.totalSteps,
        progressPercent,
        campaignObject: display!.campaignObject,
        summarySections: display!.summarySections,
        clarificationQuestion: display!.clarificationQuestion,
        completedTasks: display!.completedTasks,
        pendingTasks: display!.pendingTasks,
        inferredFields: message?.metadata.inferredFields as string[] | undefined,
        actionCards: message?.metadata.actionCards as AiActionCard[] | undefined,
        conversationId,
        messageId: message?.id,
      }
    : {
        ...streamingInput!,
        conversationId,
      };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        variant === "side" ? "border-l border-border/80 bg-muted/20" : "bg-background",
        variant === "main" && "studio-desktop-zoom"
      )}
    >
      {/* Workspace navigation — Studio / Outputs Center / Director, all reading the
          same Campaign Object. Integrated into the panel, not a separate app shell. */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border/60",
          variant === "main" ? "px-2 py-1" : "px-3 py-2"
        )}
      >
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {STUDIO_TABS.map((tab) => {
            const active = view === tab.id;
            const Icon = tab.icon;
            const disabled = !hasCampaignObject && tab.id !== "studio";
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => setView(tab.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md font-semibold transition-colors",
                  variant === "main" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12px]",
                  active
                    ? "bg-[#1D9E75]/10 text-[#1D9E75]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  disabled && "pointer-events-none opacity-40"
                )}
              >
                <Icon className={variant === "main" ? "size-3" : "size-3.5"} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {variant === "main" && onNewChat && onSelectConversation && conversations ? (
          <StudioConversationControls
            conversations={conversations}
            loading={conversationsLoading}
            error={conversationsError}
            activeId={conversationId}
            onSelect={onSelectConversation}
            onNewChat={onNewChat}
            onRefresh={onRefreshConversations}
          />
        ) : null}
      </div>

      {view === "studio" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {onFocusSection ? (
            <div
              className={cn(
                "border-b border-border/60",
                variant === "main" ? "px-2 py-1" : "px-4 py-2.5"
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
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
            </div>
          ) : null}
          <div
            className={cn(
              "min-h-0 flex-1",
              variant === "main" ? "flex flex-col overflow-hidden" : "overflow-y-auto p-3 sm:p-4"
            )}
          >
            <CampaignStudioHost
              {...studioHostProps}
              layoutMode="panel"
              viewportMode={variant === "main" ? "desktop" : "default"}
              className={variant === "main" ? "flex min-h-0 flex-1 flex-col" : undefined}
              onCardUpdated={
                message
                  ? (cardId, status) => onCardUpdated?.(message.id, cardId, status)
                  : undefined
              }
              onVendorDecisionsUpdated={
                message
                  ? (decisions) => onVendorDecisionsUpdated?.(message.id, decisions)
                  : undefined
              }
              onSlateUpdated={
                message
                  ? (campaignObject) => onSlateUpdated?.(message.id, campaignObject)
                  : undefined
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
      ) : view === "outputs" && hasCampaignObject ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 space-y-2 border-b border-border/60 px-3 py-2">
            {!hasCampaignBriefText(display!.campaignObject!) ? (
              <div className="space-y-2 rounded-lg border border-[#1D9E75]/25 bg-[#1D9E75]/5 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-foreground">
                    Add the client brief to refine scheduling and strategy
                  </p>
                  <button
                    type="button"
                    onClick={() => setView("studio")}
                    className="text-[10px] font-bold text-[#1D9E75] underline-offset-2 hover:underline"
                  >
                    Open in Studio → The Brief
                  </button>
                </div>
                <CampaignBriefCard
                  campaignObject={display!.campaignObject!}
                  conversationId={conversationId}
                  messageId={message?.id}
                  onBriefApplied={
                    message
                      ? (campaignObject) => onSlateUpdated?.(message.id, campaignObject)
                      : undefined
                  }
                />
              </div>
            ) : (
              <CampaignBriefCard
                campaignObject={display!.campaignObject!}
                conversationId={conversationId}
                messageId={message?.id}
                onBriefApplied={
                  message
                    ? (campaignObject) => onSlateUpdated?.(message.id, campaignObject)
                    : undefined
                }
              />
            )}
            <div className="overflow-hidden rounded-lg border border-border bg-background divide-y divide-border md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
              <GenerateCampaignLauncher
                campaignObject={display!.campaignObject!}
                conversationId={conversationId}
                variant="compact"
              />
              <GenerateQuotationLauncher
                campaignObject={display!.campaignObject!}
                conversationId={conversationId}
                variant="compact"
                showLifecycleHint={false}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <StudioOutputsView
              campaignObject={display!.campaignObject!}
              conversationId={conversationId}
              mode="outputs"
              onSendMessage={sendMessage}
              isCopilotStreaming={isCopilotStreaming}
            />
          </div>
        </div>
      ) : hasCampaignObject ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <StudioOutputsView
            campaignObject={display!.campaignObject!}
            mode="director"
            onSendMessage={sendMessage}
          />
        </div>
      ) : null}
    </div>
  );
}
