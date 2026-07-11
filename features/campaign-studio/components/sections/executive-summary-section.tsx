"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingFooter } from "./shared/grounding-badge";
import { ExecutiveCard } from "./shared/executive-card";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveExecutiveSummaryData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";
import { cn } from "@/lib/utils";

type ExecutiveSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

function BulletBlock({
  label,
  items,
  accent = "neutral",
}: {
  label: string;
  items: string[];
  accent?: "green" | "purple" | "neutral";
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border px-3 py-2.5",
        accent === "green" && "border-brand-product/25 bg-brand-product/5",
        accent === "purple" && "border-violet-300/40 bg-violet-50/30 dark:bg-violet-950/20",
        accent === "neutral" && "border-border/60 bg-muted/10"
      )}
    >
      <p
        className={cn(
          STUDIO_CLASSES.label,
          accent === "green" && STUDIO_CLASSES.primaryText,
          accent === "purple" && "text-violet-600",
          accent === "neutral" && "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li
            key={item}
            className="min-w-0 break-words text-[11px] leading-relaxed text-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutiveSummarySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveSummarySectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveExecutiveSummaryData(campaignObject);
  if (!data) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Executive summary pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 rounded-xl border border-brand-product/30 bg-gradient-to-br from-brand-product/5 to-violet-50/30 px-4 py-3 dark:to-violet-950/10">
        <p className={cn(STUDIO_CLASSES.label, STUDIO_CLASSES.primaryText)}>
          Executive Summary
        </p>
        <p className="mt-1.5 min-w-0 break-words text-sm leading-relaxed font-medium text-foreground">
          {data.summary}
        </p>
        <GroundingFooter grounding={data.grounding} />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <BulletBlock label="Key Decisions" items={data.keyDecisions} accent="purple" />
        <BulletBlock label="Recommended Actions" items={data.recommendedActions} accent="green" />
        <BulletBlock label="Immediate Next Steps" items={data.immediateNextSteps} accent="neutral" />
        <ExecutiveCard
          label="Expected Business Outcome"
          value={data.expectedBusinessOutcome}
          accent="purple"
        />
      </div>
    </div>
  );
}
