import { computeAgencyFeeAmount } from "@/lib/assignments/client-billing-commercial";
import { rowTotalRevenue } from "@/lib/assignments/commercial-calculations";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { isCancelledCampaignStatus } from "@/features/groups/types";
import { buildLineVatPayload } from "@/lib/vat/line-payload";

export function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

export function resolveAssignmentMultiCurrencyCost(parsed: {
  currency_code: string;
  cost?: number;
  cost_before_vat?: number;
  cost_received?: number;
  cost_received_currency?: string;
  fx_rate?: number;
  fx_from_currency?: string;
  fx_to_currency?: string;
}) {
  const campaignCurrency = parsed.currency_code;
  const costInLc = parsed.cost_before_vat ?? parsed.cost ?? 0;
  const costReceived = parsed.cost_received ?? costInLc;
  const costReceivedCurrency =
    parsed.cost_received_currency ?? parsed.fx_from_currency ?? campaignCurrency;
  const fxRate = parsed.fx_rate ?? 1;

  return {
    cost: costInLc,
    cost_before_vat: costInLc,
    cost_received: costReceived,
    cost_received_currency: costReceivedCurrency,
    fx_rate: fxRate,
    fx_from_currency: parsed.fx_from_currency ?? costReceivedCurrency,
    fx_to_currency: parsed.fx_to_currency ?? campaignCurrency,
    fx_snapshot_at: new Date().toISOString(),
  };
}

export function resolveAssignmentCommercialBilling(
  commercial: {
    pricing_mode: "package" | "per_deliverable";
    commercial_rows: Array<{
      quantity: number;
      revenue_before_vat: number;
      usage_rights_amount?: number;
      usage_rights_cost?: number;
      agency_fee_percent?: number;
    }>;
  },
  lineUsageRightsAmount: number,
  lineUsageRightsCost: number,
  lineAgencyFeePercent: number
) {
  if (commercial.pricing_mode === "per_deliverable" && commercial.commercial_rows.length > 0) {
    const usageRightsAmount = commercial.commercial_rows.reduce(
      (sum, row) => sum + Number(row.usage_rights_amount ?? 0),
      0
    );
    const usageRightsCost = commercial.commercial_rows.reduce(
      (sum, row) => sum + Number(row.usage_rights_cost ?? 0),
      0
    );
    const revenueTotal = commercial.commercial_rows.reduce(
      (sum, row) => sum + rowTotalRevenue(row),
      0
    );
    const agencyFeeAmount = commercial.commercial_rows.reduce((sum, row) => {
      const revenue = rowTotalRevenue(row);
      const ur = Number(row.usage_rights_amount ?? 0);
      return sum + computeAgencyFeeAmount(revenue, ur, row.agency_fee_percent ?? 0);
    }, 0);
    const agencyFeePercent =
      revenueTotal + usageRightsAmount > 0
        ? Math.round((agencyFeeAmount / (revenueTotal + usageRightsAmount)) * 10000) / 100
        : 0;
    return {
      usage_rights_amount: Math.round(usageRightsAmount * 100) / 100,
      usage_rights_cost: Math.round(usageRightsCost * 100) / 100,
      agency_fee_percent: agencyFeePercent,
    };
  }

  return {
    usage_rights_amount: lineUsageRightsAmount,
    usage_rights_cost: lineUsageRightsCost,
    agency_fee_percent: lineAgencyFeePercent,
  };
}

export function resolveLineVatInput(
  parsed: {
    revenue: number;
    cost: number;
    revenue_before_vat?: number;
    usage_rights_amount?: number;
    usage_rights_cost?: number;
    agency_fee_percent?: number;
    cost_before_vat?: number;
    revenue_vat_percent: number;
    cost_vat_percent: number;
    revenue_vat_exempt?: boolean;
    cost_vat_exempt?: boolean;
  },
  defaults: {
    clientVatRate: number;
    vendorVatRate: number;
    vendorVatRegistered: boolean;
  }
) {
  const revenueBeforeVat = parsed.revenue_before_vat ?? parsed.revenue;
  const costBeforeVat = parsed.cost_before_vat ?? parsed.cost;
  const revenueExempt = parsed.revenue_vat_exempt ?? false;
  const costExempt = parsed.cost_vat_exempt ?? false;

  const revenueVatPercent = revenueExempt
    ? 0
    : parsed.revenue_vat_percent > 0
      ? parsed.revenue_vat_percent
      : defaults.clientVatRate;

  const costVatPercent = costExempt
    ? 0
    : parsed.cost_vat_percent > 0
      ? parsed.cost_vat_percent
      : defaults.vendorVatRegistered
        ? defaults.vendorVatRate
        : 0;

  return buildLineVatPayload({
    revenue_before_vat: revenueBeforeVat,
    usage_rights_amount: parsed.usage_rights_amount ?? 0,
    usage_rights_cost: parsed.usage_rights_cost ?? 0,
    agency_fee_percent: parsed.agency_fee_percent ?? 0,
    revenue_vat_percent: revenueVatPercent,
    revenue_vat_exempt: revenueExempt,
    cost_before_vat: costBeforeVat,
    cost_vat_percent: costVatPercent,
    cost_vat_exempt: costExempt || !defaults.vendorVatRegistered,
  });
}

export function deliverableStatusTimestamps(status: string): Record<string, string | null> {
  const timestamps: Record<string, string | null> = {};
  if (status === "submitted") {
    timestamps.submitted_at = new Date().toISOString();
  }
  if (status === "approved") {
    timestamps.approved_at = new Date().toISOString();
  }
  if (status === "published") {
    timestamps.published_at = new Date().toISOString();
  }
  return timestamps;
}

export function aggregateCampaignKpis(
  headers: { id: string; status: string; currency_code: string | null }[],
  lines: { campaign_header_id: string; revenue: number | null; profit: number | null }[],
  assignments: { id: string; campaign_header_id: string | null }[]
) {
  const operationalHeaderIds = new Set(
    headers.filter((h) => !isCancelledCampaignStatus(h.status)).map((h) => h.id)
  );
  const operationalLines = lines.filter((l) =>
    operationalHeaderIds.has(l.campaign_header_id)
  );
  const totalRevenue = operationalLines.reduce(
    (sum, l) => sum + Number(l.revenue ?? 0),
    0
  );
  const totalProfit = operationalLines.reduce(
    (sum, l) => sum + Number(l.profit ?? 0),
    0
  );
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const currencyCounts = new Map<string, number>();
  for (const header of headers.filter((h) => !isCancelledCampaignStatus(h.status))) {
    const code = header.currency_code ?? DEFAULT_PLATFORM_CURRENCY;
    currencyCounts.set(code, (currencyCounts.get(code) ?? 0) + 1);
  }
  const currencyCode =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    DEFAULT_PLATFORM_CURRENCY;

  const assignmentCount = assignments.filter(
    (a) => a.campaign_header_id && operationalHeaderIds.has(a.campaign_header_id)
  ).length;

  return {
    total_campaigns: operationalHeaderIds.size,
    total_revenue: totalRevenue,
    avg_margin: avgMargin,
    assignments: assignmentCount,
    currency_code: currencyCode,
  };
}
