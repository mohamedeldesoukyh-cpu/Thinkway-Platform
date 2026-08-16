"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

import {
  getCampaignFacts,
  resolveInfluencerEstimateCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { shouldShowIntakeClarification } from "../services/studio-intake-facts";
import { CAMPAIGN_STUDIO_COPY } from "../constants/copy";
import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import "../styles/campaign-studio-ref.css";
import { cn } from "@/lib/utils";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";

import { StudioDraftBar } from "./studio-draft-bar";
import { StudioFreshnessBanner } from "./studio-freshness-banner";
import { StudioSectionSidebarSheet } from "./studio-section-sidebar";
import { StudioTopChrome } from "./studio-top-chrome";
import { StudioWorkspaceNav } from "./studio-workspace-nav";
import { StudioWorkspaceStepBar } from "./studio-workspace-step-bar";
import { StudioWorkspaceScreen } from "./workspace/studio-workspace-screen";
import { StudioRefModeProvider } from "../hooks/use-studio-ref-mode";
import { getStudioDraft } from "../services/studio-draft";
import {
  outdatedStudioSections,
  studioFreshnessSummary,
} from "../services/studio-facts-freshness";
import {
  defaultStudioWorkspaceStep,
  resolveStudioWorkspaceSteps,
} from "../services/studio-workspace-status";
import type { StudioWorkspaceStepId } from "../constants/studio-workspace";
import { useCampaignStudio } from "../hooks/use-campaign-studio";
import type {
  CampaignStudioInput,
  CampaignStudioLayoutMode,
  CampaignStudioViewportMode,
} from "../types/campaign-studio";
import {
  resolvePresentationCompletion,
  resolveStudioCampaignDisplayTitle,
} from "../services/section-data-resolver";

const ActionCardRenderer = dynamic(
  () =>
    import("@/features/ai-workspace/components/action-card-renderer").then((m) => ({
      default: m.ActionCardRenderer,
    })),
  { ssr: false }
);

type CampaignStudioProps = CampaignStudioInput & {
  conversationId?: string;
  messageId?: string;
  onCardUpdated?: (cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
  decisionMode?: CampaignStudioDecisionMode;
  className?: string;
  studioModeToggle?: ReactNode;
  layoutMode?: CampaignStudioLayoutMode;
  viewportMode?: CampaignStudioViewportMode;
  scrollContainer?: HTMLElement | null;
};

export function CampaignStudio({
  conversationId,
  messageId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onSlateUpdated,
  decisionMode,
  className,
  studioModeToggle,
  layoutMode = "panel",
  viewportMode = "default",
  scrollContainer: _scrollContainer,
  ...input
}: CampaignStudioProps) {
  const studio = useCampaignStudio(input);
  const [navOpen, setNavOpen] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const isChatLayout = layoutMode === "chat";
  const isDesktopViewport = viewportMode === "desktop" && !isChatLayout;

  const [draftOverride, setDraftOverride] = useState<StudioDraftState | null>(null);
  const [appliedRemovedCreatorIds, setAppliedRemovedCreatorIds] = useState<string[]>([]);
  const [activeStepId, setActiveStepId] = useState<StudioWorkspaceStepId | null>(null);
  const studioDraft = draftOverride ?? getStudioDraft(studio?.campaignObject);
  const outdatedSections = useMemo(
    () => outdatedStudioSections(studio?.campaignObject, studioDraft),
    [studio?.campaignObject, studioDraft]
  );
  const freshness = useMemo(
    () => studioFreshnessSummary(studio?.campaignObject, outdatedSections),
    [studio?.campaignObject, outdatedSections]
  );

  const actionCardHydration = useMemo(() => {
    const facts = getCampaignFacts(studio?.campaignObject);
    if (!facts) return undefined;
    return {
      preferredPlatforms: facts.platforms,
      currency: resolveInfluencerEstimateCurrency(facts),
    };
  }, [studio?.campaignObject?.meta.campaignFacts]);

  const workspaceSteps = useMemo(
    () =>
      resolveStudioWorkspaceSteps({
        campaignObject: studio?.campaignObject,
        sections: studio?.sections ?? [],
        outdatedSections,
      }),
    [studio?.campaignObject, studio?.sections, outdatedSections]
  );

  const resolvedStepId = activeStepId ?? defaultStudioWorkspaceStep(workspaceSteps);
  const activeStep =
    workspaceSteps.find((step) => step.id === resolvedStepId) ?? workspaceSteps[0];

  const completeStepCount = workspaceSteps.filter((step) => step.complete).length;
  const campaignDisplayTitle = useMemo(
    () => resolveStudioCampaignDisplayTitle(studio?.campaignObject),
    [studio?.campaignObject]
  );

  const readinessPercent = useMemo(() => {
    if (!studio) return 0;
    if (studio.campaignObject) {
      return resolvePresentationCompletion(studio.campaignObject).completionPercent;
    }
    if (workspaceSteps.length > 0) {
      return Math.round((completeStepCount / workspaceSteps.length) * 100);
    }
    return studio.progressPercent;
  }, [studio, completeStepCount, workspaceSteps.length]);

  function goToStep(stepId: StudioWorkspaceStepId) {
    setActiveStepId(stepId);
    setNavOpen(false);
    scrollRoot?.scrollTo({ top: 0 });
  }

  const canvasActionCards = useMemo(() => {
    const cards = studio?.actionCards ?? [];
    if (activeStep?.id === "creators") return cards;
    return cards.filter((card) => card.type !== "creator_search");
  }, [studio?.actionCards, activeStep?.id]);

  if (!studio || !activeStep) return null;

  const renderCanvasBody = () => (
    <>
      {conversationId && messageId && studioDraft.changes.length > 0 ? (
        <StudioDraftBar
          conversationId={conversationId}
          messageId={messageId}
          draft={studioDraft}
          onDraftUpdated={setDraftOverride}
          onSlateApplied={(campaignObject) => {
            setDraftOverride(null);
            onSlateUpdated?.(campaignObject);
          }}
          onCreatorsRemoved={(ids) =>
            setAppliedRemovedCreatorIds((prev) => [...prev, ...ids])
          }
        />
      ) : null}

      {freshness.showBanner ? (
        <StudioFreshnessBanner
          summary={freshness}
          conversationId={conversationId}
          campaignObjectId={studio.campaignObject?.id}
          onCampaignObjectUpdated={onSlateUpdated}
        />
      ) : null}

      {shouldShowIntakeClarification(
        studio.clarificationQuestion,
        getCampaignFacts(studio.campaignObject)
      ) ? (
        <div
          className={cn(
            "rounded-lg border border-amber-300 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30",
            isDesktopViewport && "mb-3"
          )}
        >
          <p className="text-[10px] font-bold tracking-wide text-amber-800 uppercase dark:text-amber-300">
            {CAMPAIGN_STUDIO_COPY.inputRequired}
          </p>
          <p className="mt-1 break-words text-sm leading-relaxed">
            {studio.clarificationQuestion}
          </p>
        </div>
      ) : null}

      <StudioWorkspaceScreen
        step={activeStep}
        sections={studio.sections}
        campaignObject={studio.campaignObject}
        conversationId={conversationId}
        messageId={messageId}
        outdatedSections={outdatedSections}
        decisionMode={decisionMode}
        studioDraft={studioDraft}
        onStudioDraftUpdated={setDraftOverride}
        onVendorDecisionsUpdated={onVendorDecisionsUpdated}
        onSlateUpdated={onSlateUpdated}
        onNavigateStep={goToStep}
        appliedRemovedCreatorIds={appliedRemovedCreatorIds}
        layoutMode={layoutMode}
        viewportMode={viewportMode}
        workflowStatus={studio.workflowStatus}
        workflowProgressPercent={studio.progressPercent}
      />

      {canvasActionCards.length > 0 && conversationId && messageId ? (
        <div className="border-t border-[#0B0F1A]/8 pt-4 dark:border-border">
          <ActionCardRenderer
            cards={canvasActionCards}
            conversationId={conversationId}
            messageId={messageId}
            onCardUpdated={onCardUpdated}
            hydrationOptions={actionCardHydration}
            showApprovalHeader
          />
        </div>
      ) : null}
    </>
  );

  const nav = (
    <StudioWorkspaceNav
      steps={workspaceSteps}
      activeStepId={activeStep.id}
      onNavigate={goToStep}
      campaignTitle={campaignDisplayTitle}
    />
  );

  return (
    <StudioRefModeProvider enabled={isDesktopViewport}>
      <div
        className={cn(
          isChatLayout
            ? STUDIO_CLASSES.shellChat
            : isDesktopViewport
              ? cn(
                  STUDIO_REF_CLASSES.scope,
                  STUDIO_REF_CLASSES.studioDesktop,
                  "min-w-0"
                )
              : STUDIO_CLASSES.shell,
          !isChatLayout && className?.includes("h-full") && "!h-full max-h-none",
          !isDesktopViewport && "min-w-0",
          className
        )}
      >
        {isDesktopViewport ? (
          <>
            <div className={STUDIO_REF_CLASSES.chromeStack}>
              <StudioTopChrome
                displayTitle={campaignDisplayTitle}
                workflowName={studio.workflowName}
                currentSectionTitle={activeStep.label}
                campaignObjectId={studio.campaignObject?.id}
                conversationId={conversationId}
                progressPercent={readinessPercent}
                showExportActions={Boolean(
                  studio.campaignObject?.id && readinessPercent >= 100
                )}
                studioModeToggle={studioModeToggle}
                onOpenNav={() => setNavOpen(true)}
                showNavToggle={false}
                layoutMode={layoutMode}
                compact
                refMode
              />
              <StudioWorkspaceStepBar
                steps={workspaceSteps}
                activeStepId={activeStep.id}
                onNavigate={goToStep}
              />
            </div>
            <div className={STUDIO_REF_CLASSES.shell}>
              {nav}
              <StudioSectionSidebarSheet open={navOpen} onOpenChange={setNavOpen} refMode>
                <StudioWorkspaceNav
                  steps={workspaceSteps}
                  activeStepId={activeStep.id}
                  onNavigate={goToStep}
                  campaignTitle={campaignDisplayTitle}
                  embedded
                />
              </StudioSectionSidebarSheet>
              <div className={STUDIO_REF_CLASSES.mainColumn}>
                <div ref={setScrollRoot} className={STUDIO_REF_CLASSES.main}>
                  <div className={STUDIO_REF_CLASSES.content}>{renderCanvasBody()}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <StudioSectionSidebarSheet open={navOpen} onOpenChange={setNavOpen} refMode={false}>
              <StudioWorkspaceNav
                steps={workspaceSteps}
                activeStepId={activeStep.id}
                onNavigate={goToStep}
                campaignTitle={campaignDisplayTitle}
                embedded
              />
            </StudioSectionSidebarSheet>
            <div
              className={
                isChatLayout ? STUDIO_CLASSES.mainColumnChat : STUDIO_CLASSES.mainColumn
              }
            >
              <div
                ref={isChatLayout ? undefined : setScrollRoot}
                className={
                  isChatLayout ? STUDIO_CLASSES.scrollCanvasChat : STUDIO_CLASSES.scrollCanvas
                }
              >
                <StudioTopChrome
                  displayTitle={campaignDisplayTitle}
                  workflowName={studio.workflowName}
                  currentSectionTitle={activeStep.label}
                  campaignObjectId={studio.campaignObject?.id}
                  conversationId={conversationId}
                  progressPercent={readinessPercent}
                  showExportActions={Boolean(
                    studio.campaignObject?.id && readinessPercent >= 100
                  )}
                  studioModeToggle={studioModeToggle}
                  onOpenNav={() => setNavOpen(true)}
                  showNavToggle
                  layoutMode={layoutMode}
                />
                <div className="overflow-x-auto px-3 pb-1">
                  <StudioWorkspaceStepBar
                    steps={workspaceSteps}
                    activeStepId={activeStep.id}
                    onNavigate={goToStep}
                  />
                </div>
                <div
                  className={
                    isChatLayout ? STUDIO_CLASSES.canvasChat : STUDIO_CLASSES.canvas
                  }
                >
                  {renderCanvasBody()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </StudioRefModeProvider>
  );
}
