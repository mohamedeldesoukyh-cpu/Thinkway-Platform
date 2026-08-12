import {
  isActiveCampaignStatus,
  isCancelledCampaignStatus,
} from "@/features/groups/types";
import {
  aggregateCampaignDisplayFinancials,
  type CampaignLineCommercialFxInput,
} from "@/lib/campaigns/campaign-display-financials";
import { CAMPAIGN_STATUS_OPTIONS } from "@/lib/campaigns/constants";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { formatCountryCodeLabel } from "@/lib/creators/creator-display-utils";
import { mergeCountryCodes } from "@/lib/creators/country-inference";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { getRequestAuth, createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/types/database";

export type HomeRecentCampaign = {
  id: string;
  name: string;
  document_number: string;
  status: CampaignStatus;
  status_label: string;
  revenue: number;
  /** Invoice/display CCY from campaign header (same as workspace KPIs after FX). */
  currency_code: string;
  margin_percent: number;
  client_initials: string;
};

export type HomeTopVendor = {
  id: string;
  display_name: string;
  document_number: string;
  platform: string;
  country_code: string | null;
  country_codes: string[] | null;
  country_label: string | null;
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
  const { user, fullName, error: authError } = await getRequestAuth();
  if (authError || !user) {
    throw new Error("You must be signed in to continue.");
  }

  const supabase = await createSupabaseServerClient();
  const profile = { full_name: fullName };

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
      .limit(3000),
    supabase
      .from("campaign_lines")
      .select(
        "campaign_header_id, revenue, cost, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat, currency_code, cost_received, cost_received_currency"
      )
      .limit(6000),
    supabase
      .from("campaign_influencers")
      .select("influencer_id, campaign_header_id")
      .limit(8000),
    supabase.from("invoices").select("total, amount_paid").limit(3000),
    supabase
      .from("campaign_headers")
      .select("id, name, document_number, status, currency_code")
      .order("updated_at", { ascending: false })
      .limit(5),
    // Embed platform accounts to avoid a second round-trip for the top-vendors strip.
    supabase
      .from("influencers")
      .select(
        "id, document_number, display_name, country_code, country_codes, influencer_platform_accounts!influencer_platform_accounts_influencer_id_fkey(platform, follower_count, is_primary)"
      )
      .eq("status", "active")
      .limit(40),
  ]);

  const greetingName = resolveGreetingName(profile, user.email);
  const displayName = resolveDisplayName(profile, user.email);
  const userHandle = user.email?.split("@")[0] ?? displayName;
  const userInitials = resolveInitials(displayName);

  if (headersResult.error) throw new Error(headersResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);
  if (vendorsResult.error) throw new Error(vendorsResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);
  if (recentCampaignsResult.error) throw new Error(recentCampaignsResult.error.message);
  if (vendorRowsResult.error) throw new Error(vendorRowsResult.error.message);

  const accountsByVendor = new Map<
    string,
    { platform: string; follower_count: number | null; is_primary: boolean | null }[]
  >();
  for (const row of vendorRowsResult.data ?? []) {
    // Typed Database Relationships omit this embed; runtime join still returns rows.
    const accounts = (
      row as unknown as {
        influencer_platform_accounts?: {
          platform: string;
          follower_count: number | null;
          is_primary: boolean | null;
        }[];
      }
    ).influencer_platform_accounts;
    if (accounts?.length) {
      accountsByVendor.set(row.id, accounts);
    }
  }

  const headers = headersResult.data ?? [];
  const activeCampaigns = headers.filter((h) => isActiveCampaignStatus(h.status)).length;
  const operationalHeaders = headers.filter((h) => !isCancelledCampaignStatus(h.status));
  const operationalHeaderIds = new Set(operationalHeaders.map((h) => h.id));
  const headerCurrencyById = new Map(
    headers.map((h) => [
      h.id,
      (h.currency_code ?? DEFAULT_PLATFORM_CURRENCY).trim().toUpperCase() ||
        DEFAULT_PLATFORM_CURRENCY,
    ])
  );

  const linesByHeader = new Map<string, CampaignLineCommercialFxInput[]>();
  for (const line of linesResult.data ?? []) {
    if (!operationalHeaderIds.has(line.campaign_header_id)) continue;
    const bucket = linesByHeader.get(line.campaign_header_id) ?? [];
    bucket.push({
      revenue: line.revenue,
      cost: line.cost,
      revenue_before_vat: line.revenue_before_vat,
      usage_rights_amount: line.usage_rights_amount,
      usage_rights_cost: line.usage_rights_cost,
      agency_fee_percent: line.agency_fee_percent,
      agency_fee_amount: line.agency_fee_amount,
      cost_before_vat: line.cost_before_vat,
      currency_code: line.currency_code,
      cost_received: line.cost_received,
      cost_received_currency: line.cost_received_currency,
    });
    linesByHeader.set(line.campaign_header_id, bucket);
  }

  const currencyCounts = new Map<string, number>();
  for (const header of operationalHeaders) {
    const code = headerCurrencyById.get(header.id) ?? DEFAULT_PLATFORM_CURRENCY;
    currencyCounts.set(code, (currencyCounts.get(code) ?? 0) + 1);
  }
  const currency_code =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    DEFAULT_PLATFORM_CURRENCY;

  // Same FX path as Campaign Workspace KPIs: line CCY → EGP → invoice/display CCY.
  const currenciesNeeded = new Set<string>([currency_code]);
  for (const header of operationalHeaders) {
    const displayCcy = headerCurrencyById.get(header.id) ?? DEFAULT_PLATFORM_CURRENCY;
    currenciesNeeded.add(displayCcy);
    for (const line of linesByHeader.get(header.id) ?? []) {
      const revCcy = (line.currency_code || displayCcy).trim().toUpperCase() || displayCcy;
      const costCcy =
        (line.cost_received_currency || line.currency_code || displayCcy)
          .trim()
          .toUpperCase() || displayCcy;
      currenciesNeeded.add(revCcy);
      currenciesNeeded.add(costCcy);
    }
  }
  for (const row of recentCampaignsResult.data ?? []) {
    const displayCcy =
      (row.currency_code ?? DEFAULT_PLATFORM_CURRENCY).trim().toUpperCase() ||
      DEFAULT_PLATFORM_CURRENCY;
    currenciesNeeded.add(displayCcy);
  }
  const rateToEgpByCurrency = new Map<string, number>();
  await Promise.all(
    [...currenciesNeeded].map(async (code) => {
      rateToEgpByCurrency.set(code, await resolveRateToEgp(supabase, code));
    })
  );

  let totalRevenue = 0;
  let grossProfit = 0;
  const displayByHeader = new Map<
    string,
    { revenue: number; gp: number; currency_code: string; margin_percent: number }
  >();

  for (const header of operationalHeaders) {
    const displayCurrency = headerCurrencyById.get(header.id) ?? DEFAULT_PLATFORM_CURRENCY;
    const lines = linesByHeader.get(header.id) ?? [];
    const headerDisplay = aggregateCampaignDisplayFinancials({
      lines,
      displayCurrency,
      rateToEgpByCurrency,
    });
    displayByHeader.set(header.id, {
      revenue: headerDisplay.revenue,
      gp: headerDisplay.gp,
      currency_code: headerDisplay.currency_code,
      margin_percent: headerDisplay.margin_percent,
    });

    // Dashboard KPI strip uses majority currency (status bar); convert via EGP pivot.
    const majorityDisplay = aggregateCampaignDisplayFinancials({
      lines,
      displayCurrency: currency_code,
      rateToEgpByCurrency,
    });
    totalRevenue += majorityDisplay.revenue;
    grossProfit += majorityDisplay.gp;
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

  const recent_campaigns: HomeRecentCampaign[] = (recentCampaignsResult.data ?? [])
    .slice(0, 3)
    .map((row) => {
      let metrics = displayByHeader.get(row.id);
      if (!metrics) {
        // Cancelled / non-operational headers are excluded from KPI rollups but may still
        // appear in Recent — project with the same workspace display path.
        const displayCurrency =
          (row.currency_code ?? DEFAULT_PLATFORM_CURRENCY).trim().toUpperCase() ||
          DEFAULT_PLATFORM_CURRENCY;
        const headerDisplay = aggregateCampaignDisplayFinancials({
          lines: linesByHeader.get(row.id) ?? [],
          displayCurrency,
          rateToEgpByCurrency,
        });
        metrics = {
          revenue: headerDisplay.revenue,
          gp: headerDisplay.gp,
          currency_code: headerDisplay.currency_code,
          margin_percent: headerDisplay.margin_percent,
        };
      }

      return {
        id: row.id,
        name: row.name,
        document_number: row.document_number,
        status: row.status as CampaignStatus,
        status_label: campaignStatusLabel(row.status as CampaignStatus),
        revenue: metrics.revenue,
        currency_code: metrics.currency_code,
        margin_percent: metrics.margin_percent,
        client_initials: resolveInitials(row.name),
      };
    });

  const top_vendors: HomeTopVendor[] = [...(vendorRowsResult.data ?? [])]
    .map((row) => {
      const accounts = accountsByVendor.get(row.id) ?? [];
      const countryCodes = mergeCountryCodes(row.country_codes, row.country_code);
      return {
        id: row.id,
        display_name: row.display_name,
        document_number: row.document_number,
        platform: primaryPlatformLabel(accounts),
        country_code: row.country_code,
        country_codes: row.country_codes,
        country_label:
          countryCodes.length > 0
            ? countryCodes.map(formatCountryCodeLabel).join(" · ")
            : null,
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
