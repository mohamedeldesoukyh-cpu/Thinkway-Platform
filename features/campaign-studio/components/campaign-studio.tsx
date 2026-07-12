"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3Icon,
  CalendarIcon,
  CompassIcon,
  FileTextIcon,
  LayersIcon,
  LayoutGridIcon,
  LineChartIcon,
  LightbulbIcon,
  PresentationIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";

import { ActionCardRenderer } from "@/features/ai-workspace/components/action-card-renderer";
import {
  getCampaignFacts,
  resolveInfluencerEstimateCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { CAMPAIGN_STUDIO_COPY } from "../constants/copy";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import { cn } from "@/lib/utils";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";

import { StudioDraftBar } from "./studio-draft-bar";
import { StudioPhaseBanner } from "./studio-phase-banner";
import {
  StudioSectionSidebar,
  StudioSectionSidebarSheet,
} from "./studio-section-sidebar";
import { StudioTopChrome } from "./studio-top-chrome";
import { getStudioDraft, outdatedSectionsForDraft } from "../services/studio-draft";
import { getSectionCardDescription } from "../services/section-card-description";
import { useCampaignStudio } from "../hooks/use-campaign-studio";
import { useStudioSectionNav } from "../hooks/use-studio-section-nav";
import type { CampaignStudioInput, CampaignStudioLayoutMode } from "../types/campaign-studio";
import { getSectionLayout } from "./sections";
import { groupSectionsByStoryPhase } from "../constants/studio-layout";
import { StudioSectionCard } from "./campaign-studio-sections";
import { BudgetDecisionOverlay } from "./decision-overlays/budget-decision-overlay";
import { VendorDecisionOverlay } from "./decision-overlays/vendor-decision-overlay";

const SECTION_ICONS = {
  "campaign-summary": FileTextIcon,
  "executive-strategy": CompassIcon,
  "creator-discovery": SearchIcon,
  "creator-recommendations": UsersIcon,
  "budget-planner": WalletIcon,
  timeline: CalendarIcon,
  "kpi-forecast": LineChartIcon,
  "risk-analysis": ShieldAlertIcon,
  "creative-concepts": LightbulbIcon,
  "content-plan": LayoutGridIcon,
  "creator-mix": LayersIcon,
  "why-ai": SparklesIcon,
  "industry-benchmark": BarChart3Icon,
  "success-probability": TrendingUpIcon,
  "opportunity-finder": ZapIcon,
  "executive-summary": FileTextIcon,
  "presentation-status": PresentationIcon,
} as const;

type CampaignStudioProps = CampaignStudioInput & {
  conversationId?: string;
  messageId?: string;
  onCardUpdated?: (cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  decisionMode?: CampaignStudioDecisionMode;
  className?: string;
  /** Presentation vs Decision — shown when workflow supports decision mode. */
  studioModeToggle?: ReactNode;
  /** panel = fixed-height internal scroll; chat = expand in AI thread (single scroll). */
  layoutMode?: CampaignStudioLayoutMode;
  /** Scroll container for section nav when layoutMode is chat (the chat thread element). */
  scrollContainer?: HTMLElement | null;
};

export function CampaignStudio({
  conversationId,
  messageId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  decisionMode,
  className,
  studioModeToggle,
  layoutMode = "panel",
  scrollContainer = null,
  ...input
}: CampaignStudioProps) {
  const studio = useCampaignStudio(input);
  const [navOpen, setNavOpen] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const isChatLayout = layoutMode === "chat";

  const [draftOverride, setDraftOverride] = useState<StudioDraftState | null>(null);
  const [appliedRemovedCreatorIds, setAppliedRemovedCreatorIds] = useState<string[]>([]);
  const studioDraft = draftOverride ?? getStudioDraft(studio?.campaignObject);
  const outdatedSections = useMemo(
    () => outdatedSectionsForDraft(studioDraft),
    [studioDraft]
  );

  const actionCardHydration = useMemo(() => {
    const facts = getCampaignFacts(studio?.campaignObject);
    if (!facts) return undefined;
    return {
      preferredPlatforms: facts.platforms,
      currency: resolveInfluencerEstimateCurrency(facts),
    };
  }, [studio?.campaignObject?.meta.campaignFacts]);

  const clientName = getCampaignFacts(studio?.campaignObject)?.clientName;

  const storyPhases = useMemo(
    () => (studio ? groupSectionsByStoryPhase(studio.sections) : []),
    [studio?.sections]
  );

  const navSections = useMemo(
    () =>
      storyPhases.flatMap((phase) =>
        phase.sections.map((section) => ({ id: section.id, title: section.title }))
      ),
    [storyPhases]
  );

  const navScrollRoot = isChatLayout ? scrollContainer : scrollRoot;

  const { activeId, activeTitle, scrollToSection } = useStudioSectionNav(
    navSections,
    navScrollRoot,
    layoutMode
  );

  const completeSectionCount = useMemo(
    () => studio?.sections.filter((s) => s.status === "complete").length ?? 0,
    [studio?.sections]
  );

  const handleNavigate = useCallback(
    (sectionId: string) => {
      scrollToSection(sectionId);
      setNavOpen(false);
    },
    [scrollToSection]
  );

  if (!studio) return null;

  const sidebarProps = {
    phases: storyPhases,
    clientName,
    workflowName: studio.workflowName,
    progressPercent: studio.progressPercent,
    currentStep: studio.currentStep,
    totalSteps: studio.totalSteps,
    completeSectionCount,
    totalSectionCount: studio.sections.length,
    activeSectionId: activeId,
    onNavigate: handleNavigate,
    layoutMode,
  };

  return (
    <div
      className={cn(
        isChatLayout ? STUDIO_CLASSES.shellChat : STUDIO_CLASSES.shell,
        "min-w-0",
        className
      )}
    >
      <StudioSectionSidebar {...sidebarProps} />

      <StudioSectionSidebarSheet open={navOpen} onOpenChange={setNavOpen}>
        <StudioSectionSidebar {...sidebarProps} embedded />
      </StudioSectionSidebarSheet>

      <div className={isChatLayout ? STUDIO_CLASSES.mainColumnChat : STUDIO_CLASSES.mainColumn}>
        <div
          ref={isChatLayout ? undefined : setScrollRoot}
          className={isChatLayout ? STUDIO_CLASSES.scrollCanvasChat : STUDIO_CLASSES.scrollCanvas}
        >
          <StudioTopChrome
            workflowName={studio.workflowName}
            currentSectionTitle={activeTitle}
            campaignObjectId={studio.campaignObject?.id}
            conversationId={conversationId}
            progressPercent={studio.progressPercent}
            showExportActions={Boolean(
              studio.campaignObject?.id && studio.progressPercent >= 100
            )}
            studioModeToggle={studioModeToggle}
            onOpenNav={() => setNavOpen(true)}
            showNavToggle
            layoutMode={layoutMode}
          />

          <div
            className={
              isChatLayout ? STUDIO_CLASSES.canvasChat : STUDIO_CLASSES.canvas
            }
          >
          {conversationId && messageId && studioDraft.changes.length > 0 ? (
            <StudioDraftBar
              conversationId={conversationId}
              messageId={messageId}
              draft={studioDraft}
              onDraftUpdated={setDraftOverride}
              onCreatorsRemoved={(ids) =>
                setAppliedRemovedCreatorIds((prev) => [...prev, ...ids])
              }
            />
          ) : null}

          {studio.inferredFields && studio.inferredFields.length > 0 ? (
            <div className="rounded-xl border border-[#0057FF]/30 bg-[#0057FF]/5 px-3 py-2">
              <p className={cn(STUDIO_CLASSES.label, STUDIO_CLASSES.primaryText)}>
                {CAMPAIGN_STUDIO_COPY.autoInferred}
              </p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">
                {studio.inferredFields.join(" · ")}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {studio.specialists.map((specialist) => (
              <div
                key={specialist.id}
                title={specialist.currentTask ?? undefined}
                className={cn(
                  specialist.status === "working"
                    ? STUDIO_CLASSES.specialistPillWorking
                    : STUDIO_CLASSES.specialistPill
                )}
              >
                {specialist.status === "working" ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(124,58,237,0.15)] motion-safe:animate-pulse" />
                ) : specialist.status === "complete" ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-[#0C9D57] shadow-[0_0_0_3px_rgba(12,157,87,0.15)]" />
                ) : (
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                )}
                <span className="truncate">{specialist.label}</span>
                {specialist.status === "working" && specialist.currentTask ? (
                  <span className="hidden max-w-[180px] truncate text-[10px] font-normal text-muted-foreground sm:inline">
                    · {specialist.currentTask}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {studio.clarificationQuestion ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-[10px] font-bold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                {CAMPAIGN_STUDIO_COPY.inputRequired}
              </p>
              <p className="mt-1 break-words text-sm leading-relaxed">
                {studio.clarificationQuestion}
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            {storyPhases.map((phase, phaseIndex) => (
              <section key={phase.id} className={cn("min-w-0", STUDIO_CLASSES.sectionEnter)}>
                <StudioPhaseBanner
                  phaseNumber={phaseIndex + 1}
                  label={phase.label}
                  description={phase.description}
                />
                <div className="space-y-4">
                  {phase.sections.map((section) => {
                    const Icon = SECTION_ICONS[section.id] ?? BarChart3Icon;
                    const layout = getSectionLayout(section.id);
                    return (
                      <StudioSectionCard
                        key={section.id}
                        section={section}
                        layoutMode={layoutMode}
                        description={getSectionCardDescription(
                          section.id,
                          studio.campaignObject
                        )}
                        campaignObject={studio.campaignObject}
                        layout={layout}
                        icon={Icon}
                        decisionMode={decisionMode}
                        conversationId={conversationId}
                        messageId={messageId}
                        onVendorDecisionsUpdated={onVendorDecisionsUpdated}
                        studioDraft={studioDraft}
                        onStudioDraftUpdated={setDraftOverride}
                        appliedRemovedCreatorIds={appliedRemovedCreatorIds}
                        outdated={outdatedSections.has(section.id)}
                        sectionFooter={
                          decisionMode && section.id === "budget-planner" ? (
                            <BudgetDecisionOverlay decisionMode={decisionMode} />
                          ) : decisionMode && section.id === "creator-recommendations" ? (
                            <VendorDecisionOverlay decisionMode={decisionMode} />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {studio.actionCards?.length && conversationId && messageId ? (
            <div className="border-t border-[#0B0F1A]/8 pt-4 dark:border-border">
              <ActionCardRenderer
                cards={studio.actionCards}
                conversationId={conversationId}
                messageId={messageId}
                onCardUpdated={onCardUpdated}
                hydrationOptions={actionCardHydration}
                showApprovalHeader
              />
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
