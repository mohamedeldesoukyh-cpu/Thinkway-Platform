import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { aggregateQuotationForecast } from "@/lib/quotations/quotation-aggregate-metrics";
import { optimizeCampaign, type CampaignOptimizationReport } from "@/lib/campaign-optimization";

/** Run optimization analysis for a quotation roster. */
export function optimizeQuotationCampaign(
  items: QuotationItemRow[],
  context?: { budgetAmount?: number | null; currency?: string | null; campaignPlatform?: string | null }
): CampaignOptimizationReport {
  const forecast = aggregateQuotationForecast(items);
  return optimizeCampaign({
    forecast,
    context: {
      budget:
        context?.budgetAmount && context.budgetAmount > 0
          ? { amount: context.budgetAmount, currency: context.currency ?? null }
          : undefined,
      campaignPlatform: context?.campaignPlatform ?? items[0]?.platform ?? null,
    },
  });
}
