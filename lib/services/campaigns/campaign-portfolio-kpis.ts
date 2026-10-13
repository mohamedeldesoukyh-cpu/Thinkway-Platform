import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import { roundMoney } from "@/lib/analytics/aggregations/round";

/** The same EGP live-ad book used by Home and Executive. */
export function aggregateRecognizedCampaignKpis(
  facts: CampaignAnalyticsFact[],
  assignments: { id: string; campaign_header_id: string | null; influencer_id: string | null }[],
) {
  const ids = new Set(facts.map(f => f.campaign_header_id));
  const revenue = roundMoney(facts.reduce((sum, f) => sum + f.metrics.revenue, 0));
  const gp = roundMoney(facts.reduce((sum, f) => sum + f.metrics.gp, 0));
  return {
    total_campaigns: ids.size,
    total_revenue: revenue,
    avg_margin: computeMarginPercent(revenue, gp),
    assignments: new Set(assignments.filter(a => a.influencer_id && a.campaign_header_id && ids.has(a.campaign_header_id)).map(a => a.id)).size,
    currency_code: "EGP",
  };
}
