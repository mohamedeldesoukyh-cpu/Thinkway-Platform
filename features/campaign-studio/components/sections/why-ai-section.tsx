"use client";

import { SparklesIcon } from "lucide-react";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingBadge } from "./shared/grounding-badge";
import { PAIR_STRATEGY_CARD, PAIR_STRATEGY_STACK } from "../../constants/studio-layout";
import {
  directorDecisionMinutesToInsights,
  resolveDirectorDecisionMinutes,
  resolveWhyAi,
} from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type WhyAiSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function WhyAiSection({
  campaignObject,
  fallbackText,
  status,
}: WhyAiSectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const minutes = resolveDirectorDecisionMinutes(campaignObject);
  const insights =
    minutes.length > 0 ? directorDecisionMinutesToInsights(minutes) : resolveWhyAi(campaignObject);
  if (insights.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Thinkway decision rationale pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className={PAIR_STRATEGY_STACK}>
      {insights.map((insight) => (
        <div key={insight.category} className={PAIR_STRATEGY_CARD}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SparklesIcon className="size-3.5 shrink-0 text-violet-600" />
            <span className="text-[10px] font-bold tracking-wide text-violet-600 uppercase">
              {insight.category}
            </span>
            {insight.source ? (
              <GroundingBadge source={insight.source} confidence={insight.confidence} />
            ) : null}
          </div>
          <p className="mt-1 break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {insight.title}
          </p>
          <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {insight.rationale}
          </p>
          {insight.evidence ? (
            <p className="mt-1 break-words text-[10px] italic text-muted-foreground/80 [overflow-wrap:anywhere]">
              Evidence: {insight.evidence}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
