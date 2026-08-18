import { formatEngagementRate } from "@/features/discovery/components/creator-search/creator-search-utils";
import type {
  ShortlistDocCreatorGroup,
  ShortlistDocument,
} from "@/features/discovery/shortlists/export/shortlist-document";
import {
  isCreatorDeckTemplate,
  isPitchTemplate,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";
import { computeCampaignForecast, forecastCreator } from "@/lib/campaign-forecast";

import {
  creatorCountLabel,
  formatQuotationFullNumber,
  formatQuotationShortNumber,
  showcaseInitialsFromHandle,
  tierProfileCountLabel,
  tierSlugFromLabel,
  tierSummaryLabel,
} from "./shortlist-template-format";
import type { ShortlistTemplateFlags, ShortlistTemplatePayload } from "./shortlist-template-types";

const COMPANY = {
  legalLine: "Thinkway · CR 57920 · VAT 780-879-732",
  address: "44B Saraya Mall, Sheikh Zayed, Giza, Egypt · hello@thinkwaymedia.com",
} as const;

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

function resolveTemplateFlags(template: ShortlistTemplateVariant): ShortlistTemplateFlags {
  return {
    showcaseCreators: isCreatorDeckTemplate(template),
    pitchCreators: isPitchTemplate(template),
    includeInternalFields: template === "detailed",
  };
}

function coverKicker(template: ShortlistTemplateVariant): string {
  if (template === "detailed") return "Discovery Shortlist · Detailed";
  if (isPitchTemplate(template)) return "Discovery Shortlist · Pitch Presentation";
  if (template === "showcase" || template === "showcase-lump-sum") {
    return "Discovery Shortlist · Showcase";
  }
  return "Discovery Shortlist · Summary";
}

function preparedForSubtitle(doc: ShortlistDocument): string {
  const parts: string[] = [];
  if (doc.brandName !== "—") parts.push(doc.brandName);
  if (doc.clientName !== "—") parts.push(doc.clientName);
  const label = parts.length ? parts.join(" · ") : "Discovery roster";
  return `Curated influencer roster prepared exclusively for ${label}.`;
}

function coverStat3(doc: ShortlistDocument): ShortlistTemplatePayload["cover"]["stat3"] {
  if (doc.template === "detailed") {
    return {
      label: "Avg Match Score",
      value: doc.summary.avgMatchScoreLabel,
      valueShort: doc.summary.avgMatchScoreLabel,
    };
  }
  return {
    label: "Avg Engagement",
    value: doc.summary.avgEngagementRateLabel,
    valueShort: doc.summary.avgEngagementRateLabel,
  };
}

function sharePct(count: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function averageFinite(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupPlatformsLabel(group: ShortlistDocCreatorGroup): string {
  if (!group.platformLinks.length) return group.platform;
  return group.platformLinks.map((link) => link.label).join(", ");
}

function buildTierBreakdown(groups: ShortlistDocCreatorGroup[], shortlistName: string) {
  type Entry = {
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

  const entries: Entry[] = groups.map((group) => {
    const platformKey = group.platformLinks[0]?.platform ?? null;
    const estimatedReach = forecastCreator(
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
      followers: group.followersNumeric,
      followersLabel: group.followers,
      category: group.categories.length ? group.categories.join(", ") : group.interests,
      engagementRate: group.engagementRateNumeric,
      engagementRateLabel: group.engagementRate,
      estimatedReach,
      estimatedReachLabel:
        estimatedReach != null ? formatQuotationFullNumber(estimatedReach) : "—",
    };
  });

  const totalEstimatedReach = entries.reduce(
    (sum, entry) => sum + (entry.estimatedReach ?? 0),
    0
  );

  const sections = TIER_SECTION_ORDER.flatMap((tier) => {
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
        name: tier,
        slug: tierSlugFromLabel(TIER_SECTION_LABEL[tier]),
        profileCount: tierProfileCountLabel(creators.length),
        followers: formatQuotationFullNumber(totalFollowers),
        estReach: formatQuotationFullNumber(sectionReach),
        reachShare:
          totalEstimatedReach > 0
            ? `${((sectionReach / totalEstimatedReach) * 100).toFixed(1)}%`
            : "0.0%",
        avgER: formatEngagementRate(avgEr),
        creators: creators.map((entry) => ({
          handle: entry.handle,
          platform: entry.platform,
          followers: entry.followersLabel,
          category: entry.category,
          er: entry.engagementRateLabel,
          estReach: entry.estimatedReachLabel,
        })),
      },
    ];
  });

  const grandTotalFollowers = entries.reduce(
    (sum, entry) => sum + (entry.followers ?? 0),
    0
  );
  const grandErValues = entries
    .map((entry) => entry.engagementRate)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const label =
    shortlistName.trim() && shortlistName !== "—"
      ? shortlistName.trim().toUpperCase()
      : "SHORTLIST";

  return {
    title: `${label} | FULL INFLUENCER BREAKDOWN BY TIER`,
    sections,
    totals: {
      creatorCount: String(entries.length),
      followers: formatQuotationFullNumber(grandTotalFollowers),
      estReach: formatQuotationFullNumber(totalEstimatedReach),
      avgER: formatEngagementRate(averageFinite(grandErValues)),
    },
    tierBreakdown: groups.reduce<Array<{ label: string; count: number }>>((acc, group) => {
      const existing = acc.find((row) => row.label === group.tier);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ label: group.tier, count: 1 });
      }
      return acc;
    }, []),
  };
}

function buildInsightNarrative(doc: ShortlistDocument): string {
  const s = doc.summary;
  if (s.creatorCount === 0) {
    return "This shortlist does not contain any creators yet. Add creators in Discovery to populate roster metrics and analysis.";
  }

  const parts: string[] = [];
  parts.push(
    `This shortlist presents ${s.creatorCount} creator${s.creatorCount === 1 ? "" : "s"} with an audience size of ${s.totalFollowersLabel} and estimated reach of ${s.estimatedReachLabel}.`
  );

  if (s.avgEngagementRate != null) {
    parts.push(`Average engagement rate across the roster is ${s.avgEngagementRateLabel}.`);
  }

  if (s.countryBreakdown.length > 0) {
    const topCountries = s.countryBreakdown
      .slice(0, 3)
      .map((item) => `${item.label} (${item.count})`)
      .join(", ");
    parts.push(`Primary audience geographies: ${topCountries}.`);
  }

  if (s.platformBreakdown.length > 0) {
    const topPlatforms = s.platformBreakdown
      .slice(0, 3)
      .map((item) => `${item.label} (${item.count})`)
      .join(", ");
    parts.push(`Platform distribution: ${topPlatforms}.`);
  }

  if (doc.template === "detailed" && s.avgMatchScore != null) {
    parts.push(`Average Thinkway match score for this roster is ${s.avgMatchScoreLabel}.`);
  }

  return parts.join(" ");
}

function resolveSectionNumbers(input: {
  template: ShortlistTemplateVariant;
  creatorCount: number;
  flags: ShortlistTemplateFlags;
}): { roster: string } {
  if (isCreatorDeckTemplate(input.template)) {
    return { roster: String(input.creatorCount + 2).padStart(2, "0") };
  }
  return { roster: "02" };
}

export function buildShortlistTemplatePayload(doc: ShortlistDocument): ShortlistTemplatePayload {
  const flags = resolveTemplateFlags(doc.template);
  const sectionNos = resolveSectionNumbers({
    template: doc.template,
    creatorCount: doc.summary.creatorCount,
    flags,
  });
  const tierData = buildTierBreakdown(doc.creatorGroups, doc.name);
  const totalCreators = doc.summary.creatorCount;

  const categories = doc.summary.categoryBreakdown.map((row) => ({
    name: row.label,
    count: String(row.count),
    countLabel: creatorCountLabel(row.count),
    share: sharePct(row.count, totalCreators),
  }));

  const topTier = tierData.tierBreakdown.sort((a, b) => b.count - a.count)[0];
  const topCategory = doc.summary.categoryBreakdown[0];

  const showcaseCreators = doc.creatorGroups.map((group, index) => ({
    sectionNo: String(index + 2).padStart(2, "0"),
    index: index + 1,
    initials: showcaseInitialsFromHandle(group.handle || group.creator),
    name: group.creator,
    handle:
      group.handle !== "—"
        ? group.handle.startsWith("@")
          ? group.handle
          : `@${group.handle}`
        : group.creator,
    profileUrl: group.profileUrl,
    isVerified: group.isVerified,
    followers: group.followers,
    engagement: group.engagementRate,
    tier: group.tier,
    categories: group.categories.length ? group.categories.join(", ") : "—",
    platforms: groupPlatformsLabel(group),
    country: group.country,
    matchScore: group.matchScore,
    brandSafety: group.brandSafety,
    status: group.status,
    notes: group.notes,
    publications: (group.publicationShots ?? [])
      .map((shot) => shot.imageUrl)
      .filter(Boolean),
  }));

  const rosterRows = (flags.showcaseCreators ? doc.creatorGroups : doc.rows).map(
    (entry, index) => {
      const rank = "rank" in entry ? entry.rank : index + 1;
      const handle =
        entry.handle !== "—"
          ? entry.handle.startsWith("@")
            ? entry.handle
            : `@${entry.handle}`
          : entry.creator;
      const base = {
        rank,
        handle,
        creator: entry.creator,
        platform: "platform" in entry && typeof entry.platform === "string"
          ? entry.platform
          : groupPlatformsLabel(entry as ShortlistDocCreatorGroup),
        followers: entry.followers,
        er: entry.engagementRate,
        country: entry.country,
        avatarInitials: showcaseInitialsFromHandle(entry.handle || entry.creator),
      };

      if (flags.includeInternalFields) {
        return {
          ...base,
          interests: entry.interests,
          brandSafety: entry.brandSafety,
          status: entry.status,
          notes: entry.notes,
          matchScore: entry.matchScore,
        };
      }

      if (flags.showcaseCreators && "tier" in entry) {
        const group = entry as ShortlistDocCreatorGroup;
        return {
          ...base,
          tier: group.tier,
          categories: group.categories.length ? group.categories.join(", ") : "—",
          matchScore: group.matchScore,
        };
      }

      return base;
    }
  );

  const rosterNote = flags.showcaseCreators
    ? "Client-facing creator showcase — metrics, tiers, and recent publications."
    : flags.includeInternalFields
      ? "Internal roster including review status, notes, and match scores."
      : "Client-facing creator summary without internal review fields.";

  return {
    flags,
    shortlist: {
      number: doc.serial,
      title: doc.name,
      client: doc.clientName,
      brand: doc.brandName,
      owner: doc.ownerName,
      generatedDate: doc.generatedDateLabel,
      status: doc.statusLabel.toUpperCase(),
      visibility: doc.visibilityLabel,
    },
    cover: {
      kicker: coverKicker(doc.template),
      subtitle: preparedForSubtitle(doc),
      stat3: coverStat3(doc),
    },
    roster: {
      sectionNo: sectionNos.roster,
      note: rosterNote,
    },
    campaign: {
      creatorCount: String(doc.summary.creatorCount),
      tierSummary: tierSummaryLabel(tierData.tierBreakdown),
      totalReach: formatQuotationFullNumber(doc.summary.totalFollowers),
      totalReachShort: formatQuotationShortNumber(
        doc.summary.totalFollowers > 0 ? doc.summary.totalFollowers : null
      ),
      avgEngagement: doc.summary.avgEngagementRateLabel,
    },
    categories,
    tiers: tierData.sections,
    totals: tierData.totals,
    insight: {
      narrative: buildInsightNarrative(doc),
      categoryMix: topCategory
        ? `Category mix — ${topCategory.label} leads with ${topCategory.count} creator${topCategory.count === 1 ? "" : "s"}.`
        : "",
      tierMix: topTier
        ? `Tier mix — ${topTier.label} tier contributes ${topTier.count} profile${topTier.count === 1 ? "" : "s"}.`
        : "",
      scale: `Scale — ${doc.summary.creatorCount} creators · ${doc.summary.totalFollowersLabel} combined followers.`,
    },
    showcaseCreators,
    rosterRows,
    company: { ...COMPANY },
    footer: {
      left: `Confidential · Thinkway Platform · ${doc.generatedDateLabel}`,
    },
  };
}
