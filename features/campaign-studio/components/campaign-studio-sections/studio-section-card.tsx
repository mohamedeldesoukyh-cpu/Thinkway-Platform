"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";

import { SECTION_LOADING_MESSAGES } from "../../constants/copy";
import type { StudioLayoutType } from "../../constants/studio-layout";
import type { CampaignStudioSection } from "../../types/campaign-studio";
import { SectionRenderer } from "../sections/section-renderer";

type StudioSectionCardProps = {
  section: CampaignStudioSection;
  campaignObject?: CampaignObject;
  layout?: StudioLayoutType;
  className?: string;
  icon?: LucideIcon;
  decisionMode?: CampaignStudioDecisionMode;
  sectionFooter?: ReactNode;
  conversationId?: string;
  messageId?: string;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
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
    border: "border-[#1D9E75]/40",
    badge: "bg-[#1D9E75]/10 text-[#1D9E75]",
    label: "Complete",
  },
  blocked: {
    border: "border-amber-300 dark:border-amber-700",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    label: "Needs input",
  },
} as const;

function SectionLoadingState({ sectionId }: { sectionId: CampaignStudioSection["id"] }) {
  const loading = SECTION_LOADING_MESSAGES[sectionId];
  const specialist = loading?.specialist ?? "Specialist";
  const message = loading?.message ?? "Working…";

  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="ai-spinner size-3.5 shrink-0 text-violet-500" />
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
  decisionMode,
  sectionFooter,
  conversationId,
  messageId,
  onVendorDecisionsUpdated,
}: StudioSectionCardProps) {
  const styles = STATUS_STYLES[section.status as keyof typeof STATUS_STYLES];
  const isLoading = section.status === "pending";
  const hasRenderableContent =
    section.status !== "pending" || campaignObject != null;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-background/90 p-4 shadow-sm transition-all duration-300",
        layout === "pair" && "min-h-[18rem]",
        layout === "dashboard" && "p-4 sm:p-5",
        styles.border,
        section.status === "running" && "ring-1 ring-violet-200 dark:ring-violet-800",
        className
      )}
    >
      <header className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {Icon ? (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-950/40">
              <Icon className="size-3.5 text-violet-600 dark:text-violet-400" />
            </div>
          ) : null}
          <h3 className="min-w-0 flex-1 break-words pt-0.5 text-sm font-semibold text-foreground [overflow-wrap:anywhere] [word-break:break-word]">
            {section.title}
          </h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
            styles.badge
          )}
        >
          {styles.label}
        </span>
      </header>

      <div className="min-w-0 flex-1 [overflow-wrap:anywhere] [word-break:break-word]">
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
          />
        ) : (
          <SectionLoadingState sectionId={section.id} />
        )}
      </div>
      {sectionFooter}
    </article>
  );
}
