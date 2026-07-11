"use client";

import { useMemo, useState, type ReactNode } from "react";
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

import { CampaignProposalExportActions } from "./campaign-proposal-export-actions";
import { StudioDraftBar } from "./studio-draft-bar";
import { getStudioDraft, outdatedSectionsForDraft } from "../services/studio-draft";
import { useCampaignStudio } from "../hooks/use-campaign-studio";
import type { CampaignStudioInput } from "../types/campaign-studio";
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
};

export function CampaignStudio({
  conversationId,
  messageId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  decisionMode,
  className,
  studioModeToggle,
  ...input
}: CampaignStudioProps) {
  const studio = useCampaignStudio(input);

  // Draft edits (remove/replace/add creators) stay staged until Apply All Updates.
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

  if (!studio) return null;

  return (
    <div
      className={cn(
        "w-full min-w-0 space-y-4 overflow-hidden rounded-[22px] border border-[#0B0F1A]/6 bg-white p-4 shadow-[0_10px_26px_rgba(0,87,255,0.08),0_2px_6px_rgba(6,8,16,0.05)] dark:border-border dark:bg-background sm:p-5",
        className
      )}
    >
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#7C3AED] to-[#0057FF] shadow-[0_8px_18px_rgba(124,58,237,0.35)]">
              <ZapIcon className="size-[18px] fill-white text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.6px] text-[#7C3AED] uppercase dark:text-violet-400">
                {CAMPAIGN_STUDIO_COPY.studioLabel}
              </p>
              <h2 className="text-[17px] font-extrabold tracking-[-0.4px] text-foreground">
                {studio.workflowName}
              </h2>
            </div>
            {clientName ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#060810] py-[3px] pr-2.5 pl-1.5 text-xs font-bold text-white dark:border dark:border-white/15">
                <span className="flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-[#060810]">
                  {clientName.trim().charAt(0).toUpperCase()}
                </span>
                {clientName}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {studio.campaignObject?.id && studio.progressPercent >= 100 ? (
              <CampaignProposalExportActions
                campaignObjectId={studio.campaignObject.id}
                conversationId={conversationId}
              />
            ) : null}
            {studioModeToggle}
            <div className="text-right">
              <p
                className="text-[11px] font-semibold text-muted-foreground"
                id="studio-progress-label"
              >
                Step {studio.currentStep}/{studio.totalSteps}
              </p>
              <p className="text-[15px] font-extrabold text-[#0057FF]" aria-hidden>
                {studio.progressPercent}%
              </p>
            </div>
          </div>
        </div>

        <div
          className="h-1 overflow-hidden rounded-full bg-[#E4E9F5] dark:bg-muted"
          role="progressbar"
          aria-labelledby="studio-progress-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={studio.progressPercent}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#0057FF] to-[#3D8BFF] transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${studio.progressPercent}%` }}
          />
        </div>

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
          <div className="rounded-lg border border-brand-product/30 bg-brand-product/5 px-3 py-2">
            <p className={cn(STUDIO_CLASSES.label, STUDIO_CLASSES.primaryText)}>
              {CAMPAIGN_STUDIO_COPY.autoInferred}
            </p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {studio.inferredFields.join(" · ")}
            </p>
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2.5">
        {studio.specialists.map((specialist) => (
          <div
            key={specialist.id}
            title={specialist.currentTask ?? undefined}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-full border px-[13px] py-1.5 text-xs font-semibold shadow-[0_1px_2px_rgba(6,8,16,0.05)] transition-colors motion-reduce:transition-none",
              specialist.status === "working"
                ? "border-violet-300 bg-violet-50/80 text-foreground dark:border-violet-800 dark:bg-violet-950/30"
                : "border-[#0B0F1A]/8 bg-white text-foreground dark:border-border dark:bg-background"
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
          <p className="mt-1 break-words text-sm leading-relaxed">{studio.clarificationQuestion}</p>
        </div>
      ) : null}

      <div className="min-w-0 space-y-5">
        {groupSectionsByStoryPhase(studio.sections).map((phase) => (
          <section key={phase.id} className={cn("min-w-0 space-y-3", STUDIO_CLASSES.sectionEnter)}>
            <div className="flex items-baseline gap-2 border-b border-border/60 pb-1.5">
              <h3 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                {phase.label}
              </h3>
              <p className="truncate text-[11px] text-muted-foreground/70">
                {phase.description}
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
              {phase.sections.map((section) => {
                const Icon = SECTION_ICONS[section.id] ?? BarChart3Icon;
                const layout = getSectionLayout(section.id);
                const spansFull = layout === "full" || layout === "dashboard";
                return (
                  <div
                    key={section.id}
                    className={cn(
                      "flex min-w-0 flex-col",
                      spansFull && "lg:col-span-2",
                      layout === "pair" && "lg:min-h-[18rem]"
                    )}
                  >
                    <StudioSectionCard
                      section={section}
                      campaignObject={studio.campaignObject}
                      layout={layout}
                      icon={Icon}
                      className="h-full flex-1"
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
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {studio.actionCards?.length && conversationId && messageId ? (
        <div className="border-t border-border pt-3">
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
  );
}
