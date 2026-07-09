"use client";

import { Badge } from "@/components/ui/badge";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingBadge } from "./shared/grounding-badge";
import { resolveOpportunities } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type OpportunityFinderSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const IMPACT_COLORS = {
  high: "border-[#1D9E75]/40 bg-[#1D9E75]/10 text-[#1D9E75]",
  medium: "border-violet-300/50 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  low: "border-border/60 bg-muted/30 text-muted-foreground",
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
    <div className="space-y-2">
      {opportunities.map((opp) => (
        <div
          key={`${opp.category}-${opp.title}`}
          className="rounded-xl border border-border/70 bg-background/80 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] font-bold uppercase">
              {opp.category}
            </Badge>
            <GroundingBadge source={opp.source} />
            <Badge className={IMPACT_COLORS[opp.impact]}>
              {opp.impact} impact
            </Badge>
          </div>
          <p className="mt-1.5 text-sm font-semibold">{opp.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{opp.description}</p>
        </div>
      ))}
    </div>
  );
}
