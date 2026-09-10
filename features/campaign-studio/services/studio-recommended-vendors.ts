import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";

import {
  vendorMatchesCampaignMarket,
  type StudioCreatorLocation,
} from "./studio-market-creators";

/**
 * What belongs on the campaign's recommendation list.
 *
 * This used to also require the ECI investment verdict to be "Recommended" —
 * `toCampaignDecisionLabel(signal.recommendation) === "Recommended"`. That made
 * an investment reading decide campaign membership, so a creator with a thin
 * commercial record dropped off the campaign's own recommendation even when it
 * met every requirement the brief stated, and "Insufficient Data" was treated
 * as a rejection.
 *
 * The gate is now the campaign's own requirements only: its market and the
 * brief's creator mix. Investment intelligence stays available as support on
 * the card and in the creator detail — see
 * `resolveCampaignCreatorDecision` — and cannot remove a creator from the
 * campaign's recommendation.
 */
export function selectStudioRecommendedVendors<T>(
  vendors: T[],
  options: {
    markets?: string[];
    locationOf: (vendor: T) => StudioCreatorLocation;
    /** When set, off-brief specialists are dropped — not merely sorted lower. */
    fitsBriefMix?: (vendor: T) => boolean;
  }
): T[] {
  return vendors.filter((vendor) => {
    if (!vendorMatchesCampaignMarket(options.locationOf(vendor), options.markets)) {
      return false;
    }
    if (options.fitsBriefMix && !options.fitsBriefMix(vendor)) {
      return false;
    }
    return true;
  });
}

/** The investment recommendation string, for SUPPORTING display only. */
export function recommendationFromVendor(input: {
  planningSignal?: StudioEciPlanningSignal | null;
  eciRecommendation?: string | null;
}): string | undefined {
  return input.planningSignal?.recommendation ?? input.eciRecommendation ?? undefined;
}
