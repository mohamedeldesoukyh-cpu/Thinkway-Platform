"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayersIcon, LayoutDashboardIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { OUTPUTS_CLASSES } from "@/features/campaign-outputs/constants/outputs-center-tokens";
import { STUDIO_REF_CLASSES } from "@/features/campaign-studio/constants/campaign-studio-ref-tokens";
import "@/features/campaign-studio/styles/campaign-studio-ref.css";
import { OutputsPlanReadinessBanner } from "@/features/campaign-outputs/components/outputs-plan-readiness-banner";
import { CampaignStudioHost } from "@/features/campaign-decision-workspace/components/campaign-studio-host";
import { GenerateCampaignLauncher } from "@/features/campaign-plan/components/generate-campaign-launcher";
import { GenerateQuotationLauncher } from "@/features/campaign-plan/components/generate-quotation-launcher";

const StudioOutputsView = dynamic(
  () =>
    import("@/features/campaign-outputs/components/studio-outputs-view").then((m) => ({
      default: m.StudioOutputsView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading outputs…
      </div>
    ),
  }
);

import type { CopilotChangeLogEntry } from "@/features/campaign-intelligence/types/campaign-object";
import type { CampaignStudioInput } from "@/features/campaign-studio/types/campaign-studio";

import type { AiActionCard, AiMessage } from "../types";
import { logStudioBindEvent } from "../debug/studio-bind-logger";
import { CampaignHistoryPanel } from "./campaign-history-panel";
import {
  findLatestStudioMessage,
  studioCampaignObjectBindKey,
} from "./campaign-studio-panel-utils";
import { mergeActionCards } from "@/features/campaign-studio/services/studio-search-pool";
import { StudioConversationControls } from "./studio-conversation-controls";
import { toWorkflowDisplayMetadata } from "./workflow-dashboard-panel";
import { resolvePresentationCompletion } from "@/features/campaign-studio/services/section-data-resolver";

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
  /** Creator Match cards from earlier turns — Copilot replies often omit them. */
  threadActionCards?: AiActionCard[];
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
  /** Copilot dock expanded — show edit-target bar for section focus. */
  copilotOpen?: boolean;
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
  threadActionCards,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onSlateUpdated,
  onSendMessage,
  isCopilotStreaming,
  focusedSectionId,
  onFocusSection,
  variant = "side",
  initialView,
  copilotOpen = false,
}: CampaignStudioPanelProps) {
  const display = useMemo(
    () => (message ? toWorkflowDisplayMetadata(message.metadata) : null),
    [message?.id, message?.metadata]
  );
  // Do not memoize on id/updatedAt alone — timeline / Media Plan patches can share a timestamp.
  const campaignBindKey = studioCampaignObjectBindKey(message?.id, display?.campaignObject);
  const boundCampaignObject = display?.campaignObject;
  const hasCampaignObject = Boolean(boundCampaignObject);
  const [view, setView] = useState<StudioView>(initialView ?? "studio");
  const navigateOutputKind =
    typeof message?.metadata?.outputNavigate === "string"
      ? message.metadata.outputNavigate
      : undefined;

  // After a Copilot timeline/output edit, open Outputs so the calendar is visible.
  useEffect(() => {
    if (!navigateOutputKind || !hasCampaignObject) return;
    setView("outputs");
  }, [message?.id, navigateOutputKind, hasCampaignObject, campaignBindKey]);
  const noopSendMessage = useCallback(() => {}, []);
  const sendMessage = onSendMessage ?? noopSendMessage;

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

  const campaignObjectId = boundCampaignObject?.id;
  const changeLog = (boundCampaignObject?.meta.copilotChangeLog ?? []) as CopilotChangeLogEntry[];

  const progressPercent = boundCampaignObject
    ? resolvePresentationCompletion(boundCampaignObject).completionPercent
    : display?.totalSteps
      ? Math.round((display.completedTasks.length / display.totalSteps) * 100)
      : streamingInput?.progressPercent ?? 0;

  const showEditTargetBar =
    Boolean(onFocusSection) &&
    (variant !== "main" || copilotOpen || Boolean(focusedSectionId));

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
        campaignObject: boundCampaignObject!,
        summarySections: display!.summarySections,
        clarificationQuestion: display!.clarificationQuestion,
        completedTasks: display!.completedTasks,
        pendingTasks: display!.pendingTasks,
        inferredFields: message?.metadata.inferredFields as string[] | undefined,
        actionCards: mergeActionCards(
          threadActionCards,
          message?.metadata.actionCards as AiActionCard[] | undefined
        ),
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
        variant === "side" ? "border-l border-border/80 bg-muted/20" : STUDIO_REF_CLASSES.scope
      )}
    >
      {/* Workspace navigation — Studio / Outputs Center / Director */}
      <div
        className={cn(
          variant === "main" ? STUDIO_REF_CLASSES.subnav : "flex h-[46px] shrink-0 items-center justify-between gap-2 border-b border-[#DFE4EE] bg-white px-4 dark:border-border dark:bg-background"
        )}
      >
        <div className={variant === "main" ? STUDIO_REF_CLASSES.subtabs : "flex min-w-0 items-center gap-1 overflow-x-auto"}>
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
                  variant === "main"
                    ? cn(STUDIO_REF_CLASSES.subtab, active && STUDIO_REF_CLASSES.subtabActive)
                    : cn(
                        "mr-[22px] inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1.5 pb-[13px] pt-[13px] text-[13px] font-semibold transition-colors",
                        active
                          ? "border-[#0057FF] text-[#0B0F1A]"
                          : "border-transparent text-[#6B7280] hover:text-[#0B0F1A]",
                        disabled && "pointer-events-none opacity-40"
                      )
                )}
              >
                <Icon aria-hidden className={variant === "main" ? undefined : "size-3.5"} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {variant === "main" ? (
          <div className={STUDIO_REF_CLASSES.subnavActions}>
            <StudioConversationControls activeId={conversationId} refMode />
          </div>
        ) : null}
      </div>

      {view === "studio" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showEditTargetBar ? (
            <div
              className={cn(
                variant === "main" ? STUDIO_REF_CLASSES.editTargetBar : "border-b border-border/60 px-4 py-2.5"
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-[#6B7280]">Edit target:</span>
                {FOCUSABLE_SECTIONS.map((s) => {
                  const active = focusedSectionId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={cn(
                        variant === "main"
                          ? cn(
                              STUDIO_REF_CLASSES.editTargetPill,
                              active && STUDIO_REF_CLASSES.editTargetPillActive
                            )
                          : active
                            ? "rounded-full border border-[#1D9E75] bg-[#1D9E75]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9E75]"
                            : "rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-[#1D9E75]/50 hover:text-foreground"
                      )}
                      aria-pressed={active}
                      onClick={() => onFocusSection?.(active ? undefined : s.id)}
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
          <StudioOutputsView
            key={campaignBindKey}
            campaignObject={boundCampaignObject!}
            conversationId={conversationId}
            messageId={message?.id}
            onBriefApplied={
              message
                ? (campaignObject) => onSlateUpdated?.(message.id, campaignObject)
                : undefined
            }
            mode="outputs"
            onSendMessage={sendMessage}
            isCopilotStreaming={isCopilotStreaming}
            navigateOutputKind={navigateOutputKind}
            planReadinessBanner={
              <OutputsPlanReadinessBanner
                campaignObject={boundCampaignObject!}
                conversationId={conversationId}
              />
            }
            upNextCards={
              <div className={OUTPUTS_CLASSES.upnextGrid}>
                <GenerateCampaignLauncher
                  campaignObject={boundCampaignObject!}
                  conversationId={conversationId}
                  variant="compact"
                  className={OUTPUTS_CLASSES.upnextCard}
                  showLifecycleHint={false}
                />
                <GenerateQuotationLauncher
                  campaignObject={boundCampaignObject!}
                  conversationId={conversationId}
                  variant="compact"
                  showLifecycleHint={false}
                  className={OUTPUTS_CLASSES.upnextCard}
                />
              </div>
            }
          />
        </div>
      ) : hasCampaignObject ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <StudioOutputsView
            campaignObject={boundCampaignObject!}
            mode="director"
            onSendMessage={sendMessage}
          />
        </div>
      ) : null}
    </div>
  );
}
