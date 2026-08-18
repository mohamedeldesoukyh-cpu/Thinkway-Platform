import { pickCreatorDisplayName, resolveCreatorIdentity } from "@/lib/text/decode-html-entities";

import type { ClientCreatorSelectionState } from "./constants";
import { isSelectedForCalculator } from "./status";
import type {
  ClientAudienceBrief,
  ClientAudienceSlice,
  ClientCommercialSummary,
  ClientContentPost,
  ClientCreatorCard,
  ClientDeliverableItem,
  ClientMediaPlanSummary,
  ClientOverview,
  ClientPerformanceBrief,
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  return items.length > 0 ? items : undefined;
}

function parseContentCategories(value: unknown): ClientReviewSourceSnapshotCreator["contentCategories"] {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((row) => {
      if (typeof row === "string" && row.trim()) return { label: row.trim() };
      if (!isRecord(row)) return null;
      const label = asString(row.label) || asString(row.category);
      if (!label) return null;
      return {
        label,
        percent: asNumber(row.percent),
        postCount: asNumber(row.postCount),
      };
    })
    .filter((row): row is { label: string; percent?: number; postCount?: number } => Boolean(row));
  return items.length > 0 ? items : undefined;
}

function parseBrandMentions(value: unknown): ClientReviewSourceSnapshotCreator["brandMentions"] {
  if (!Array.isArray(value)) return undefined;
  const mentions = value
    .map((row) => {
      if (typeof row === "string" && row.trim()) return { name: row.trim() };
      if (!isRecord(row)) return null;
      const name = asString(row.name);
      if (!name) return null;
      return {
        name,
        handle: asString(row.handle),
        mentionCount: asNumber(row.mentionCount),
        mentionsLast180Days: asNumber(row.mentionsLast180Days),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return mentions.length > 0 ? mentions : undefined;
}

function parseSlices(value: unknown): ClientAudienceSlice[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      label: asString(row.label) || "",
      percent: asNumber(row.percent),
    }))
    .filter((row) => row.label);
}

function parseAudience(value: unknown): ClientAudienceBrief | undefined {
  if (!isRecord(value)) return undefined;
  const frozenAt = asString(value.frozenAt);
  if (!frozenAt) return undefined;
  return {
    frozenAt,
    ages: parseSlices(value.ages),
    genders: parseSlices(value.genders),
    locations: parseSlices(value.locations),
    interests: asStringArray(value.interests) ?? [],
    summary: asString(value.summary),
    qualityLabel: asString(value.qualityLabel),
    qualityIndicators: asStringArray(value.qualityIndicators) ?? [],
    growthPercent: asNumber(value.growthPercent),
    followerGrowth: asNumber(value.followerGrowth),
    growthTrend: asString(value.growthTrend),
  };
}

function parsePerformance(value: unknown): ClientPerformanceBrief | undefined {
  if (!isRecord(value)) return undefined;
  const frozenAt = asString(value.frozenAt);
  if (!frozenAt) return undefined;
  return {
    frozenAt,
    avgLikes: asNumber(value.avgLikes),
    avgComments: asNumber(value.avgComments),
    avgViews: asNumber(value.avgViews),
    engagementRate: asNumber(value.engagementRate),
    estimatedReach: asNumber(value.estimatedReach),
    likesExplanation: asString(value.likesExplanation),
    commentsExplanation: asString(value.commentsExplanation),
    viewsExplanation: asString(value.viewsExplanation),
    engagementExplanation: asString(value.engagementExplanation),
    reachExplanation: asString(value.reachExplanation),
  };
}

function parseContentFeed(value: unknown): ClientContentPost[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const posts = value.filter(isRecord).map((row) => ({
    url: asString(row.url) ?? null,
    thumbnail: asString(row.thumbnail) ?? null,
    platform: asString(row.platform),
    postedAt: asString(row.postedAt) ?? null,
    likes: asNumber(row.likes) ?? null,
    comments: asNumber(row.comments) ?? null,
    views: asNumber(row.views) ?? null,
    engagementRate: asNumber(row.engagementRate) ?? null,
  }));
  return posts.length > 0 ? posts : undefined;
}

function parseHistorical(value: unknown): ClientReviewSourceSnapshotCreator["historical"] {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .filter(isRecord)
    .map((row) => {
      const periodMonth = asString(row.periodMonth);
      if (!periodMonth) return null;
      return {
        periodMonth,
        followers: asNumber(row.followers),
        following: asNumber(row.following),
        postsCount: asNumber(row.postsCount),
        engagementRate: asNumber(row.engagementRate),
        avgViews: asNumber(row.avgViews),
        monthlyGrowthRate: asNumber(row.monthlyGrowthRate),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return rows.length > 0 ? rows : undefined;
}

function parsePlatformAccounts(
  value: unknown
): ClientReviewSourceSnapshotCreator["platformAccounts"] {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .filter(isRecord)
    .map((row) => {
      const platform = asString(row.platform);
      if (!platform) return null;
      return {
        platform,
        handle: asString(row.handle),
        followers: asNumber(row.followers),
        engagementRate: asNumber(row.engagementRate),
        avgLikes: asNumber(row.avgLikes),
        avgComments: asNumber(row.avgComments),
        avgViews: asNumber(row.avgViews),
        profileUrl: asString(row.profileUrl),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return rows.length > 0 ? rows : undefined;
}

function parseDeliverableItems(value: unknown): ClientDeliverableItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter(isRecord)
    .map((row) => ({
      platform: asString(row.platform),
      type: asString(row.type) || "",
      quantity: asNumber(row.quantity),
    }))
    .filter((row) => row.type);
  return items.length > 0 ? items : undefined;
}

function parseMediaPlanSummary(value: unknown): ClientMediaPlanSummary | undefined {
  if (!isRecord(value)) return undefined;
  const mix = Array.isArray(value.activityMix)
    ? value.activityMix.filter(isRecord).map((row) => ({
        label: asString(row.label) || "",
        count: asNumber(row.count) ?? 0,
      })).filter((row) => row.label)
    : [];
  return {
    creatorCount: asNumber(value.creatorCount) ?? 0,
    estimatedReach: asNumber(value.estimatedReach),
    estimatedEngagements: asNumber(value.estimatedEngagements),
    estimatedImpressions: asNumber(value.estimatedImpressions),
    averageEngagementRate: asNumber(value.averageEngagementRate),
    cpe: asNumber(value.cpe),
    cpm: asNumber(value.cpm),
    emv: asNumber(value.emv),
    activityMix: mix,
    currency: asString(value.currency) || "EGP",
    creatorForecasts: {},
  };
}

export function parseSnapshotCreator(row: Record<string, unknown>): ClientReviewSourceSnapshotCreator {
  const identity = resolveCreatorIdentity(asString(row.displayName), asString(row.handle));
  return {
    creatorId: asString(row.creatorId) || "",
    displayName: pickCreatorDisplayName([asString(row.displayName)], identity.handle) || identity.name || "Creator",
    handle: identity.handle ? `@${identity.handle}` : asString(row.handle),
    platform: asString(row.platform),
    platformAccounts: parsePlatformAccounts(row.platformAccounts),
    followers: asNumber(row.followers),
    engagementRate: asNumber(row.engagementRate),
    country: asString(row.country),
    city: asString(row.city),
    category: asString(row.category),
    niche: asString(row.niche),
    categories: asStringArray(row.categories),
    contentCategories: parseContentCategories(row.contentCategories),
    audienceHighlight: asString(row.audienceHighlight),
    fitExplanation: asString(row.fitExplanation),
    deliverables: asString(row.deliverables),
    deliverableItems: parseDeliverableItems(row.deliverableItems),
    investmentAmount: asNumber(row.investmentAmount),
    investmentCurrency: asString(row.investmentCurrency),
    avatarUrl: asString(row.avatarUrl),
    profileUrl: asString(row.profileUrl),
    bio: asString(row.bio),
    notes: asString(row.notes),
    avgLikes: asNumber(row.avgLikes),
    avgComments: asNumber(row.avgComments),
    avgViews: asNumber(row.avgViews),
    estimatedReach: asNumber(row.estimatedReach),
    estimatedEngagements: asNumber(row.estimatedEngagements),
    cpe: asNumber(row.cpe),
    matchPercent: asNumber(row.matchPercent),
    matchConfidence: asNumber(row.matchConfidence),
    matchExplanation: asString(row.matchExplanation),
    matchEvidence: asStringArray(row.matchEvidence),
    tier: asString(row.tier),
    brandMentions: parseBrandMentions(row.brandMentions),
    contentFeed: parseContentFeed(row.contentFeed),
    audience: parseAudience(row.audience),
    performance: parsePerformance(row.performance),
    historical: parseHistorical(row.historical),
    influencerId: asString(row.influencerId),
    briefFrozenAt: asString(row.briefFrozenAt),
    briefBackfillDone: row.briefBackfillDone === true,
  };
}

export function parseSourceSnapshot(raw: unknown): ClientReviewSourceSnapshot | null {
  if (!isRecord(raw)) return null;
  const source = raw.source;
  if (source !== "studio" && source !== "shortlist" && source !== "quotation") return null;
  const creators = Array.isArray(raw.creators) ? raw.creators.filter(isRecord) : [];
  const content = Array.isArray(raw.content) ? raw.content.filter(isRecord) : [];
  const commercial = isRecord(raw.commercial) ? raw.commercial : {};
  const timeline = isRecord(raw.timeline) ? raw.timeline : {};
  const quotation = isRecord(raw.quotation) ? raw.quotation : null;
  const creatorIds = Array.isArray(raw.creatorIds)
    ? raw.creatorIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : creators
        .map((row) => asString(row.creatorId))
        .filter((id): id is string => Boolean(id));

  return {
    source,
    brandName: asString(raw.brandName) || "Brand",
    campaignName: asString(raw.campaignName) || "Campaign",
    clientLabel: asString(raw.clientLabel) || "Client",
    objective: asString(raw.objective),
    audience: asString(raw.audience),
    market: asString(raw.market),
    durationLabel: asString(raw.durationLabel),
    platforms: Array.isArray(raw.platforms)
      ? raw.platforms.filter((item): item is string => typeof item === "string")
      : [],
    deliverables: Array.isArray(raw.deliverables)
      ? raw.deliverables.filter((item): item is string => typeof item === "string")
      : [],
    whyThisApproach: asString(raw.whyThisApproach),
    strategyBody: asString(raw.strategyBody),
    creators: creators.map((row) => parseSnapshotCreator(row)),
    content: content.map((row) => ({
      creatorId: asString(row.creatorId),
      creatorName: asString(row.creatorName) || "Creator",
      platform: asString(row.platform) || "",
      deliverable: asString(row.deliverable) || "",
      contentConcept: asString(row.contentConcept),
      keyMessage: asString(row.keyMessage),
      hook: asString(row.hook),
      cta: asString(row.cta),
      timing: asString(row.timing),
    })),
    timeline: {
      durationWeeks: asNumber(timeline.durationWeeks) ?? null,
      durationLabel: asString(timeline.durationLabel) || "Duration not confirmed",
      phases: Array.isArray(timeline.phases)
        ? timeline.phases.filter(isRecord).map((phase) => ({
            week: asNumber(phase.week) ?? 0,
            label: asString(phase.label) || "",
            activities: Array.isArray(phase.activities)
              ? phase.activities.filter((item): item is string => typeof item === "string")
              : [],
          }))
        : [],
    },
    commercial: {
      currency: asString(commercial.currency) || "EGP",
      creatorInvestment: asNumber(commercial.creatorInvestment) ?? 0,
      feeAmount: asNumber(commercial.feeAmount),
      totalInvestment: asNumber(commercial.totalInvestment) ?? 0,
      lines: Array.isArray(commercial.lines)
        ? commercial.lines.filter(isRecord).map((line) => ({
            label: asString(line.label) || "",
            amount: asNumber(line.amount),
            note: asString(line.note),
          }))
        : [],
      selectedCount: asNumber(commercial.selectedCount) ?? creatorIds.length,
      totalCount: asNumber(commercial.totalCount) ?? creatorIds.length,
      quotationTotal: asNumber(commercial.quotationTotal) ?? asNumber(commercial.totalInvestment) ?? 0,
    },
    mediaPlanSummary: parseMediaPlanSummary(raw.mediaPlanSummary),
    quotation: quotation
      ? {
          id: asString(quotation.id) || "",
          serialNumber: asString(quotation.serialNumber) ?? null,
          name: asString(quotation.name) || "Quotation",
          version: asString(quotation.version) ?? null,
          lines: Array.isArray(quotation.lines)
            ? quotation.lines.filter(isRecord).map((line) => ({
                creatorId: asString(line.creatorId) || "",
                label: asString(line.label) || "",
                amount: asNumber(line.amount) ?? 0,
              }))
            : [],
        }
      : undefined,
    creatorIds,
    clientUpdate: parseClientUpdate(raw.clientUpdate),
  };
}

function parseClientUpdate(value: unknown): ClientReviewSourceSnapshot["clientUpdate"] {
  if (!isRecord(value)) return undefined;
  const updatedAt = asString(value.updatedAt);
  const items = asStringArray(value.items);
  if (!updatedAt || !items?.length) return undefined;
  const acknowledgedAt = asString(value.acknowledgedAt);
  return acknowledgedAt ? { updatedAt, items, acknowledgedAt } : { updatedAt, items };
}

export function visibleClientUpdateNotice(
  update?: ClientReviewSourceSnapshot["clientUpdate"]
): ClientReviewSourceSnapshot["clientUpdate"] | undefined {
  if (!update?.items.length || update.acknowledgedAt) return undefined;
  return update;
}

export function quotationTotalFromSnapshot(snapshot: ClientReviewSourceSnapshot): number {
  const hasPerCreator = snapshot.creators.some((creator) => creator.investmentAmount != null);
  if (hasPerCreator) {
    return snapshot.creators.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
  }
  return snapshot.commercial.quotationTotal || snapshot.commercial.totalInvestment;
}

export function projectCommercialFromSnapshot(
  snapshot: ClientReviewSourceSnapshot,
  selection: Record<string, ClientCreatorSelectionState>
): ClientCommercialSummary {
  const selected = snapshot.creators.filter((creator) =>
    isSelectedForCalculator(selection[creator.creatorId])
  );
  const selectedIds = new Set(selected.map((creator) => creator.creatorId));
  const quotationTotal = quotationTotalFromSnapshot(snapshot);
  const hasPerCreator = snapshot.creators.some((creator) => creator.investmentAmount != null);
  if (hasPerCreator) {
    const creatorInvestment = selected.reduce(
      (sum, creator) => sum + (creator.investmentAmount ?? 0),
      0
    );
    const lines = snapshot.creators
      .filter((creator) => selectedIds.has(creator.creatorId) && creator.investmentAmount != null)
      .map((creator) => ({
        label: creator.displayName,
        amount: creator.investmentAmount,
      }));
    const quotationLines = snapshot.quotation?.lines.filter((line) => selectedIds.has(line.creatorId));
    return {
      currency: snapshot.commercial.currency,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      quotationTotal,
      lines: quotationLines?.length
        ? quotationLines.map((line) => ({ label: line.label, amount: line.amount }))
        : lines.length > 0
          ? lines
          : snapshot.commercial.lines,
      selectedCount: selected.length,
      totalCount: snapshot.creators.length,
    };
  }

  const selectedRatio =
    snapshot.creators.length === 0 ? 0 : selected.length / snapshot.creators.length;
  const total = Math.round(quotationTotal * selectedRatio);
  return {
    currency: snapshot.commercial.currency,
    creatorInvestment: total,
    feeAmount: snapshot.commercial.feeAmount,
    totalInvestment: total,
    quotationTotal,
    lines: snapshot.commercial.lines.map((line) => ({
      ...line,
      amount: line.amount != null ? Math.round(line.amount * selectedRatio) : undefined,
    })),
    selectedCount: selected.length,
    totalCount: snapshot.creators.length,
  };
}

export function projectCreatorsFromSnapshot(
  snapshot: ClientReviewSourceSnapshot,
  selection: Record<string, ClientCreatorSelectionState>
): ClientCreatorCard[] {
  return snapshot.creators.map((creator) => ({
    ...creator,
    selection: selection[creator.creatorId] ?? "in_review",
    contentExamples: creator.contentFeed?.slice(0, 3) ?? [],
  }));
}

export function projectOverviewFromSnapshot(
  snapshot: ClientReviewSourceSnapshot,
  commercial: ClientCommercialSummary
): ClientOverview {
  return {
    brandName: snapshot.brandName,
    campaignName: snapshot.campaignName,
    clientLabel: snapshot.clientLabel,
    objective: snapshot.objective,
    audience: snapshot.audience,
    market: snapshot.market,
    durationLabel: snapshot.durationLabel,
    platforms: snapshot.platforms,
    deliverables: snapshot.deliverables,
    creatorCount: snapshot.creators.length,
    whyThisApproach:
      snapshot.whyThisApproach?.slice(0, 480) ||
      "Thinkway recommends this creator-led approach based on the confirmed campaign facts.",
    commercial,
  };
}

export function snapshotCreatorIds(snapshot: ClientReviewSourceSnapshot): string[] {
  return snapshot.creatorIds.length > 0
    ? snapshot.creatorIds
    : snapshot.creators.map((creator) => creator.creatorId);
}

export function fingerprintFromSnapshotCreators(
  creators: ClientReviewSourceSnapshotCreator[],
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const ids = [...creators.map((creator) => creator.creatorId)].sort();
  const revenues = Object.fromEntries(
    [...creators]
      .sort((a, b) => a.creatorId.localeCompare(b.creatorId))
      .map((creator) => [creator.creatorId, creator.investmentAmount ?? 0])
  );
  return { creatorIds: ids, revenues, ...extra };
}
