/**
 * Pure quotation document model (no DB, no rendering deps). Maps a
 * QuotationDetail into the rows + summary that every export format renders.
 * Reporting currency is EGP; per-creator cost shows entry + EGP dual values.
 */
import { formatDualCurrency, REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import type { QuotationDetail, QuotationItemRow } from "../types";

export type QuotationDocRow = {
  creator: string;
  platform: string;
  followers: string;
  engagementRate: string;
  country: string;
  deliverables: string;
  cost: string;
  revenue: string;
  currency: string;
};

export type QuotationDocument = {
  serial: string;
  name: string;
  status: string;
  clientName: string;
  brandName: string;
  campaignName: string;
  dateLabel: string;
  rows: QuotationDocRow[];
  summary: {
    totalCost: string;
    totalRevenue: string;
    totalGpValue: string;
    totalGpPct: string;
  };
  notes: string | null;
  terms: string | null;
  preparedByName: string | null;
  clientSignatureName: string | null;
};

const num = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0);

function deliverablesLabel(item: QuotationItemRow): string {
  if (!item.deliverables.length) return "—";
  return item.deliverables
    .map((d) => `${d.quantity}× ${d.platform} ${d.type}`.trim())
    .join(", ");
}

export function buildQuotationDocument(detail: QuotationDetail): QuotationDocument {
  const rows: QuotationDocRow[] = detail.items.map((item) => ({
    creator: item.creator_name ?? item.handle ?? "Creator",
    platform: item.platform ?? "—",
    followers: item.followers != null ? num(item.followers) : "—",
    engagementRate:
      item.engagement_rate != null ? `${num(item.engagement_rate, 2)}%` : "—",
    country: item.country_code ?? "—",
    deliverables: deliverablesLabel(item),
    cost: formatDualCurrency({
      amount: item.cost,
      currency: item.cost_currency,
      egpAmount: item.cost_egp,
    }),
    revenue: formatDualCurrency({
      amount: item.revenue,
      currency: item.cost_currency,
      egpAmount: item.revenue_egp,
    }),
    currency: item.cost_currency,
  }));

  return {
    serial: detail.serial_number ?? "QT-PENDING",
    name: detail.name,
    status: detail.status,
    clientName: detail.client_name ?? "—",
    brandName: detail.brand_name ?? "—",
    campaignName: detail.campaign_name ?? "—",
    dateLabel: new Date(detail.created_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    rows,
    summary: {
      totalCost: `${num(detail.total_cost_egp, 2)} ${REPORTING_CURRENCY}`,
      totalRevenue: `${num(detail.total_revenue_egp, 2)} ${REPORTING_CURRENCY}`,
      totalGpValue: `${num(detail.total_gp_value_egp, 2)} ${REPORTING_CURRENCY}`,
      totalGpPct: `${num(detail.total_gp_pct, 2)}%`,
    },
    notes: detail.notes,
    terms: detail.terms,
    preparedByName: detail.prepared_by_name,
    clientSignatureName: detail.client_signature_name,
  };
}
