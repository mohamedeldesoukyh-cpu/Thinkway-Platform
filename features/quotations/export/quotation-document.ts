/**
 * Pure quotation document model (no DB, no rendering deps).
 */
import { formatDualCurrency, REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import {
  COLLAPSE_CONTENT_LABEL,
  collapseContentPreviewLabel,
} from "@/lib/discovery/collapse-content";
import {
  QUOTATION_CLIENT_LABELS,
  resolveQuotationStatusLabel,
} from "@/features/quotations/constants";
import { parseQuotationTermsText } from "@/features/quotations/quotation-default-terms";
import { gpHealthExportColor } from "@/features/quotations/quotation-gp-health";
import {
  formatDateLabel,
  formatValidityLabel,
  isQuotationExpired,
} from "@/features/quotations/quotation-validity";
import type { QuotationDetail, QuotationItemRow } from "../types";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { deliverableTypeLines } from "@/lib/quotations/quotation-deliverable-types";
import { optimizeQuotationCampaign } from "@/lib/quotations/quotation-optimization";
import { evaluateQuotationDecision } from "@/lib/quotations/quotation-decision";
import {
  computeCampaignForecastFromProfiles,
  forecastCreator,
  quotationItemsToForecastProfiles,
  type CampaignForecastDeliverableInput,
} from "@/lib/campaign-forecast";
import {
  buildQuotationMainCategoryBreakdown,
  formatQuotationMainCategoryLabels,
  resolveQuotationCreatorMainCategories,
} from "@/lib/quotations/quotation-creator-categories";
import {
  countUniqueQuotationCreators,
  exportItemPlatformIcons,
  exportItemServiceDescription,
  exportItemTierLabel,
  exportItemTypeLabel,
  formatCreatorHandle,
  groupQuotationExportItems,
  optionNumberLabel,
  quotationCreatorDuplicateKey,
  resolveExportCreatorProfile,
  resolveExportGroupEngagementRate,
  resolveExportGroupFollowers,
  resolveExportGroupPlatform,
  resolveExportItemCreatorCategories,
  type QuotationExportItem,
} from "./quotation-export-utils";
import {
  collapsePackageCreatorSignature,
  collapsePackageGroupItems,
  collapsePackageLeaderItem,
  collapsePackageOptionNumber,
} from "@/lib/quotations/quotation-collapse-package";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { resolveExportAvatarProxyUrl } from "./quotation-export-avatars";
import {
  isLumpSumPricingTemplate,
  isCreatorDeckTemplate,
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

export type QuotationDocCollapsePackageCreator = {
  creator: string;
  handle: string;
  platform: string;
  platformIcons: string[];
  avatarUrl: string | null;
  avatarProxyUrl: string | null;
  profileUrl: string | null;
  followers: string;
  engagementRate: string;
  tier: string;
};

export type QuotationDocCollapsePackage = {
  collapseGroupId: string;
  optionLabel: string;
  optionNumber: number;
  serviceDescription: string;
  type: string;
  /** Human-readable platform labels (fallback). */
  platforms: string;
  platformIcons: string[];
  deliverables: string;
  clientCost: string;
  creators: QuotationDocCollapsePackageCreator[];
};

export type QuotationDocCollapseContentGroup = {
  bundleKey: string;
  label: string;
  previewLabel: string;
  optionCount: number;
  packages: QuotationDocCollapsePackage[];
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
  /** Collap package follower rows are identity-only and excluded from commercial tables. */
  isCollapsePackageFollower?: boolean;
  isCollapsePackageLeader?: boolean;
  collapseOptionLabel?: string | null;
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

export type QuotationDocumentBreakdown = {
  label: string;
  count: number;
  sharePct: string;
};

export type QuotationDocumentTierRow = {
  handle: string;
  platform: string;
  followers: string;
  category: string;
  engagementRate: string;
  estimatedReach: string;
};

export type QuotationDocumentTierSection = {
  tier: CreatorTierLabel;
  sectionLabel: string;
  profileCount: number;
  totalFollowersLabel: string;
  estimatedReachLabel: string;
  reachSharePct: string;
  avgEngagementRate: string;
  creators: QuotationDocumentTierRow[];
  subtotalLabel: string;
  subtotalFollowers: string;
  subtotalEngagementRate: string;
  subtotalEstimatedReach: string;
};

export type QuotationDocumentFullTierBreakdown = {
  title: string;
  sections: QuotationDocumentTierSection[];
  grandTotalLabel: string;
  grandTotalFollowers: string;
  grandTotalEstimatedReach: string;
  grandTotalEngagementRate: string;
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
  collapseContentGroups: QuotationDocCollapseContentGroup[];
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
    audienceSize: string;
    estimatedReach: string;
    estimatedEngagement: string;
    categoryBreakdown: QuotationDocumentBreakdown[];
    tierBreakdown: QuotationDocumentBreakdown[];
    fullTierBreakdown: QuotationDocumentFullTierBreakdown;
    insightBullets: string[];
    campaignHealthScore?: number;
    campaignDecisionScore?: number;
    launchReadiness?: string | null;
    topDecisionRecommendation?: string | null;
    topOptimizationRecommendation?: string | null;
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

const TIER_SECTION_ORDER: CreatorTierLabel[] = [
  "Celebrity",
  "Mega",
  "Macro",
  "Mid",
  "Micro",
  "Nano",
  "Unknown",
];

const TIER_SECTION_LABEL: Record<CreatorTierLabel, string> = {
  Celebrity: "CELEBRITY",
  Mega: "MEGA",
  Macro: "MACRO",
  Mid: "MID",
  Micro: "MICRO",
  Nano: "NANO",
  Unknown: "UNKNOWN",
};

function exportHandleLabel(handle: string | null | undefined): string {
  const trimmed = handle?.trim().replace(/^@/, "") ?? "";
  return trimmed || "—";
}

function exportPlatformLabel(platform: string | null | undefined): string {
  const trimmed = platform?.trim();
  if (!trimmed) return "—";
  const key = trimmed.toLowerCase();
  if (key === "instagram") return "Instagram";
  if (key === "tiktok") return "TikTok";
  if (key === "facebook") return "Facebook";
  if (key === "youtube") return "YouTube";
  if (key === "snapchat") return "Snapchat";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function exportEngagementRateLabel(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${num(rate, 2)}%`;
}

function deliverablesFromExportItems(
  items: QuotationExportItem[]
): CampaignForecastDeliverableInput[] {
  const deliverables: CampaignForecastDeliverableInput[] = [];
  for (const item of items) {
    for (const deliverable of item.deliverables ?? []) {
      for (const line of deliverableTypeLines(deliverable)) {
        if (!line.type.trim()) continue;
        deliverables.push({
          contentType: line.type,
          platform: deliverable.platform ?? item.platform,
          quantity: line.quantity,
        });
      }
    }
  }
  return deliverables;
}

function exportGroupEstimatedReach(input: {
  followers: number | null;
  platform: string | null;
  engagementRate?: number | null;
  deliverables?: CampaignForecastDeliverableInput[];
}): number | null {
  const platform =
    input.platform ?? (input.followers != null ? "instagram" : null);
  const forecast = forecastCreator(
    {
      creatorKey: "export",
      followers: input.followers,
      platform,
      engagementRate: input.engagementRate ?? null,
      deliverables: input.deliverables,
    },
    null
  );
  return forecast?.estimatedReach ?? null;
}

function averageFinite(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildQuotationFullTierBreakdown(input: {
  groups: ReturnType<typeof groupQuotationExportItems>;
  campaignName: string;
}): QuotationDocumentFullTierBreakdown {
  type CreatorEntry = {
    tier: CreatorTierLabel;
    handle: string;
    platform: string;
    followers: number | null;
    followersLabel: string;
    category: string;
    engagementRate: number | null;
    engagementRateLabel: string;
    estimatedReach: number | null;
    estimatedReachLabel: string;
  };

  const entries: CreatorEntry[] = input.groups.map((group) => {
    const headerItem = group.items[0]!;
    const platform = resolveExportGroupPlatform(group.items);
    const followers = resolveExportGroupFollowers(group.items);
    const engagementRate = resolveExportGroupEngagementRate(group.items, followers);
    const deliverables = deliverablesFromExportItems(group.items);
    const tier = resolveCreatorTierLabel({ followers });
    const estimatedReach = exportGroupEstimatedReach({
      followers,
      platform,
      engagementRate,
      deliverables: deliverables.length ? deliverables : undefined,
    });
    const mainCategories = resolveQuotationCreatorMainCategories(
      mergeCreatorGroupCategories(group.items)
    );

    return {
      tier,
      handle: exportHandleLabel(headerItem.handle),
      platform: exportPlatformLabel(platform),
      followers,
      followersLabel:
        followers != null ? formatCreatorCount(followers) : "—",
      category: formatQuotationMainCategoryLabels(mainCategories),
      engagementRate,
      engagementRateLabel: exportEngagementRateLabel(engagementRate),
      estimatedReach,
      estimatedReachLabel:
        estimatedReach != null ? formatCreatorCount(estimatedReach) : "—",
    };
  });

  const totalEstimatedReach = entries.reduce(
    (sum, entry) => sum + (entry.estimatedReach ?? 0),
    0
  );

  const sections: QuotationDocumentTierSection[] = TIER_SECTION_ORDER.flatMap(
    (tier) => {
      const creators = entries
        .filter((entry) => entry.tier === tier)
        .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));

      if (!creators.length) return [];

      const totalFollowers = creators.reduce(
        (sum, entry) => sum + (entry.followers ?? 0),
        0
      );
      const sectionReach = creators.reduce(
        (sum, entry) => sum + (entry.estimatedReach ?? 0),
        0
      );
      const engagementRates = creators
        .map((entry) => entry.engagementRate)
        .filter((value): value is number => value != null && Number.isFinite(value));
      const avgEr = averageFinite(engagementRates);

      return [
        {
          tier,
          sectionLabel: TIER_SECTION_LABEL[tier],
          profileCount: creators.length,
          totalFollowersLabel: formatCreatorCount(totalFollowers),
          estimatedReachLabel: formatCreatorCount(sectionReach),
          reachSharePct:
            totalEstimatedReach > 0
              ? `${num((sectionReach / totalEstimatedReach) * 100, 1)}%`
              : "0.0%",
          avgEngagementRate: exportEngagementRateLabel(avgEr),
          creators: creators.map((entry) => ({
            handle: entry.handle,
            platform: entry.platform,
            followers: entry.followersLabel,
            category: entry.category,
            engagementRate: entry.engagementRateLabel,
            estimatedReach: entry.estimatedReachLabel,
          })),
          subtotalLabel: `Subtotal: ${creators.length} influencer${creators.length === 1 ? "" : "s"}`,
          subtotalFollowers: formatCreatorCount(totalFollowers),
          subtotalEngagementRate: exportEngagementRateLabel(avgEr),
          subtotalEstimatedReach: formatCreatorCount(sectionReach),
        },
      ];
    }
  );

  const grandTotalFollowers = entries.reduce(
    (sum, entry) => sum + (entry.followers ?? 0),
    0
  );
  const grandTotalEngagementRates = entries
    .map((entry) => entry.engagementRate)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const grandTotalAvgEr = averageFinite(grandTotalEngagementRates);
  const campaignLabel =
    input.campaignName.trim() && input.campaignName !== "—"
      ? input.campaignName.trim()
      : "Campaign";

  return {
    title: `${campaignLabel.toUpperCase()} | FULL INFLUENCER BREAKDOWN BY TIER`,
    sections,
    grandTotalLabel: `GRAND TOTAL | ${entries.length} Influencer${entries.length === 1 ? "" : "s"}`,
    grandTotalFollowers: formatCreatorCount(grandTotalFollowers),
    grandTotalEstimatedReach: formatCreatorCount(totalEstimatedReach),
    grandTotalEngagementRate: exportEngagementRateLabel(grandTotalAvgEr),
  };
}

function buildBreakdown(
  entries: string[],
  totalCreators: number
): QuotationDocumentBreakdown[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const label = entry.trim() || "Uncategorized";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      sharePct: totalCreators > 0 ? `${num((count / totalCreators) * 100, 1)}%` : "0.0%",
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildSummaryInsightBullets(input: {
  creatorCount: number;
  categoryBreakdown: QuotationDocumentBreakdown[];
  tierBreakdown: QuotationDocumentBreakdown[];
  estimatedEngagement: string;
}): string[] {
  const bullets: string[] = [];
  const topCategories = input.categoryBreakdown.slice(0, 3);
  const topTiers = input.tierBreakdown.slice(0, 3);

  if (topCategories.length > 0) {
    bullets.push(
      `Category mix: ${topCategories
        .map((item) => `${item.label} ${item.count}`)
        .join(" · ")}.`
    );
  }

  if (topTiers.length > 0) {
    bullets.push(
      `Tier mix: ${topTiers.map((item) => `${item.label} ${item.count}`).join(" · ")}.`
    );
  }

  if (input.creatorCount > 0) {
    bullets.push(
      `Campaign scale: ${input.creatorCount} creator${input.creatorCount === 1 ? "" : "s"} with average ER ${input.estimatedEngagement}.`
    );
  }

  return bullets;
}

function deliverablesLabel(item: QuotationExportItem): string {
  return exportItemTypeLabel(item);
}

function exportPlatformDisplayLabel(
  item: QuotationExportItem,
  platformFields: ReturnType<typeof exportItemPlatformIcons>
): string {
  if (platformFields.allPlatforms) return "All platforms";
  if (platformFields.platformIcons.length > 1) {
    return platformFields.platformIcons
      .map((platform) => platformLabel(platform))
      .join(" + ");
  }
  if (platformFields.platformIcons.length === 1) {
    return platformLabel(platformFields.platformIcons[0]!);
  }
  const raw = item.platform?.trim();
  return raw ? platformLabel(raw) : "—";
}

function buildDocRow(
  item: QuotationExportItem,
  audience: QuotationDocumentAudience,
  gpTargetPct: number | null | undefined,
  allItems?: readonly QuotationExportItem[]
): QuotationDocRow {
  const rowGpColor = gpHealthExportColor({
    gpValueEgp: item.gp_value_egp,
    gpPct: item.gp_pct,
    targetPct: gpTargetPct ?? undefined,
  });
  const platformFields = exportItemPlatformIcons(item);
  const collapseGroupId = item.collapse_group_id ?? null;
  const collapseMembers =
    collapseGroupId && allItems
      ? collapsePackageGroupItems([...allItems], collapseGroupId)
      : [];
  const isCollapsePackageLeader =
    collapseMembers.length > 0 &&
    collapsePackageLeaderItem(collapseMembers).id === item.id;
  const isCollapsePackageFollower =
    collapseMembers.length > 0 && !isCollapsePackageLeader;
  const collapseOptionLabel =
    collapseMembers.length > 0
      ? optionNumberLabel(collapsePackageOptionNumber(allItems ?? [], collapseMembers))
      : null;

  const row: QuotationDocRow = {
    creator: item.creator_name ?? item.handle ?? "Creator",
    option: optionNumberLabel(item.option_number),
    platform: exportPlatformDisplayLabel(item, platformFields),
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
    isCollapsePackageFollower,
    isCollapsePackageLeader,
    collapseOptionLabel,
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

function mergeCreatorGroupCategories(items: QuotationExportItem[]): string[] {
  const merged = new Set<string>();
  for (const item of items) {
    for (const category of resolveExportItemCreatorCategories(item)) {
      merged.add(category);
    }
  }
  return [...merged].slice(0, 3);
}

function buildCreatorGroup(
  group: ReturnType<typeof groupQuotationExportItems>[number],
  audience: QuotationDocumentAudience,
  gpTargetPct: number | null | undefined,
  allItems: QuotationExportItem[],
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
    categories: mergeCreatorGroupCategories(group.items),
    isVerified: Boolean(profileSource.isVerified),
    optionCount: group.items.length,
    publicationShots: publicationShotsByCreatorKey?.get(group.creatorKey) ?? [],
    rows: group.items.map((item) => buildDocRow(item, audience, gpTargetPct, allItems)),
  };
}

function buildCollapsePackageCreator(item: QuotationExportItem): QuotationDocCollapsePackageCreator {
  const profile = resolveExportCreatorProfile(item);
  const platformFields = exportItemPlatformIcons(item);
  return {
    creator: profile.creator,
    handle: formatCreatorHandle(item.handle),
    platform: profile.platform ?? item.platform ?? "—",
    platformIcons: platformFields.platformIcons,
    avatarUrl: profile.avatarUrl,
    avatarProxyUrl: resolveExportAvatarProxyUrl(item, profile.profileUrl, profile.avatarUrl),
    profileUrl: profile.profileUrl,
    followers: item.followers != null ? num(item.followers) : "—",
    engagementRate:
      item.engagement_rate != null ? `${num(item.engagement_rate, 2)}%` : "—",
    tier: exportItemTierLabel(item),
  };
}

function buildCollapsePackage(
  groupItems: QuotationExportItem[],
  allItems: QuotationExportItem[],
  audience: QuotationDocumentAudience,
  gpTargetPct: number | null | undefined
): QuotationDocCollapsePackage {
  const leader = collapsePackageLeaderItem(groupItems);
  const leaderRow = buildDocRow(leader as QuotationExportItem, audience, gpTargetPct, allItems);
  const leaderPlatformFields = exportItemPlatformIcons(leader as QuotationExportItem);

  return {
    collapseGroupId: groupItems[0]!.collapse_group_id!,
    optionLabel: optionNumberLabel(collapsePackageOptionNumber(allItems, groupItems)),
    optionNumber: collapsePackageOptionNumber(allItems, groupItems),
    serviceDescription: leaderRow.serviceDescription,
    type: leaderRow.type,
    /** Package deliverable platform (leader line) — not a union of every creator profile. */
    platforms: leaderRow.platform,
    platformIcons: leaderPlatformFields.platformIcons,
    deliverables: leaderRow.deliverables,
    clientCost: leaderRow.clientCost,
    creators: groupItems.map((item) => buildCollapsePackageCreator(item)),
  };
}

function buildQuotationCollapseContentGroups(
  items: QuotationExportItem[],
  audience: QuotationDocumentAudience,
  gpTargetPct: number | null | undefined
): QuotationDocCollapseContentGroup[] {
  const byCollapseId = new Map<string, QuotationExportItem[]>();
  for (const item of items) {
    if (!item.collapse_group_id) continue;
    const bucket = byCollapseId.get(item.collapse_group_id) ?? [];
    bucket.push(item);
    byCollapseId.set(item.collapse_group_id, bucket);
  }

  const bySignature = new Map<string, QuotationExportItem[][]>();
  for (const members of byCollapseId.values()) {
    const sortedMembers = [...members].sort(
      (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
    );
    const signature = collapsePackageCreatorSignature(sortedMembers);
    const bucket = bySignature.get(signature) ?? [];
    bucket.push(sortedMembers);
    bySignature.set(signature, bucket);
  }

  const bundles: QuotationDocCollapseContentGroup[] = [];

  for (const [bundleKey, groups] of bySignature.entries()) {
    const sortedGroups = [...groups].sort((left, right) => {
      const leaderLeft = collapsePackageLeaderItem(left);
      const leaderRight = collapsePackageLeaderItem(right);
      return (
        leaderLeft.sort_order - leaderRight.sort_order ||
        leaderLeft.id.localeCompare(leaderRight.id)
      );
    });

    const firstMembers = sortedGroups[0] ?? [];
    const label =
      firstMembers.find((row) => row.collapse_label)?.collapse_label?.trim() ||
      COLLAPSE_CONTENT_LABEL;

    bundles.push({
      bundleKey,
      label,
      previewLabel: collapseContentPreviewLabel(label),
      optionCount: sortedGroups.length,
      packages: sortedGroups.map((members) =>
        buildCollapsePackage(members, items, audience, gpTargetPct)
      ),
    });
  }

  bundles.sort((left, right) => {
    const leaderLeft = collapsePackageLeaderItem(
      byCollapseId.get(left.packages[0]?.collapseGroupId ?? "") ?? []
    );
    const leaderRight = collapsePackageLeaderItem(
      byCollapseId.get(right.packages[0]?.collapseGroupId ?? "") ?? []
    );
    return (
      leaderLeft.sort_order - leaderRight.sort_order ||
      leaderLeft.id.localeCompare(leaderRight.id)
    );
  });

  return bundles;
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
  const publicationShotsByCreatorKey = isCreatorDeckTemplate(template)
    ? options?.publicationShotsByCreatorKey
    : undefined;
  const items = detail.items as QuotationExportItem[];
  const expired = detail.is_expired || isQuotationExpired(detail.validity_date);
  const statusLabel = resolveQuotationStatusLabel({
    status: detail.status,
    validityDate: detail.validity_date,
    isExpired: expired,
  });

  const creatorGroups = groupQuotationExportItems(items).map((group) =>
    buildCreatorGroup(
      group,
      audience,
      detail.gp_target_pct,
      items,
      publicationShotsByCreatorKey
    )
  );
  const collapseContentGroups = buildQuotationCollapseContentGroups(
    items,
    audience,
    detail.gp_target_pct
  );
  const exportGroups = groupQuotationExportItems(items);
  const rows = creatorGroups.flatMap((group) => group.rows);
  const uniqueCreatorCount = countUniqueQuotationCreators(items);
  const categoryBreakdown = buildQuotationMainCategoryBreakdown({
    creatorGroups,
    totalCreators: uniqueCreatorCount,
    formatSharePct: (count, total) =>
      total > 0 ? `${num((count / total) * 100, 1)}%` : "0.0%",
  });
  const tierBreakdown = buildBreakdown(
    creatorGroups.map((group) => {
      const tier = group.rows[0]?.tier?.trim();
      return tier && tier !== "—" ? tier : "Unknown";
    }),
    uniqueCreatorCount
  );
  const fullTierBreakdown = buildQuotationFullTierBreakdown({
    groups: exportGroups,
    campaignName: detail.campaign_name ?? detail.name,
  });
  const rosterForecast = computeCampaignForecastFromProfiles(
    quotationItemsToForecastProfiles(detail.items)
  );
  const optimization = optimizeQuotationCampaign(detail.items, {
    budgetAmount: detail.total_revenue_egp + detail.total_af_egp,
    currency: REPORTING_CURRENCY,
    campaignPlatform: detail.items[0]?.platform ?? null,
  });
  const decision = evaluateQuotationDecision(detail.items, {
    commercial: {
      budget: { amount: detail.total_revenue_egp + detail.total_af_egp, currency: REPORTING_CURRENCY },
    },
    platforms: detail.items[0]?.platform ? [detail.items[0].platform] : [],
  });

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
  const insightBullets = buildSummaryInsightBullets({
    creatorCount: uniqueCreatorCount,
    categoryBreakdown,
    tierBreakdown,
    estimatedEngagement: avgEr,
  });

  const clientKpis: QuotationDocumentKpi[] = [
    { label: "Creators", value: String(uniqueCreatorCount) },
    { label: "Audience Size", value: num(rosterForecast.audienceSize) },
    { label: "Est. Engagement", value: avgEr },
    ...(template === "showcase" || template === "pitch"
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
    collapseContentGroups,
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
      audienceSize: num(rosterForecast.audienceSize),
      estimatedReach: num(rosterForecast.estimatedReach),
      estimatedEngagement: avgEr,
      categoryBreakdown,
      tierBreakdown,
      fullTierBreakdown,
      insightBullets,
      campaignHealthScore: optimization.healthScore.overall,
      campaignDecisionScore: decision.decisionScore.overall,
      launchReadiness: decision.readinessLabel,
      topDecisionRecommendation: decision.approvalSummary.recommendation,
      topOptimizationRecommendation: optimization.recommendations[0]?.action ?? null,
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
