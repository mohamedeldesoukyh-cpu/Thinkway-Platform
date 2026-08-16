import { toCampaignDecisionLabel } from "@/features/campaign-studio/services/eci/strategy-confidence";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";

import {
  vendorMatchesCampaignMarket,
  type StudioCreatorLocation,
} from "./studio-market-creators";

/**
 * Pending ECI stays eligible (hydration not finished). Once a decision exists,
 * only Recommended belongs on the "recommended creators" list.
 */
export function vendorPassesStudioRecommendationGate(
  recommendation: string | null | undefined
): boolean {
  if (!recommendation?.trim()) return true;
  return toCampaignDecisionLabel(recommendation) === "Recommended";
}

export function selectStudioRecommendedVendors<T>(
  vendors: T[],
  options: {
    markets?: string[];
    locationOf: (vendor: T) => StudioCreatorLocation;
    recommendationOf: (vendor: T) => string | null | undefined;
  }
): T[] {
  return vendors.filter(
    (vendor) =>
      vendorMatchesCampaignMarket(options.locationOf(vendor), options.markets) &&
      vendorPassesStudioRecommendationGate(options.recommendationOf(vendor))
  );
}

export function recommendationFromVendor(input: {
  planningSignal?: StudioEciPlanningSignal | null;
  eciRecommendation?: string | null;
}): string | undefined {
  return input.planningSignal?.recommendation ?? input.eciRecommendation ?? undefined;
}
