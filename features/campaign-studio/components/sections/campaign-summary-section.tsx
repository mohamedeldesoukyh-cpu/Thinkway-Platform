"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { DetailItem, StatBox } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveCampaignSummary } from "../../services/section-data-resolver";
import { CampaignBriefCard } from "./campaign-brief-card";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type CampaignSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
  conversationId?: string;
  messageId?: string;
  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;
};

export function CampaignSummarySection({
  campaignObject,
  fallbackText,
  status,
  conversationId,
  messageId,
  onBriefApplied,
}: CampaignSummarySectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveCampaignSummary(campaignObject);
  const briefCard = campaignObject ? (
    <CampaignBriefCard
      campaignObject={campaignObject}
      conversationId={conversationId}
      messageId={messageId}
      onBriefApplied={onBriefApplied}
    />
  ) : null;

  if (!data) {
    return (
      <div className="min-w-0 space-y-3">
        {briefCard}
        {shouldShowPendingPlaceholder(status, false) ? (
          <SectionPendingMessage label="Campaign summary pending…" />
        ) : (
          <SectionFallbackContent text={fallbackText} />
        )}
      </div>
    );
  }

  const clientBrand = [data.client, data.brand].filter(Boolean).join(" · ") || data.brand || data.client || "";

  return (
    <div className="min-w-0 space-y-3">
      {briefCard}
      <div className={STUDIO_CLASSES.statGrid}>
        <StatBox label="Budget" value={data.budget ?? ""} sub="Influencer program" />
        <StatBox label="Duration" value={data.duration ?? ""} />
        <StatBox label="Campaign Type" value={data.campaignType ?? ""} sub="Mass awareness" />
        <StatBox label="Platforms" value={data.platforms ?? ""} />
      </div>
      <div className={STUDIO_CLASSES.detailGrid}>
        <DetailItem label="Client / Brand" value={clientBrand} />
        <DetailItem label="Estimated Reach" value={data.estimatedReach ?? ""} />
        <DetailItem label="Objective" value={data.objective ?? ""} />
        <DetailItem label="Creator Mix" value={data.creatorMix ?? ""} />
        <DetailItem label="Audience" value={data.targetAudience ?? ""} />
        <DetailItem label="Product" value={data.product ?? ""} />
        <DetailItem label="Market" value={data.market ?? ""} />
        <DetailItem label="Deliverables" value={data.deliverables ?? ""} />
      </div>
    </div>
  );
}
