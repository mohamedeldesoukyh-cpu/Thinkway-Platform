import type { SupabaseClient } from "@supabase/supabase-js";
import { readReportingRows } from "@/lib/analytics/queries/load-reporting-snapshot";
import { loadReportRates } from "@/lib/analytics/queries/report-commercial";
import { aggregateCampaignDisplayFinancials, type CampaignLineCommercialFxInput } from "@/lib/campaigns/campaign-display-financials";
import { readRevenueShare, revenueShareAmount } from "@/lib/campaigns/revenue-share";

export async function loadCampaignRevenueShare(supabase: SupabaseClient, campaignId: string) {
  const { data: header, error } = await supabase.from("campaign_headers")
    .select("id, name, document_number, currency_code, metadata, updated_at").eq("id", campaignId).single();
  if (error || !header) throw new Error(error?.message ?? "Campaign not found.");
  const share = readRevenueShare(header.metadata);
  const lines = await readReportingRows(supabase.from("campaign_lines")
    .select("id, revenue, cost, revenue_before_vat, cost_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_amount, agency_fee_percent, currency_code, cost_received, cost_received_currency, revenue_fx_override, cost_fx_override")
    .eq("campaign_header_id", campaignId).neq("status", "cancelled").order("id")) as CampaignLineCommercialFxInput[];
  const rates = await loadReportRates(supabase, lines, [header, { currency_code: share?.currency }]);
  const financials = aggregateCampaignDisplayFinancials({ lines, displayCurrency: header.currency_code, rateToEgpByCurrency: rates });
  const amount = revenueShareAmount(share, financials.revenue, header.currency_code, rates);
  return { header, share, financials, amount };
}
