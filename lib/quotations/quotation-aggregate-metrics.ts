import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import {
  computeCampaignForecastFromProfiles,
  quotationItemsToForecastProfiles,
  type CampaignForecast,
} from "@/lib/campaign-forecast";

/** Build the unified campaign forecast for a quotation roster. */
export function aggregateQuotationForecast(items: QuotationItemRow[]): CampaignForecast {
  return computeCampaignForecastFromProfiles(quotationItemsToForecastProfiles(items));
}

/** Estimated reach — expected unique people reached (not raw follower sum). */
export function aggregateQuotationReach(items: QuotationItemRow[]): number {
  return aggregateQuotationForecast(items).estimatedReach;
}

/** Audience size — deduplicated sum of creator followers. */
export function aggregateQuotationAudienceSize(items: QuotationItemRow[]): number {
  return aggregateQuotationForecast(items).audienceSize;
}

/** Average ER across unique creators — one value per creator, not per option line. */
export function aggregateQuotationEngagementRate(
  items: QuotationItemRow[]
): number | null {
  return aggregateQuotationForecast(items).averageEngagementRate;
}
