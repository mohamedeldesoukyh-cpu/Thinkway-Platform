"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";

import { SECTION_LOADING_MESSAGES } from "../../constants/copy";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { studioSectionDomId } from "../../hooks/use-studio-section-nav";
import type { CampaignStudioLayoutMode } from "../../types/campaign-studio";
import type { StudioLayoutType } from "../../constants/studio-layout";
import type { CampaignStudioSection } from "../../types/campaign-studio";
import { SectionRenderer } from "../sections/section-renderer";

type StudioSectionCardProps = {
  section: CampaignStudioSection;
  campaignObject?: CampaignObject;
  layout?: StudioLayoutType;
  className?: string;
  icon?: LucideIcon;
  /** Optional subtitle under the section title (reference card-desc). */
  description?: string;
  decisionMode?: CampaignStudioDecisionMode;
  sectionFooter?: ReactNode;
  conversationId?: string;
  messageId?: string;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
  studioDraft?: StudioDraftState;
  onStudioDraftUpdated?: (draft: StudioDraftState) => void;
  appliedRemovedCreatorIds?: string[];
  /** Pending draft changes invalidate this section until Apply All Updates runs. */
  outdated?: boolean;
  layoutMode?: CampaignStudioLayoutMode;
};

const STATUS_STYLES = {
  pending: {
    border: "border-border/60",
    badge: "bg-muted text-muted-foreground",
    label: "Pending",
  },
  running: {
    border: "border-violet-300 dark:border-violet-700",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    label: "In progress",
  },
  complete: {
    border: "border-[#0B0F1A]/8 dark:border-border",
    badge: "bg-[#0C9D57]/10 text-[#0C9D57]",
    label: "Complete",
  },
  blocked: {
    border: "border-amber-300 dark:border-amber-700",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    label: "Needs input",
  },
} as const;

/** Per-section icon accents — mirrors the reference presentation palette. */
const SECTION_ICON_ACCENTS: Record<string, { bg: string; text: string }> = {
  "campaign-summary": { bg: "bg-[#0057FF]/10", text: "text-[#0057FF]" },
  "executive-summary": { bg: "bg-[#D6336C]/10", text: "text-[#D6336C]" },
  "executive-strategy": { bg: "bg-[#7C3AED]/10", text: "text-[#7C3AED]" },
  "creative-concepts": { bg: "bg-[#7C3AED]/10", text: "text-[#7C3AED]" },
  "why-ai": { bg: "bg-[#7C3AED]/10", text: "text-[#7C3AED]" },
  "creator-discovery": { bg: "bg-[#0057FF]/10", text: "text-[#0057FF]" },
  "creator-recommendations": { bg: "bg-[#0057FF]/10", text: "text-[#0057FF]" },
  "creator-mix": { bg: "bg-[#0057FF]/10", text: "text-[#0057FF]" },
  timeline: { bg: "bg-[#D97706]/12", text: "text-[#D97706]" },
  "content-plan": { bg: "bg-[#D97706]/12", text: "text-[#D97706]" },
  "presentation-status": { bg: "bg-[#D6336C]/10", text: "text-[#D6336C]" },
  "kpi-forecast": { bg: "bg-[#0C9D57]/10", text: "text-[#0C9D57]" },
  "success-probability": { bg: "bg-[#0C9D57]/10", text: "text-[#0C9D57]" },
  "budget-planner": { bg: "bg-[#D97706]/10", text: "text-[#D97706]" },
  "risk-analysis": { bg: "bg-[#D97706]/10", text: "text-[#D97706]" },
  "industry-benchmark": { bg: "bg-[#D97706]/10", text: "text-[#D97706]" },
  "opportunity-finder": { bg: "bg-[#D97706]/10", text: "text-[#D97706]" },
};

const DEFAULT_ICON_ACCENT = { bg: "bg-[#0057FF]/10", text: "text-[#0057FF]" };

function SectionLoadingState({ sectionId }: { sectionId: CampaignStudioSection["id"] }) {
  const loading = SECTION_LOADING_MESSAGES[sectionId];
  const specialist = loading?.specialist ?? "Specialist";
  const message = loading?.message ?? "Working…";

  return (
    <div className="flex items-center gap-2.5 py-2" aria-live="polite" aria-busy="true">
      <span className="ai-spinner size-3.5 shrink-0 text-violet-500" aria-hidden />
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{specialist}:</span> {message}
      </p>
    </div>
  );
}

export function StudioSectionCard({
  section,
  campaignObject,
  layout,
  className,
  icon: Icon,
  description,
  decisionMode,
  sectionFooter,
  conversationId,
  messageId,
  onVendorDecisionsUpdated,
  onSlateUpdated,
  studioDraft,
  onStudioDraftUpdated,
  appliedRemovedCreatorIds,
  outdated,
  layoutMode = "panel",
}: StudioSectionCardProps) {
  const isChatLayout = layoutMode === "chat";
  const styles = STATUS_STYLES[section.status as keyof typeof STATUS_STYLES];
  const isLoading = section.status === "pending";
  const hasRenderableContent =
    section.status !== "pending" || campaignObject != null;

  const statusId = `studio-section-${section.id}-status`;

  return (
    <article
      id={studioSectionDomId(section.id)}
      className={cn(
        STUDIO_CLASSES.card,
        isChatLayout ? STUDIO_CLASSES.scrollTargetChat : STUDIO_CLASSES.scrollTarget,
        "flex min-w-0 flex-col p-5 transition-all duration-300 motion-reduce:transition-none sm:px-[22px] sm:py-5",
        layout === "pair" && "min-h-[18rem]",
        styles.border,
        section.status === "running" && "ring-1 ring-violet-200 dark:ring-violet-800",
        className
      )}
      aria-labelledby={`studio-section-${section.id}-title`}
      aria-describedby={statusId}
    >
      <header className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {Icon ? (
            <div
              className={cn(
                "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                (SECTION_ICON_ACCENTS[section.id] ?? DEFAULT_ICON_ACCENT).bg
              )}
            >
              <Icon
                className={cn(
                  "size-[15px]",
                  (SECTION_ICON_ACCENTS[section.id] ?? DEFAULT_ICON_ACCENT).text
                )}
                aria-hidden
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h3
              id={`studio-section-${section.id}-title`}
              className="break-words text-[17px] font-extrabold tracking-[-0.3px] text-foreground [overflow-wrap:anywhere] [word-break:break-word]"
            >
              {section.title}
            </h3>
            {description ? (
              <p className="mt-0.5 text-[11.5px] text-[#6B7280] dark:text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <span
          id={statusId}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[0.4px] uppercase",
            outdated
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              : styles.badge
          )}
        >
          {outdated ? "Outdated" : styles.label}
        </span>
      </header>

      <div
        className={cn(
          "min-w-0 flex-1 [overflow-wrap:anywhere] [word-break:break-word]",
          section.status === "complete" && STUDIO_CLASSES.sectionEnter
        )}
      >
        {isLoading && !hasRenderableContent ? (
          <SectionLoadingState sectionId={section.id} />
        ) : hasRenderableContent ? (
          <SectionRenderer
            section={section}
            campaignObject={campaignObject}
            decisionMode={
              section.id === "creator-recommendations" ? decisionMode : undefined
            }
            conversationId={conversationId}
            messageId={messageId}
            onVendorDecisionsUpdated={onVendorDecisionsUpdated}
            onSlateUpdated={onSlateUpdated}
            studioDraft={studioDraft}
            onStudioDraftUpdated={onStudioDraftUpdated}
            appliedRemovedCreatorIds={appliedRemovedCreatorIds}
          />
        ) : (
          <SectionLoadingState sectionId={section.id} />
        )}
      </div>
      {sectionFooter}
    </article>
  );
}
