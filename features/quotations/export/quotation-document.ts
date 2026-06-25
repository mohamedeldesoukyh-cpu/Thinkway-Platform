/**
 * Pure quotation document model (no DB, no rendering deps).
 */
import { formatDualCurrency, REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import { QUOTATION_STATUS_LABELS } from "@/features/quotations/constants";
import { parseQuotationTermsText } from "@/features/quotations/quotation-default-terms";
import { gpHealthExportColor } from "@/features/quotations/quotation-gp-health";
import {
  formatDateLabel,
  formatValidityLabel,
  isQuotationExpired,
} from "@/features/quotations/quotation-validity";
import type { QuotationDetail, QuotationItemRow } from "../types";

export type QuotationDocRow = {
  creator: string;
  platform: string;
  followers: string;
  engagementRate: string;
  country: string;
  deliverables: string;
  unitCost: string;
  revenue: string;
  gp: string;
  gpPct: string;
  currency: string;
};

export type QuotationDocumentKpi = {
  label: string;
  value: string;
};

export type QuotationDocument = {
  serial: string;
  name: string;
  status: string;
  statusLabel: string;
  isExpired: boolean;
  validityLabel: string;
  clientName: string;
  brandName: string;
  campaignName: string;
  issueDateLabel: string;
  validityDateLabel: string;
  version: string;
  department: string;
  preparedByName: string;
  reviewedByName: string;
  approvedByLabel: string;
  preparedForLine: string;
  dateLabel: string;
  rows: QuotationDocRow[];
  commercialKpis: QuotationDocumentKpi[];
  summary: {
    totalCost: string;
    totalRevenue: string;
    totalGpValue: string;
    totalGpPct: string;
    gpColor: string;
    creatorCount: number;
    estimatedReach: string;
    estimatedEngagement: string;
  };
  notes: string | null;
  termsSections: Array<{ title: string; body: string }>;
  preparedByNameSignature: string | null;
  clientSignatureName: string | null;
  revisionLine: string | null;
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
  const expired = detail.is_expired || isQuotationExpired(detail.validity_date);
  const statusLabel =
    expired && detail.status === "draft"
      ? "Expired"
      : QUOTATION_STATUS_LABELS[detail.status] ?? detail.status;

  const rows: QuotationDocRow[] = detail.items.map((item) => ({
    creator: item.creator_name ?? item.handle ?? "Creator",
    platform: item.platform ?? "—",
    followers: item.followers != null ? num(item.followers) : "—",
    engagementRate:
      item.engagement_rate != null ? `${num(item.engagement_rate, 2)}%` : "—",
    country: item.country_code ?? "—",
    deliverables: deliverablesLabel(item),
    unitCost: formatDualCurrency({
      amount: item.cost,
      currency: item.cost_currency,
      egpAmount: item.cost_egp,
    }),
    revenue: formatDualCurrency({
      amount: item.revenue,
      currency: item.cost_currency,
      egpAmount: item.revenue_egp,
    }),
    gp: `${num(item.gp_value_egp, 2)} ${REPORTING_CURRENCY}`,
    gpPct: `${num(item.gp_pct, 1)}%`,
    currency: item.cost_currency,
  }));

  const gpColor = gpHealthExportColor({
    gpValueEgp: detail.total_gp_value_egp,
    gpPct: detail.total_gp_pct,
    targetPct: detail.gp_target_pct,
  });

  const avgEr =
    detail.estimated_engagement_rate != null
      ? `${num(detail.estimated_engagement_rate, 2)}%`
      : "—";

  return {
    serial: detail.serial_number ?? "QT-PENDING",
    name: detail.name,
    status: detail.status,
    statusLabel,
    isExpired: expired,
    validityLabel: formatValidityLabel(detail.validity_date),
    clientName: detail.client_name ?? "—",
    brandName: detail.brand_name ?? "—",
    campaignName: detail.campaign_name ?? "—",
    issueDateLabel: formatDateLabel(detail.issue_date),
    validityDateLabel: formatDateLabel(detail.validity_date),
    version: detail.version || "v1.0",
    department: detail.department ?? "Influencer Marketing",
    preparedByName: detail.prepared_by_name ?? detail.owner_name ?? "—",
    reviewedByName: detail.reviewed_by_name ?? "—",
    approvedByLabel: detail.approved_at
      ? formatDateLabel(detail.approved_at.slice(0, 10))
      : "Pending",
    preparedForLine: detail.client_name
      ? `Prepared exclusively for ${detail.client_name}`
      : "Prepared exclusively for the named Client",
    dateLabel: formatDateLabel(detail.issue_date),
    rows,
    commercialKpis: [
      { label: "Creators", value: String(detail.items.length) },
      { label: "Est. Reach", value: num(detail.estimated_reach) },
      { label: "Est. Engagement", value: avgEr },
      { label: "Total Cost", value: `${num(detail.total_cost_egp, 2)} ${REPORTING_CURRENCY}` },
      { label: "Total Revenue", value: `${num(detail.total_revenue_egp, 2)} ${REPORTING_CURRENCY}` },
      {
        label: "Gross Profit",
        value: `${num(detail.total_gp_value_egp, 2)} ${REPORTING_CURRENCY}`,
      },
      { label: "GP %", value: `${num(detail.total_gp_pct, 1)}%` },
    ],
    summary: {
      totalCost: `${num(detail.total_cost_egp, 2)} ${REPORTING_CURRENCY}`,
      totalRevenue: `${num(detail.total_revenue_egp, 2)} ${REPORTING_CURRENCY}`,
      totalGpValue: `${num(detail.total_gp_value_egp, 2)} ${REPORTING_CURRENCY}`,
      totalGpPct: `${num(detail.total_gp_pct, 1)}%`,
      gpColor,
      creatorCount: detail.items.length,
      estimatedReach: num(detail.estimated_reach),
      estimatedEngagement: avgEr,
    },
    notes: detail.notes,
    termsSections: parseQuotationTermsText(detail.terms),
    preparedByNameSignature: detail.prepared_by_name,
    clientSignatureName: detail.client_signature_name,
    revisionLine: detail.revisions[0]
      ? `${detail.revisions[0].version} · ${detail.revisions[0].updated_by_name ?? "System"} · ${formatDateLabel(detail.revisions[0].created_at.slice(0, 10))}${detail.revisions[0].change_summary ? ` — ${detail.revisions[0].change_summary}` : ""}`
      : `${detail.version} · Initial issue`,
  };
}
