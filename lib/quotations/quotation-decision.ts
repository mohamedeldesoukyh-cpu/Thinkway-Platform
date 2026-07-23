import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { aggregateQuotationForecast } from "@/lib/quotations/quotation-aggregate-metrics";
import { optimizeQuotationCampaign } from "@/lib/quotations/quotation-optimization";
import {
  evaluateCampaignDecision,
  type CampaignConfiguration,
  type CampaignDecisionReport,
} from "@/lib/campaign-decision";

/** Evaluate quotation campaign for launch decision intelligence. */
export function evaluateQuotationDecision(
  items: QuotationItemRow[],
  configuration?: CampaignConfiguration
): CampaignDecisionReport {
  const forecast = aggregateQuotationForecast(items);
  const optimization = optimizeQuotationCampaign(items, {
    budgetAmount: configuration?.commercial?.budget?.amount ?? null,
    currency: configuration?.commercial?.budget?.currency ?? null,
    campaignPlatform: configuration?.platforms?.[0] ?? items[0]?.platform ?? null,
  });

  return evaluateCampaignDecision({ forecast, optimization, configuration });
}
