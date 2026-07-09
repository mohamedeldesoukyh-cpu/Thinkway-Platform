/**
 * Pure quotation document model (no DB, no rendering deps).
 */
import { formatDualCurrency, REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import {
  QUOTATION_CLIENT_LABELS,
  QUOTATION_STATUS_LABELS,
} from "@/features/quotations/constants";
import { parseQuotationTermsText } from "@/features/quotations/quotation-default-terms";
import { gpHealthExportColor } from "@/features/quotations/quotation-gp-health";
import {
  formatDateLabel,
  formatValidityLabel,
  isQuotationExpired,
} from "@/features/quotations/quotation-validity";
import type { QuotationDetail, QuotationItemRow } from "../types";
import {
  countUniqueQuotationCreators,
  exportItemPlatformIcons,
  exportItemServiceDescription,
  exportItemTierLabel,
  exportItemTypeLabel,
  groupQuotationExportItems,
  optionNumberLabel,
  resolveExportCreatorProfile,
  type QuotationExportItem,
} from "./quotation-export-utils";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { resolveExportAvatarProxyUrl } from "./quotation-export-avatars";
import {
  isLumpSumPricingTemplate,
  isShowcaseTemplate,
  type QuotationTemplateVariant,
} from "./quotation-template";

export type QuotationDocumentAudience = "client" | "internal";

/** Recent post screenshot for Showcase creator pages (stored thumbnail URLs). */
export type QuotationDocPublicationShot = {
  imageUrl: string;
  postUrl: string | null;
  caption: string | null;
  /** True for reels, TikTok videos, YouTube, etc. */
  isVideo?: boolean;
  /** Same-origin proxy when CDN embed fails (preview/PDF fallback). */
  imageProxyUrl?: string | null;
};

export type QuotationDocCreatorGroup = {
  creatorKey: string;
  creator: string;
  handle: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  avatarProxyUrl: string | null;
  platform: string | null;
  linkedPlatforms: string[];
  followers: string;
  engagementRate: string;
  country: string;
  categories: string[];
  isVerified: boolean;
  optionCount: number;
  /** Showcase only — recent publication screenshots when available. */
  publicationShots: QuotationDocPublicationShot[];
  rows: QuotationDocRow[];
};

export type QuotationDocRow = {
  creator: string;
  option: string;
  platform: string;
  platformIcons: string[];
  allPlatforms: boolean;
  followers: string;
  engagementRate: string;
  country: string;
  deliverables: string;
  serviceDescription: string;
  tier: string;
  type: string;
  /** Internal only — unit influencer cost. */
  unitCost?: string;
  /** Client cost (revenue). */
  clientCost: string;
  /** Internal only. */
  gp?: string;
  gpPct?: string;
  gpColor?: string;
  af: string;
  afPct: string;
  currency: string;
};

export type QuotationDocumentKpi = {
  label: string;
  value: string;
  valueColor?: string;
};

export type QuotationDocument = {
  audience: QuotationDocumentAudience;
  template: QuotationTemplateVariant;
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
  creatorGroups: QuotationDocCreatorGroup[];
  commercialKpis: QuotationDocumentKpi[];
  summary: {
    totalCost?: string;
    totalClientCost: string;
    totalGpValue?: string;
    totalGpPct?: string;
    gpColor?: string;
    totalAf: string;
    grandTotal: string;
    totalAgencyMargin: string;
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

function buildDocRow(
  item: QuotationExportItem,
  audience: QuotationDocumentAudience,
  gpTargetPct: number | null | undefined
): QuotationDocRow {
  const rowGpColor = gpHealthExportColor({
    gpValueEgp: item.gp_value_egp,
    gpPct: item.gp_pct,
    targetPct: gpTargetPct ?? undefined,
  });
  const platformFields = exportItemPlatformIcons(item);

  const row: QuotationDocRow = {
    creator: item.creator_name ?? item.handle ?? "Creator",
    option: optionNumberLabel(item.option_number),
    platform: item.platform ?? "—",
    platformIcons: platformFields.platformIcons,
    allPlatforms: platformFields.allPlatforms,
    followers: item.followers != null ? num(item.followers) : "—",
    engagementRate:
      item.engagement_rate != null ? `${num(item.engagement_rate, 2)}%` : "—",
    country: item.country_code ?? "—",
    deliverables: deliverablesLabel(item),
    serviceDescription: exportItemServiceDescription(item),
    tier: exportItemTierLabel(item),
    type: exportItemTypeLabel(item),
    clientCost: formatDualCurrency({
      amount: item.revenue,
      currency: item.cost_currency,
      egpAmount: item.revenue_egp,
    }),
    af: formatDualCurrency({
      amount: item.af_value,
      currency: item.cost_currency,
      egpAmount: item.af_value_egp,
    }),
    afPct: `${num(item.af_pct, 1)}%`,
    currency: item.cost_currency,
  };

  if (audience === "internal") {
    row.unitCost = formatDualCurrency({
      amount: item.cost,
      currency: item.cost_currency,
      egpAmount: item.cost_egp,
    });
    row.gp = `${num(item.gp_value_egp, 2)} ${REPORTING_CURRENCY}`;
    row.gpPct = `${num(item.gp_pct, 1)}%`;
    row.gpColor = rowGpColor;
  }

  return row;
}

function buildCreatorGroup(
  group: ReturnType<typeof groupQuotationExportItems>[number],
  audience: QuotationDocumentAudience,
  gpTargetPct: number | null | undefined,
  publicationShotsByCreatorKey?: Map<string, QuotationDocPublicationShot[]>
): QuotationDocCreatorGroup {
  const headerItem = group.items[0]!;
  const profile = resolveExportCreatorProfile(headerItem);
  const profileSource = buildQuotationCreatorProfileSource(headerItem);

  return {
    creatorKey: group.creatorKey,
    creator: profile.creator,
    handle: profile.handle,
    profileUrl: profile.profileUrl,
    avatarUrl: profile.avatarUrl,
    avatarProxyUrl: resolveExportAvatarProxyUrl(
      headerItem,
      profile.profileUrl,
      profile.avatarUrl
    ),
    platform: profile.platform,
    linkedPlatforms: profile.linkedPlatforms,
    followers: headerItem.followers != null ? num(headerItem.followers) : "—",
    engagementRate:
      headerItem.engagement_rate != null
        ? `${num(headerItem.engagement_rate, 2)}%`
        : "—",
    country: headerItem.country_code ?? "—",
    categories: headerItem.creator_categories ?? [],
    isVerified: Boolean(profileSource.isVerified),
    optionCount: group.items.length,
    publicationShots: publicationShotsByCreatorKey?.get(group.creatorKey) ?? [],
    rows: group.items.map((item) => buildDocRow(item, audience, gpTargetPct)),
  };
}

export function buildQuotationDocument(
  detail: QuotationDetail,
  options?: {
    audience?: QuotationDocumentAudience;
    template?: QuotationTemplateVariant;
    /** Showcase: preloaded publication screenshot map keyed by creator duplicate key. */
    publicationShotsByCreatorKey?: Map<string, QuotationDocPublicationShot[]>;
  }
): QuotationDocument {
  const audience = options?.audience ?? "client";
  const template = options?.template ?? "detailed";
  const publicationShotsByCreatorKey = isShowcaseTemplate(template)
    ? options?.publicationShotsByCreatorKey
    : undefined;
  const items = detail.items as QuotationExportItem[];
  const expired = detail.is_expired || isQuotationExpired(detail.validity_date);
  const statusLabel =
    expired && detail.status === "draft"
      ? "Expired"
      : QUOTATION_STATUS_LABELS[detail.status] ?? detail.status;

  const creatorGroups = groupQuotationExportItems(items).map((group) =>
    buildCreatorGroup(group, audience, detail.gp_target_pct, publicationShotsByCreatorKey)
  );
  const rows = creatorGroups.flatMap((group) => group.rows);
  const uniqueCreatorCount = countUniqueQuotationCreators(items);

  const gpColor = gpHealthExportColor({
    gpValueEgp: detail.total_gp_value_egp,
    gpPct: detail.total_gp_pct,
    targetPct: detail.gp_target_pct,
  });

  const avgEr =
    detail.estimated_engagement_rate != null
      ? `${num(detail.estimated_engagement_rate, 2)}%`
      : "—";

  const totalClientCost = `${num(detail.total_revenue_egp, 2)} ${REPORTING_CURRENCY}`;
  const totalAf = `${num(detail.total_af_egp, 2)} ${REPORTING_CURRENCY}`;
  const totalAgencyMargin = `${num(detail.total_agency_margin_egp, 2)} ${REPORTING_CURRENCY}`;
  const grandTotal = `${num(detail.total_revenue_egp + detail.total_af_egp, 2)} ${REPORTING_CURRENCY}`;

  const clientKpis: QuotationDocumentKpi[] = [
    { label: "Creators", value: String(uniqueCreatorCount) },
    { label: "Est. Reach", value: num(detail.estimated_reach) },
    { label: "Est. Engagement", value: avgEr },
    ...(template === "showcase"
      ? []
      : isLumpSumPricingTemplate(template)
        ? [
            { label: QUOTATION_CLIENT_LABELS.lumpSumCost, value: totalClientCost },
            { label: QUOTATION_CLIENT_LABELS.totalAgencyFee, value: totalAf },
            { label: QUOTATION_CLIENT_LABELS.totalCost, value: grandTotal },
          ]
        : [{ label: QUOTATION_CLIENT_LABELS.totalAgencyFee, value: totalAf }]),
  ];

  const internalKpis: QuotationDocumentKpi[] = [
    ...clientKpis.slice(0, 3),
    { label: "Total Cost", value: `${num(detail.total_cost_egp, 2)} ${REPORTING_CURRENCY}` },
    ...clientKpis.slice(3),
    {
      label: "Gross Profit",
      value: `${num(detail.total_gp_value_egp, 2)} ${REPORTING_CURRENCY}`,
      valueColor: gpColor,
    },
    { label: "GP %", value: `${num(detail.total_gp_pct, 1)}%`, valueColor: gpColor },
  ];

  return {
    audience,
    template,
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
    creatorGroups,
    commercialKpis: audience === "internal" ? internalKpis : clientKpis,
    summary: {
      ...(audience === "internal"
        ? {
            totalCost: `${num(detail.total_cost_egp, 2)} ${REPORTING_CURRENCY}`,
            totalGpValue: `${num(detail.total_gp_value_egp, 2)} ${REPORTING_CURRENCY}`,
            totalGpPct: `${num(detail.total_gp_pct, 1)}%`,
            gpColor,
          }
        : {}),
      totalClientCost,
      totalAf,
      grandTotal,
      totalAgencyMargin,
      creatorCount: uniqueCreatorCount,
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
