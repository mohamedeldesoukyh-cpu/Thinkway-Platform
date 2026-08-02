"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { DetailGrid, DetailItem, StatBox, StatGrid } from "./shared/studio-ui-primitives";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
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
  const refMode = useStudioRefMode();

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
    const pending = (
      <>
        {briefCard}
        {shouldShowPendingPlaceholder(status, false) ? (
          <SectionPendingMessage label="Campaign summary pending…" />
        ) : (
          <SectionFallbackContent text={fallbackText} />
        )}
      </>
    );
    return refMode ? pending : <div className="min-w-0 space-y-3">{pending}</div>;
  }

  const isPollutedLabel = (value?: string | null) =>
    Boolean(
      value &&
        (/\bplease\s+(search|find|build)\b/i.test(value) ||
          (value.length > 60 && /\bbudget\b/i.test(value)))
    );
  const cleanClient = isPollutedLabel(data.client) ? undefined : data.client;
  const cleanBrand = isPollutedLabel(data.brand) ? undefined : data.brand;
  const cleanMarket = isPollutedLabel(data.market)
    ? data.market?.match(/\b(Egypt|UAE|Saudi Arabia|Jordan|Kuwait|Qatar|Bahrain|Oman|MENA|GCC)\b/i)?.[1]
    : data.market;
  const clientBrand =
    [cleanClient, cleanBrand].filter(Boolean).join(" · ") ||
    cleanBrand ||
    cleanClient ||
    "";

  const body = (
    <>
      {briefCard}
      <StatGrid>
        <StatBox label="Budget" value={data.budget ?? ""} sub="Influencer program" mono />
        <StatBox label="Campaign Start Date" value={data.campaignStartDate ?? "—"} />
        <StatBox label="Campaign End Date" value={data.campaignEndDate ?? "—"} />
        <StatBox label="Duration" value={data.duration ?? ""} />
        <StatBox label="Campaign Type" value={data.campaignType ?? ""} sub="Mass awareness" />
        <StatBox label="Platforms" value={data.platforms ?? ""} />
      </StatGrid>
      <DetailGrid>
        <DetailItem label="Client / Brand" value={clientBrand} />
        <DetailItem label="Estimated Reach" value={data.estimatedReach ?? ""} />
        <DetailItem label="Objective" value={data.objective ?? ""} />
        <DetailItem label="Creator Mix" value={data.creatorMix ?? ""} />
        <DetailItem label="Audience" value={data.targetAudience ?? ""} />
        <DetailItem label="Product" value={data.product ?? ""} />
        <DetailItem label="Market" value={cleanMarket ?? ""} />
        <DetailItem label="Deliverables" value={data.deliverables ?? ""} />
      </DetailGrid>
    </>
  );

  return refMode ? body : <div className="min-w-0 space-y-3">{body}</div>;
}
