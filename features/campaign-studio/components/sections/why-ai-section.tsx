"use client";

import { ZapIcon } from "lucide-react";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
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
    <div className="min-w-0">
      {insights.map((insight) => (
        <div key={insight.category} className={STUDIO_CLASSES.minuteItem}>
          <div className={STUDIO_CLASSES.minuteIco}>
            <ZapIcon className="size-3.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h5 className="text-xs font-extrabold tracking-[0.2px] text-[#7C3AED] uppercase">
              {insight.category}
              {insight.confidence != null ? (
                <span className="ml-1.5 rounded-full bg-[#0C9D57]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#0C9D57] normal-case">
                  {insight.confidence}% confidence
                </span>
              ) : null}
            </h5>
            <p className="mt-1 text-[13.5px] font-bold text-foreground">{insight.title}</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">{insight.rationale}</p>
            {insight.evidence ? (
              <p className="mt-1 text-[10px] italic text-[#6B7280]/80">
                Evidence: {insight.evidence}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
