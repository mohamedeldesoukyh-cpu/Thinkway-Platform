import type { CampaignLineBillingStatus } from "@/features/billing/types";
import {
  isActiveCampaignStatus,
  isCancelledCampaignStatus,
} from "@/features/groups/types";
import { resolveLineCommercialMetrics } from "@/lib/analytics/metrics/financial";
import { CAMPAIGN_STATUS_OPTIONS } from "@/lib/campaigns/constants";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/types/database";

export type HomeRecentCampaign = {
  id: string;
  name: string;
  document_number: string;
  status: CampaignStatus;
  status_label: string;
  revenue: number;
  margin_percent: number;
  client_initials: string;
};

export type HomeTopVendor = {
  id: string;
  display_name: string;
  document_number: string;
  platform: string;
  country_code: string | null;
  follower_count: number;
  initials: string;
};

export type HomeDashboardSnapshot = {
  greetingName: string;
  displayName: string;
  userHandle: string;
  userInitials: string;
  active_campaigns: number;
  total_revenue: number;
  gross_profit: number;
  active_vendors: number;
  currency_code: string;
  margin_percent: number;
  outstanding_revenue: number;
  assignments_count: number;
  po_total: number;
  po_consumed: number;
  po_consumed_percent: number;
  recent_campaigns: HomeRecentCampaign[];
  top_vendors: HomeTopVendor[];
  billing_alert: { title: string; description: string } | null;
};

function resolveGreetingName(
  profile: { full_name: string | null } | null,
  email: string | undefined
): string {
  const fullName = profile?.full_name;
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0]!;
  return email?.split("@")[0] ?? "there";
}

function resolveDisplayName(
  profile: { full_name: string | null } | null,
  email: string | undefined
): string {
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;
  return email?.split("@")[0] ?? "there";
}

function resolveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function campaignStatusLabel(status: CampaignStatus): string {
  return CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function maxFollowerCount(
  accounts: { follower_count: number | null; is_primary: boolean | null }[] | null | undefined
): number {
  if (!accounts?.length) return 0;
  const primary = accounts.find((account) => account.is_primary);
  const source = primary ? [primary] : accounts;
  return Math.max(...source.map((account) => Number(account.follower_count ?? 0)));
}

function primaryPlatformLabel(
  accounts: { platform: string; is_primary: boolean | null }[] | null | undefined
): string {
  if (!accounts?.length) return "—";
  const primary = accounts.find((account) => account.is_primary) ?? accounts[0];
  if (!primary) return "—";
  return primary.platform
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const displayName = resolveDisplayName(
    profile as { full_name: string | null } | null,
    user.email
  );
  const userHandle = user.email?.split("@")[0] ?? displayName;
  const userInitials = resolveInitials(displayName);

  const [
    headersResult,
    linesResult,
    vendorsResult,
    invoicesResult,
    recentCampaignsResult,
    vendorRowsResult,
  ] = await Promise.all([
    supabase
      .from("campaign_headers")
      .select("id, status, currency_code, po_amount_campaign_currency, po_consumed_amount")
      .limit(5000),
    supabase
      .from("campaign_lines")
      .select(
        "campaign_header_id, revenue, cost, profit, billing_status, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat"
      )
      .limit(10000),
    supabase
      .from("campaign_influencers")
      .select("id, influencer_id, campaign_header_id")
      .limit(20000),
    supabase.from("invoices").select("total, amount_paid").limit(5000),
    supabase
      .from("campaign_headers")
      .select("id, name, document_number, status")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("influencers")
      .select("id, document_number, display_name, country_code")
      .eq("status", "active")
      .limit(40),
  ]);

  const vendorIdsForAccounts = (vendorRowsResult.data ?? []).map((row) => row.id);
  const platformAccountsResult =
    vendorIdsForAccounts.length > 0
      ? await supabase
          .from("influencer_platform_accounts")
          .select("influencer_id, platform, follower_count, is_primary")
          .in("influencer_id", vendorIdsForAccounts)
      : { data: [], error: null };

  if (platformAccountsResult.error) {
    throw new Error(platformAccountsResult.error.message);
  }

  const accountsByVendor = new Map<
    string,
    { platform: string; follower_count: number | null; is_primary: boolean | null }[]
  >();
  for (const account of platformAccountsResult.data ?? []) {
    const list = accountsByVendor.get(account.influencer_id) ?? [];
    list.push(account);
    accountsByVendor.set(account.influencer_id, list);
  }

  if (headersResult.error) throw new Error(headersResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);
  if (vendorsResult.error) throw new Error(vendorsResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);
  if (recentCampaignsResult.error) throw new Error(recentCampaignsResult.error.message);
  if (vendorRowsResult.error) throw new Error(vendorRowsResult.error.message);

  const headers = headersResult.data ?? [];
  const activeCampaigns = headers.filter((h) => isActiveCampaignStatus(h.status)).length;
  const operationalHeaderIds = new Set(
    headers.filter((h) => !isCancelledCampaignStatus(h.status)).map((h) => h.id)
  );

  let totalRevenue = 0;
  let grossProfit = 0;
  const revenueByHeader = new Map<string, { revenue: number; gp: number }>();

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

    const existing = revenueByHeader.get(line.campaign_header_id) ?? { revenue: 0, gp: 0 };
    existing.revenue += metrics.revenue;
    existing.gp += metrics.gp;
    revenueByHeader.set(line.campaign_header_id, existing);
  }

  const vendorIds = new Set<string>();
  let assignmentsCount = 0;
  for (const row of vendorsResult.data ?? []) {
    if (
      row.influencer_id &&
      row.campaign_header_id &&
      operationalHeaderIds.has(row.campaign_header_id)
    ) {
      vendorIds.add(row.influencer_id);
      assignmentsCount += 1;
    }
  }

  let outstandingRevenue = 0;
  for (const invoice of invoicesResult.data ?? []) {
    outstandingRevenue += Math.max(
      0,
      Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0)
    );
  }

  let poTotal = 0;
  let poConsumed = 0;
  for (const header of headers.filter((h) => !isCancelledCampaignStatus(h.status))) {
    poTotal += Number(header.po_amount_campaign_currency ?? 0);
    poConsumed += Number(header.po_consumed_amount ?? 0);
  }

  const poConsumedPercent =
    poTotal > 0 ? Math.min(100, Math.round((poConsumed / poTotal) * 100)) : 0;

  const marginPercent =
    totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;

  const currencyCounts = new Map<string, number>();
  for (const header of headers.filter((h) => !isCancelledCampaignStatus(h.status))) {
    const code = header.currency_code ?? DEFAULT_PLATFORM_CURRENCY;
    currencyCounts.set(code, (currencyCounts.get(code) ?? 0) + 1);
  }
  const currency_code =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    DEFAULT_PLATFORM_CURRENCY;

  const recent_campaigns: HomeRecentCampaign[] = (recentCampaignsResult.data ?? [])
    .slice(0, 3)
    .map((row) => {
      const metrics = revenueByHeader.get(row.id) ?? { revenue: 0, gp: 0 };
      const margin =
        metrics.revenue > 0
          ? Math.round((metrics.gp / metrics.revenue) * 1000) / 10
          : 0;

      return {
        id: row.id,
        name: row.name,
        document_number: row.document_number,
        status: row.status as CampaignStatus,
        status_label: campaignStatusLabel(row.status as CampaignStatus),
        revenue: metrics.revenue,
        margin_percent: margin,
        client_initials: resolveInitials(row.name),
      };
    });

  const top_vendors: HomeTopVendor[] = [...(vendorRowsResult.data ?? [])]
    .map((row) => {
      const accounts = accountsByVendor.get(row.id) ?? [];
      return {
        id: row.id,
        display_name: row.display_name,
        document_number: row.document_number,
        platform: primaryPlatformLabel(accounts),
        country_code: row.country_code,
        follower_count: maxFollowerCount(accounts),
        initials: resolveInitials(row.display_name),
      };
    })
    .sort((a, b) => b.follower_count - a.follower_count)
    .slice(0, 3);

  const billing_alert =
    outstandingRevenue > 0
      ? {
          title: "Outstanding receivables",
          description: `${currency_code} billing exposure requires review across open invoices.`,
        }
      : null;

  return {
    greetingName,
    displayName,
    userHandle,
    userInitials,
    active_campaigns: activeCampaigns,
    total_revenue: totalRevenue,
    gross_profit: grossProfit,
    active_vendors: vendorIds.size,
    currency_code,
    margin_percent: marginPercent,
    outstanding_revenue: outstandingRevenue,
    assignments_count: assignmentsCount,
    po_total: poTotal,
    po_consumed: poConsumed,
    po_consumed_percent: poConsumedPercent,
    recent_campaigns,
    top_vendors,
    billing_alert,
  };
}
