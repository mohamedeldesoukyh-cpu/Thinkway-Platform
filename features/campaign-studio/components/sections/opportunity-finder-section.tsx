"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { OppCard } from "./shared/studio-ui-primitives";
import { resolveOpportunities } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type OpportunityFinderSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function OpportunityFinderSection({
  campaignObject,
  fallbackText,
  status,
}: OpportunityFinderSectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const opportunities = resolveOpportunities(campaignObject);
  if (opportunities.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Opportunities pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0">
      {opportunities.map((opp) => (
        <OppCard
          key={`${opp.category}-${opp.title}`}
          category={opp.category}
          impact={opp.impact}
          title={opp.title}
          description={opp.description}
        />
      ))}
    </div>
  );
}
