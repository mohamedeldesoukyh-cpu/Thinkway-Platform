"use client";

import dynamic from "next/dynamic";
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

import {
  getCampaignFacts,
  resolveInfluencerEstimateCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { CAMPAIGN_STUDIO_COPY } from "../constants/copy";
import { STUDIO_REF_AGENT_PILLS, STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import "../styles/campaign-studio-ref.css";
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
import { StudioStepBar, studioPhaseDomId } from "./studio-step-bar";
import { StudioRefModeProvider } from "../hooks/use-studio-ref-mode";
import {
  STUDIO_REF_SCROLL_OFFSET,
  useStudioSectionNav,
} from "../hooks/use-studio-section-nav";
import { getStudioDraft, outdatedSectionsForDraft } from "../services/studio-draft";
import { getSectionCardDescription } from "../services/section-card-description";
import { useCampaignStudio } from "../hooks/use-campaign-studio";
import type {
  CampaignStudioInput,
  CampaignStudioLayoutMode,
  CampaignStudioViewportMode,
} from "../types/campaign-studio";
import { getSectionLayout } from "./sections";
import { groupSectionsByStoryPhase } from "../constants/studio-layout";
import {
  resolvePresentationCompletion,
  resolveStudioCampaignDisplayTitle,
} from "../services/section-data-resolver";
import { StudioSectionCard } from "./campaign-studio-sections";

const ActionCardRenderer = dynamic(
  () =>
    import("@/features/ai-workspace/components/action-card-renderer").then((m) => ({
      default: m.ActionCardRenderer,
    })),
  { ssr: false }
);

const BudgetDecisionOverlay = dynamic(
  () =>
    import("./decision-overlays/budget-decision-overlay").then((m) => ({
      default: m.BudgetDecisionOverlay,
    })),
  { ssr: false }
);

const VendorDecisionOverlay = dynamic(
  () =>
    import("./decision-overlays/vendor-decision-overlay").then((m) => ({
      default: m.VendorDecisionOverlay,
    })),
  { ssr: false }
);

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
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
  decisionMode?: CampaignStudioDecisionMode;
  className?: string;
  /** Presentation vs Decision — shown when workflow supports decision mode. */
  studioModeToggle?: ReactNode;
  /** panel = fixed-height internal scroll; chat = expand in AI thread (single scroll). */
  layoutMode?: CampaignStudioLayoutMode;
  /** Full-viewport Campaign Mode — wider, zoomed-out canvas. */
  viewportMode?: CampaignStudioViewportMode;
  /** Scroll container for section nav when layoutMode is chat (the chat thread element). */
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
  scrollContainer = null,
  ...input
}: CampaignStudioProps) {
  const studio = useCampaignStudio(input);
  const [navOpen, setNavOpen] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const isChatLayout = layoutMode === "chat";
  const isDesktopViewport = viewportMode === "desktop" && !isChatLayout;

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
    layoutMode,
    isDesktopViewport
  );

  const activePhaseId = useMemo(
    () =>
      storyPhases.find((phase) => phase.sections.some((section) => section.id === activeId))
        ?.id ??
      storyPhases[0]?.id ??
      "",
    [storyPhases, activeId]
  );

  const scrollToPhase = useCallback(
    (phaseId: string) => {
      const root = navScrollRoot;
      const target = document.getElementById(
        studioPhaseDomId(phaseId, isDesktopViewport ? "ref" : "default")
      );
      if (!root || !target) return;

      const offset = isDesktopViewport ? STUDIO_REF_SCROLL_OFFSET : 0;
      const rootRect = root.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      root.scrollTo({
        top: Math.max(0, root.scrollTop + targetRect.top - rootRect.top - offset),
        behavior: "smooth",
      });
    },
    [navScrollRoot, isDesktopViewport]
  );

  const completeSectionCount = useMemo(
    () => studio?.sections.filter((s) => s.status === "complete").length ?? 0,
    [studio?.sections]
  );

  const campaignDisplayTitle = useMemo(
    () => resolveStudioCampaignDisplayTitle(studio?.campaignObject),
    [studio?.campaignObject]
  );

  const readinessPercent = useMemo(() => {
    if (!studio) return 0;
    if (studio.campaignObject) {
      return resolvePresentationCompletion(studio.campaignObject).completionPercent;
    }
    if (studio.sections.length > 0) {
      return Math.round((completeSectionCount / studio.sections.length) * 100);
    }
    return studio.progressPercent;
  }, [studio, completeSectionCount]);

  const handleNavigate = useCallback(
    (sectionId: string) => {
      scrollToSection(sectionId);
      setNavOpen(false);
    },
    [scrollToSection]
  );

  if (!studio) return null;

  const resolveAgentStatus = (keywords: readonly string[]) => {
    const match = studio.specialists.find((specialist) => {
      const haystack = `${specialist.label} ${specialist.id}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    });
    return match?.status ?? "complete";
  };

  const sidebarProps = {
    phases: storyPhases,
    clientName,
    workflowName: studio.workflowName,
    progressPercent: readinessPercent,
    currentStep: studio.currentStep,
    totalSteps: studio.totalSteps,
    completeSectionCount,
    totalSectionCount: studio.sections.length,
    activeSectionId: activeId,
    onNavigate: handleNavigate,
    layoutMode,
  };

  const phaseDomVariant = isDesktopViewport ? ("ref" as const) : ("default" as const);

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

      {studio.inferredFields && studio.inferredFields.length > 0 ? (
        <div className={isDesktopViewport ? "cs-inferred-bar" : undefined}>
          <p
            className={cn(
              isDesktopViewport
                ? cn(STUDIO_REF_CLASSES.fieldLbl, "!mb-0.5")
                : cn(STUDIO_CLASSES.label, STUDIO_CLASSES.primaryText)
            )}
          >
            {CAMPAIGN_STUDIO_COPY.autoInferred}
          </p>
          <p
            className={cn(
              isDesktopViewport ? STUDIO_REF_CLASSES.fieldVal : "mt-0.5 break-words text-xs text-[#3f4757]"
            )}
          >
            {studio.inferredFields.join(" · ")}
          </p>
        </div>
      ) : null}

      {isDesktopViewport ? null : (
        <div className={cn("flex flex-wrap gap-2")}>
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
      )}

      {studio.clarificationQuestion ? (
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

      <div className={isDesktopViewport ? undefined : isChatLayout ? undefined : "space-y-4"}>
        {storyPhases.map((phase, phaseIndex) => (
          <section
            key={phase.id}
            id={isDesktopViewport ? studioPhaseDomId(phase.id, phaseDomVariant) : undefined}
            className={cn(
              "min-w-0",
              isDesktopViewport ? STUDIO_REF_CLASSES.sectionStack : STUDIO_CLASSES.sectionEnter
            )}
          >
            <StudioPhaseBanner
              phaseNumber={phaseIndex + 1}
              label={phase.label}
              description={phase.description}
              compact={isDesktopViewport}
            />
            <div className={isDesktopViewport ? undefined : "space-y-4"}>
              {phase.sections.map((section) => {
                const Icon = SECTION_ICONS[section.id] ?? BarChart3Icon;
                const layout = getSectionLayout(section.id);
                return (
                  <StudioSectionCard
                    key={section.id}
                    section={section}
                    layoutMode={layoutMode}
                    viewportMode={viewportMode}
                    description={getSectionCardDescription(section.id, studio.campaignObject)}
                    campaignObject={studio.campaignObject}
                    layout={layout}
                    icon={Icon}
                    decisionMode={decisionMode}
                    conversationId={conversationId}
                    messageId={messageId}
                    onVendorDecisionsUpdated={onVendorDecisionsUpdated}
                    onSlateUpdated={onSlateUpdated}
                    studioDraft={studioDraft}
                    onStudioDraftUpdated={setDraftOverride}
                    appliedRemovedCreatorIds={appliedRemovedCreatorIds}
                    outdated={outdatedSections.has(section.id)}
                    forceMountBody={section.id === activeId}
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
    </>
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
                currentSectionTitle={activeTitle}
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
              <div className={STUDIO_REF_CLASSES.agentRow}>
                <span className={STUDIO_REF_CLASSES.agentRowLabel}>Active agents</span>
                {STUDIO_REF_AGENT_PILLS.map((agent) => {
                  const status = resolveAgentStatus(agent.keywords);
                  return (
                    <span
                      key={agent.initials}
                      className={cn(
                        STUDIO_REF_CLASSES.agentPill,
                        status === "working" && "working"
                      )}
                    >
                      <span
                        className={cn(
                          STUDIO_REF_CLASSES.agentAv,
                          status !== "complete" && status !== "working" && "pending"
                        )}
                      >
                        {agent.initials}
                      </span>
                      {agent.label}
                    </span>
                  );
                })}
              </div>
              <StudioStepBar
                phases={storyPhases}
                activePhaseId={activePhaseId}
                onNavigatePhase={scrollToPhase}
              />
            </div>
            <div className={STUDIO_REF_CLASSES.shell}>
              <StudioSectionSidebar {...sidebarProps} refMode />
              <StudioSectionSidebarSheet open={navOpen} onOpenChange={setNavOpen} refMode>
                <StudioSectionSidebar {...sidebarProps} embedded refMode />
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
            <StudioSectionSidebar {...sidebarProps} refMode={false} />
            <StudioSectionSidebarSheet open={navOpen} onOpenChange={setNavOpen} refMode={false}>
              <StudioSectionSidebar {...sidebarProps} embedded refMode={false} />
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
                  currentSectionTitle={activeTitle}
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
