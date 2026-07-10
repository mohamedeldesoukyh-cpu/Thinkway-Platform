"use client";

import { useMemo, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";

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

  const actionCardHydration = useMemo(() => {
    const facts = getCampaignFacts(studio?.campaignObject);
    if (!facts) return undefined;
    return {
      preferredPlatforms: facts.platforms,
      currency: resolveInfluencerEstimateCurrency(facts),
    };
  }, [studio?.campaignObject?.meta.campaignFacts]);

  if (!studio) return null;

  return (
    <div
      className={cn(
        "w-full min-w-0 space-y-4 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-background to-[#fafbff] p-4 shadow-sm dark:to-background sm:p-5",
        className
      )}
    >
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-[0_4px_14px_rgba(124,58,237,0.35)]">
              <SparklesIcon className="size-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-violet-600 uppercase dark:text-violet-400">
                {CAMPAIGN_STUDIO_COPY.studioLabel}
              </p>
              <h2 className="text-base font-semibold text-foreground">
                {studio.workflowName}
              </h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              Step {studio.currentStep}/{studio.totalSteps}
            </p>
            <p className="text-sm font-semibold text-[#1D9E75]">
              {studio.progressPercent}%
            </p>
          </div>
          {studioModeToggle}
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] via-violet-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${studio.progressPercent}%` }}
          />
        </div>

        {studio.inferredFields && studio.inferredFields.length > 0 ? (
          <div className="rounded-lg border border-[#1D9E75]/30 bg-[#1D9E75]/5 px-3 py-2">
            <p className="text-[10px] font-bold tracking-wide text-[#1D9E75] uppercase">
              {CAMPAIGN_STUDIO_COPY.autoInferred}
            </p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {studio.inferredFields.join(" · ")}
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {studio.specialists.map((specialist) => (
          <div
            key={specialist.id}
            className={cn(
              "min-w-0 rounded-lg border px-3 py-2 transition-colors [overflow-wrap:anywhere]",
              specialist.status === "working"
                ? "border-violet-300 bg-violet-50/80 dark:border-violet-800 dark:bg-violet-950/30"
                : specialist.status === "complete"
                  ? "border-[#1D9E75]/30 bg-[#1D9E75]/5"
                  : "border-border/60 bg-muted/30"
            )}
          >
            <div className="flex items-center gap-2">
              {specialist.status === "working" ? (
                <span className="size-2.5 animate-pulse rounded-full bg-violet-500" />
              ) : specialist.status === "complete" ? (
                <span className="size-2.5 rounded-full bg-[#1D9E75]" />
              ) : (
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              )}
              <span className="break-words text-xs font-semibold">{specialist.label}</span>
            </div>
            {specialist.currentTask ? (
              <p className="mt-1 break-words text-[10px] text-muted-foreground">
                {specialist.currentTask}
              </p>
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
          <section key={phase.id} className="min-w-0 space-y-3">
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
