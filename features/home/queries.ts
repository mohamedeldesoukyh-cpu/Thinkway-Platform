import type { CampaignLineBillingStatus } from "@/features/billing/types";
import {
  isActiveCampaignStatus,
  isCancelledCampaignStatus,
} from "@/features/groups/types";
import { resolveLineCommercialMetrics } from "@/lib/analytics/metrics/financial";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HomeDashboardSnapshot = {
  greetingName: string;
  active_campaigns: number;
  total_revenue: number;
  gross_profit: number;
  active_vendors: number;
  currency_code: string;
};

function resolveGreetingName(
  profile: { full_name: string | null } | null,
  email: string | undefined
): string {
  const fullName = profile?.full_name;
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0]!;
  return email?.split("@")[0] ?? "there";
}

/** KPIs scoped to campaigns the signed-in user can access (RLS via can_access_campaign_header). */
export async function getHomeDashboardSnapshot(): Promise<HomeDashboardSnapshot> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be signed in to continue.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const greetingName = resolveGreetingName(
    profile as { full_name: string | null } | null,
    user.email
  );

  const [headersResult, linesResult, vendorsResult] = await Promise.all([
    supabase.from("campaign_headers").select("id, status, currency_code").limit(5000),
    supabase
      .from("campaign_lines")
      .select(
        "campaign_header_id, revenue, cost, profit, billing_status, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat"
      )
      .limit(10000),
    supabase
      .from("campaign_influencers")
      .select("influencer_id, campaign_header_id")
      .limit(20000),
  ]);

  if (headersResult.error) throw new Error(headersResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);
  if (vendorsResult.error) throw new Error(vendorsResult.error.message);

  const headers = headersResult.data ?? [];
  const activeCampaigns = headers.filter((h) => isActiveCampaignStatus(h.status)).length;
  const operationalHeaderIds = new Set(
    headers.filter((h) => !isCancelledCampaignStatus(h.status)).map((h) => h.id)
  );

  let totalRevenue = 0;
  let grossProfit = 0;
  for (const line of linesResult.data ?? []) {
    if (!operationalHeaderIds.has(line.campaign_header_id)) continue;
    const metrics = resolveLineCommercialMetrics({
      revenue: Number(line.revenue ?? 0),
      cost: Number(line.cost ?? 0),
      profit: Number(line.profit ?? 0),
      billing_status: line.billing_status as CampaignLineBillingStatus,
      revenue_before_vat: line.revenue_before_vat,
      usage_rights_amount: line.usage_rights_amount,
      usage_rights_cost: line.usage_rights_cost,
      agency_fee_percent: line.agency_fee_percent,
      agency_fee_amount: line.agency_fee_amount,
      cost_before_vat: line.cost_before_vat,
    });
    totalRevenue += metrics.revenue;
    grossProfit += metrics.gp;
  }

  const vendorIds = new Set<string>();
  for (const row of vendorsResult.data ?? []) {
    if (
      row.influencer_id &&
      row.campaign_header_id &&
      operationalHeaderIds.has(row.campaign_header_id)
    ) {
      vendorIds.add(row.influencer_id);
    }
  }

  const currencyCounts = new Map<string, number>();
  for (const header of headers.filter((h) => !isCancelledCampaignStatus(h.status))) {
    const code = header.currency_code ?? DEFAULT_PLATFORM_CURRENCY;
    currencyCounts.set(code, (currencyCounts.get(code) ?? 0) + 1);
  }
  const currency_code =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    DEFAULT_PLATFORM_CURRENCY;

  return {
    greetingName,
    active_campaigns: activeCampaigns,
    total_revenue: totalRevenue,
    gross_profit: grossProfit,
    active_vendors: vendorIds.size,
    currency_code,
  };
}
