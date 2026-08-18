/**
 * Adapt a Discovery shortlist document onto the quotation template document
 * so Preview / PDF / PPTX / Word share the quotation layout family.
 */
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { forecastCreator } from "@/lib/campaign-forecast";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import type {
  ShortlistDocCreatorGroup,
  ShortlistDocument,
} from "@/features/discovery/shortlists/export/shortlist-document";
import type {
  QuotationDocCreatorGroup,
  QuotationDocPlatformMetric,
  QuotationDocRow,
  QuotationDocument,
  QuotationDocumentBreakdown,
  QuotationDocumentFullTierBreakdown,
  QuotationDocumentTierSection,
} from "@/features/quotations/export/quotation-document";
import {
  formatQuotationEngagementRate,
  formatQuotationFullNumber,
} from "@/features/quotations/templates/quotation-template-format";

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

function sharePct(count: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function averageFinite(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function platformIconsFromGroup(group: ShortlistDocCreatorGroup): string[] {
  const fromMetrics = group.platformMetrics.map((metric) =>
    canonicalPlatformKey(metric.platform)
  );
  if (fromMetrics.length) return [...new Set(fromMetrics.filter(Boolean))];
  return [
    ...new Set(
      group.platformLinks
        .map((link) => canonicalPlatformKey(link.platform))
        .filter(Boolean)
    ),
  ];
}

function toPlatformMetrics(
  group: ShortlistDocCreatorGroup
): QuotationDocPlatformMetric[] {
  if (group.platformMetrics.length > 0) {
    return group.platformMetrics.map((metric) => ({
      platform: canonicalPlatformKey(metric.platform) || metric.platform,
      followers: metric.followers,
      engagement: metric.engagement,
      views: metric.views,
      profileUrl: metric.profileUrl,
      avatarUrl: metric.avatarUrl ?? group.avatarUrl,
    }));
  }
  const icons = platformIconsFromGroup(group);
  if (!icons.length) return [];
  return icons.map((platform, index) => ({
    platform,
    followers: index === 0 ? group.followers : "—",
    engagement: index === 0 ? group.engagementRate : "—",
    views: "—",
    profileUrl: group.platformLinks[index]?.url ?? group.profileUrl,
    avatarUrl: group.avatarUrl,
  }));
}

function toQuotationRow(group: ShortlistDocCreatorGroup): QuotationDocRow {
  const icons = platformIconsFromGroup(group);
  return {
    creator: group.creator,
    option: "1",
    platform: group.platform,
    platformIcons: icons,
    allPlatforms: false,
    followers: group.followers,
    engagementRate: group.engagementRate,
    country: group.country,
    deliverables: "—",
    serviceDescription: "",
    tier: group.tier,
    type: "—",
    clientCost: "—",
    af: "—",
    afPct: "—",
    currency: "EGP",
  };
}

function toQuotationCreatorGroup(
  group: ShortlistDocCreatorGroup
): QuotationDocCreatorGroup {
  const row = toQuotationRow(group);
  const icons = platformIconsFromGroup(group);
  return {
    creatorKey: group.creatorKey,
    creator: group.creator,
    handle: group.handle,
    profileUrl: group.profileUrl,
    avatarUrl: group.avatarUrl,
    avatarProxyUrl: group.avatarProxyUrl,
    platform: group.platformLinks[0]?.platform ?? group.platform,
    linkedPlatforms: icons,
    platformIcons: icons,
    platformMetrics: toPlatformMetrics(group),
    followers: group.followers,
    engagementRate: group.engagementRate,
    views: "—",
    country: group.country,
    categories: group.categories,
    isVerified: group.isVerified,
    optionCount: 1,
    publicationShots: group.publicationShots.map((shot) => ({
      imageUrl: shot.imageUrl,
      postUrl: shot.postUrl,
      caption: shot.caption,
      isVideo: shot.isVideo,
      imageProxyUrl: shot.imageProxyUrl,
    })),
    rows: [row],
  };
}

function buildBreakdown(
  labels: string[],
  totalCreators: number
): QuotationDocumentBreakdown[] {
  const counts = new Map<string, number>();
  for (const raw of labels) {
    const label = raw.trim();
    if (!label || label === "—") continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      sharePct: sharePct(count, totalCreators),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildFullTierBreakdown(
  groups: ShortlistDocCreatorGroup[],
  campaignName: string
): QuotationDocumentFullTierBreakdown {
  const entries = groups.map((group) => {
    const platformKey = group.platformLinks[0]?.platform ?? null;
    const estimatedReach =
      forecastCreator(
        {
          creatorKey: group.creatorKey,
          followers: group.followersNumeric,
          platform: platformKey,
          engagementRate: group.engagementRateNumeric,
        },
        null
      )?.estimatedReach ?? null;
    return {
      tier: group.tier,
      handle: group.handle !== "—" ? group.handle.replace(/^@/, "") : group.creator,
      platform: group.platform,
      platformIcons: platformIconsFromGroup(group),
      followers: group.followersNumeric,
      followersLabel: group.followers,
      views: "—" as const,
      category: group.categories.length ? group.categories.join(", ") : group.interests,
      engagementRate: group.engagementRateNumeric,
      engagementRateLabel: group.engagementRate,
      estimatedReach,
      estimatedReachLabel:
        estimatedReach != null ? formatQuotationFullNumber(estimatedReach) : "—",
      profileUrl: group.profileUrl,
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
              ? `${Math.round((sectionReach / totalEstimatedReach) * 100)}%`
              : "0%",
          avgEngagementRate: formatQuotationEngagementRate(avgEr),
          creators: creators.map((entry) => ({
            handle: entry.handle,
            platform: entry.platform,
            platformIcons: entry.platformIcons,
            followers: entry.followersLabel,
            views: entry.views,
            category: entry.category,
            engagementRate: entry.engagementRateLabel,
            estimatedReach: entry.estimatedReachLabel,
            profileUrl: entry.profileUrl,
          })),
          subtotalLabel: `Subtotal: ${creators.length} influencer${creators.length === 1 ? "" : "s"}`,
          subtotalFollowers: formatCreatorCount(totalFollowers),
          subtotalEngagementRate: formatQuotationEngagementRate(avgEr),
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

  const campaignLabel =
    campaignName.trim() && campaignName !== "—"
      ? campaignName.trim()
      : "Shortlist";

  return {
    title: `${campaignLabel.toUpperCase()} | FULL INFLUENCER BREAKDOWN BY TIER`,
    sections,
    grandTotalLabel: `GRAND TOTAL | ${entries.length} Influencer${entries.length === 1 ? "" : "s"}`,
    grandTotalFollowers: formatCreatorCount(grandTotalFollowers),
    grandTotalEstimatedReach: formatCreatorCount(totalEstimatedReach),
    grandTotalEngagementRate: formatQuotationEngagementRate(
      averageFinite(grandTotalEngagementRates)
    ),
  };
}

function insightBullets(doc: ShortlistDocument): string[] {
  const bullets: string[] = [];
  const categories = doc.summary.categoryBreakdown.slice(0, 3);
  if (categories.length) {
    bullets.push(
      `Category mix: ${categories.map((item) => `${item.label} ${item.count}`).join(" · ")}.`
    );
  }
  const topTiers = [...doc.creatorGroups.reduce((map, group) => {
    map.set(group.tier, (map.get(group.tier) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topTiers.length) {
    bullets.push(
      `Tier mix: ${topTiers.map(([label, count]) => `${label} ${count}`).join(" · ")}.`
    );
  }
  if (doc.summary.creatorCount > 0) {
    bullets.push(
      `Campaign scale: ${doc.summary.creatorCount} creator${doc.summary.creatorCount === 1 ? "" : "s"} with average ER ${doc.summary.avgEngagementRateLabel}.`
    );
  }
  return bullets;
}

export function shortlistDocumentToQuotationDocument(
  doc: ShortlistDocument
): QuotationDocument {
  const creatorGroups = doc.creatorGroups.map(toQuotationCreatorGroup);
  const categoryBreakdown = doc.summary.categoryBreakdown.map((row) => ({
    label: row.label,
    count: row.count,
    sharePct: sharePct(row.count, doc.summary.creatorCount),
  }));
  const tierBreakdown = buildBreakdown(
    doc.creatorGroups.map((group) => group.tier),
    doc.summary.creatorCount
  );
  const fullTierBreakdown = buildFullTierBreakdown(doc.creatorGroups, doc.name);
  const avgEr =
    doc.summary.avgEngagementRateLabel !== "—"
      ? doc.summary.avgEngagementRateLabel
      : formatQuotationEngagementRate(doc.summary.avgEngagementRate);

  return {
    audience: "client",
    source: "shortlist",
    template: doc.template,
    serial: doc.serial,
    name: doc.name,
    currency: "EGP",
    status: doc.statusLabel.toLowerCase().replace(/\s+/g, "_"),
    statusLabel: doc.statusLabel,
    isExpired: false,
    validityLabel: "—",
    clientName: doc.clientName,
    brandName: doc.brandName,
    campaignName: doc.name,
    issueDateLabel: doc.generatedDateLabel,
    validityDateLabel: "—",
    version: "v1.0",
    department: "Influencer Marketing",
    preparedByName: doc.ownerName,
    reviewedByName: "—",
    approvedByLabel: "Pending",
    preparedForLine:
      doc.clientName !== "—"
        ? `Prepared exclusively for ${doc.clientName}`
        : "Prepared exclusively for the named Client",
    dateLabel: doc.generatedDateLabel,
    rows: creatorGroups.flatMap((group) => group.rows),
    creatorGroups,
    collapseContentGroups: [],
    commercialKpis: [
      { label: "Creators", value: String(doc.summary.creatorCount) },
      { label: "Audience Size", value: doc.summary.totalFollowersLabel },
      { label: "Est. Engagement", value: avgEr },
    ],
    summary: {
      totalClientCost: "—",
      totalAf: "—",
      grandTotal: "—",
      totalAgencyMargin: "—",
      creatorCount: doc.summary.creatorCount,
      audienceSize: doc.summary.totalFollowersLabel,
      estimatedReach: doc.summary.estimatedReachLabel,
      estimatedEngagement: avgEr,
      categoryBreakdown,
      tierBreakdown,
      fullTierBreakdown,
      insightBullets: insightBullets(doc),
      campaignHealthScore: doc.summary.campaignHealthScore,
      campaignDecisionScore: doc.summary.campaignDecisionScore,
      launchReadiness: doc.summary.launchReadiness,
      topDecisionRecommendation: doc.summary.topDecisionRecommendation,
      topOptimizationRecommendation: doc.summary.topOptimizationRecommendation,
    },
    notes: doc.description?.trim() || null,
    termsSections: [],
    preparedByNameSignature: doc.ownerName !== "—" ? doc.ownerName : null,
    clientSignatureName: null,
    revisionLine: `v1.0 · ${doc.generatedDateLabel}`,
  };
}
