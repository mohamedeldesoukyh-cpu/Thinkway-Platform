import type { CampaignObject } from "@/features/campaign-intelligence";

import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignStudioSectionId } from "../types/campaign-studio";
import {
  resolveCreatorCounts,
  resolveTimelineData,
  resolveVendorRecommendations,
} from "./section-data-resolver";

export function getSectionCardDescription(
  sectionId: CampaignStudioSectionId,
  campaignObject?: CampaignObject
): string | undefined {
  if (!campaignObject) return undefined;

  switch (sectionId) {
    case "creator-recommendations": {
      const { recommendationCount } = resolveCreatorCounts(campaignObject);
      const parsedCount = resolveVendorRecommendations(campaignObject).length;
      // Prefer persisted recommendation IDs over free-text line parse (avoids stale counts).
      const count = recommendationCount > 0 ? recommendationCount : parsedCount;
      const platforms = getCampaignFacts(campaignObject)?.platforms;
      if (count === 0 && !platforms?.length) return undefined;
      const parts: string[] = [];
      if (count > 0) parts.push(`${count} recommended`);
      if (platforms?.length) parts.push(platforms.join(" + "));
      return parts.length > 0 ? parts.join(" · ") : undefined;
    }
    case "timeline": {
      const timeline = resolveTimelineData(campaignObject);
      if (!timeline) return undefined;
      const parts = [`${timeline.durationWeeks} weeks`];
      if (timeline.goLiveWeek) parts.push(`go-live week ${timeline.goLiveWeek}`);
      return parts.join(" · ");
    }
    case "creator-discovery": {
      const { discoveryIds, recommendationCount } = resolveCreatorCounts(campaignObject);
      const total = discoveryIds.length || recommendationCount;
      if (total === 0) return undefined;
      return `${total.toLocaleString()} matches screened`;
    }
    default:
      return undefined;
  }
}
