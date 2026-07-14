"use client";

import { ExecutiveCard } from "./shared/executive-card";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { DASHBOARD_SUMMARY_GRID } from "../../constants/studio-layout";
import {
  resolveCampaignSummary,
  resolveCreatorIds,
} from "../../services/section-data-resolver";
import { estimateSlateReach } from "../../services/campaign-render-model";
import { useCreatorHydration } from "../../hooks/use-creator-hydration";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type CampaignSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function CampaignSummarySection({
  campaignObject,
  fallbackText,
  status,
}: CampaignSummarySectionProps) {
  const { ids } = resolveCreatorIds(campaignObject);
  const { vendors } = useCreatorHydration(ids);

  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveCampaignSummary(campaignObject);
  if (!data) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Campaign summary pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  // Reach is modeled from the selected creator slate — the same computation
  // the PDF/PowerPoint exports use — never from an industry template.
  const slateReach = estimateSlateReach(vendors);
  const estimatedReach = slateReach?.formattedRange ?? data.estimatedReach ?? "";

  const cards = [
    { label: "Client", value: data.client ?? data.brand ?? "", accent: "green" as const },
    { label: "Brand", value: data.brand ?? "", accent: "neutral" as const },
    { label: "Product", value: data.product ?? "", accent: "neutral" as const },
    { label: "Market", value: data.market ?? "", accent: "neutral" as const },
    { label: "Objective", value: data.objective ?? "", accent: "purple" as const },
    { label: "Audience", value: data.targetAudience ?? "", accent: "purple" as const },
    { label: "Budget", value: data.budget ?? "", accent: "green" as const },
    { label: "Duration", value: data.duration ?? "", accent: "neutral" as const },
    { label: "Campaign Type", value: data.campaignType ?? "", accent: "purple" as const },
    { label: "Platforms", value: data.platforms ?? "", accent: "neutral" as const },
    { label: "Creator Mix", value: data.creatorMix ?? "", accent: "green" as const },
    { label: "Estimated Reach", value: estimatedReach, accent: "green" as const },
  ].filter((c) => c.value.trim());

  return (
    <div className={DASHBOARD_SUMMARY_GRID}>
      {cards.map((card) => (
        <ExecutiveCard key={card.label} {...card} className="h-full" />
      ))}
    </div>
  );
}
