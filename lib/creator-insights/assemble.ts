import { maybeAiWording } from "./ai-wording";
import { detectAllInsights, detectUnitCompactInsights } from "./detect";
import { type CreatorAssignmentFeeShare } from "./fees";
import {
  compactLinesFromPostAnalyses,
  detectPostPerformanceAnalyses,
} from "./post-performance";
import {
  dataAvailabilityLabel,
  isConnectionStale,
  latestSourceTimestamp,
  latestSyncAt,
  resolveDataLevel,
  type CreatorConnectionSnapshot,
  type CreatorPublicationObservation,
} from "./observations";
import type {
  CreatorFacingRecommendation,
  CreatorInsightPack,
  DetectedCreatorInsight,
  UpcomingCreatorUnit,
} from "./types";
import { MAX_SURFACED_RECOMMENDATIONS } from "./types";

const TYPE_RANK: Record<DetectedCreatorInsight["type"], number> = {
  campaign_specific: 100,
  performance_trend: 90,
  strong_content_type: 80,
  engagement_opportunity: 70,
  publication_timing: 50,
  data_enrichment: 10,
};

export function rankInsights(insights: readonly DetectedCreatorInsight[]): DetectedCreatorInsight[] {
  const seen = new Set<DetectedCreatorInsight["type"]>();
  return [...insights]
    .sort((a, b) => (b.priority || TYPE_RANK[b.type]) - (a.priority || TYPE_RANK[a.type]))
    .filter((insight) => {
      if (seen.has(insight.type)) return false;
      seen.add(insight.type);
      return true;
    });
}

export function selectSurfacedInsights(
  insights: readonly DetectedCreatorInsight[]
): DetectedCreatorInsight[] {
  const ranked = rankInsights(insights);
  const primary = ranked.filter((row) => row.type !== "data_enrichment");
  const enrichment = ranked.find((row) => row.type === "data_enrichment") ?? null;
  const selected: DetectedCreatorInsight[] = [];
  for (const row of primary) {
    if (selected.length >= MAX_SURFACED_RECOMMENDATIONS) break;
    if (
      row.type === "strong_content_type" &&
      selected.some(
        (item) => item.type === "campaign_specific" && item.formatFamily === row.formatFamily
      )
    ) {
      continue;
    }
    selected.push(row);
  }
  if (selected.length < MAX_SURFACED_RECOMMENDATIONS && enrichment) {
    selected.push(enrichment);
  }
  if (selected.length === 0 && enrichment) return [enrichment];
  return selected.slice(0, MAX_SURFACED_RECOMMENDATIONS);
}

function hrefFor(insight: DetectedCreatorInsight): string | null {
  if (insight.type === "data_enrichment") return "/creator-portal/profile";
  if (insight.campaignHeaderId) {
    return `/creator-portal/campaigns/${insight.campaignHeaderId}`;
  }
  return null;
}

export async function assembleCreatorInsightPack(input: {
  influencerId: string;
  observations: readonly CreatorPublicationObservation[];
  units?: readonly UpcomingCreatorUnit[];
  connections: readonly CreatorConnectionSnapshot[];
  hasOperationalHistory: boolean;
  feeShares?: readonly CreatorAssignmentFeeShare[];
  now?: Date;
  wording?: typeof maybeAiWording;
}): Promise<CreatorInsightPack> {
  const now = input.now ?? new Date();
  const observations = input.observations.filter(
    (row) => row.influencerId === input.influencerId
  );
  const stale = isConnectionStale(input.connections, now.getTime());
  const dataLevel = resolveDataLevel({
    hasOperationalHistory: input.hasOperationalHistory,
    observations,
    connections: input.connections,
  });
  const detected = detectAllInsights({
    observations,
    units: input.units ?? [],
    connections: input.connections,
    dataLevel,
    stale,
  });
  const surfaced = selectSurfacedInsights(detected);
  const wordingFn = input.wording ?? maybeAiWording;
  const lastSyncedAt = latestSyncAt(input.connections);
  const sourceDataTimestamp = latestSourceTimestamp(observations);
  const recommendations: CreatorFacingRecommendation[] = [];
  for (const insight of surfaced) {
    const { copy, source } = await wordingFn(insight, stale);
    recommendations.push({
      id: `rec-${insight.type}-${input.influencerId}`,
      influencerId: input.influencerId,
      type: insight.type,
      title: copy.title,
      explanation: copy.explanation,
      recommendation: copy.recommendation,
      confidence: insight.confidence,
      evidence: insight.evidence,
      facts: insight.facts,
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      sourceDataTimestamp,
      lastSyncedAt,
      stale,
      campaignHeaderId: insight.campaignHeaderId,
      assignmentDeliverableId: insight.assignmentDeliverableId,
      href: hrefFor(insight),
      wordingSource: source,
    });
  }

  const collecting =
    recommendations.length === 1 && recommendations[0]?.type === "data_enrichment"
      ? recommendations[0].title
      : recommendations.length === 0
        ? "Thinkway is collecting more performance data. Connect your social account to unlock richer insights."
        : null;

  const postAnalyses = detectPostPerformanceAnalyses(
    observations,
    input.feeShares ?? []
  );
  const fromPosts = compactLinesFromPostAnalyses(postAnalyses);
  const unitInsights =
    fromPosts.length > 0 ? fromPosts : detectUnitCompactInsights(observations);

  return {
    influencerId: input.influencerId,
    generatedAt: now.toISOString(),
    dataLevel,
    dataAvailabilityLabel: dataAvailabilityLabel(dataLevel),
    stale,
    lastSyncedAt,
    sourceDataTimestamp,
    connectedPlatforms: input.connections.map((row) => ({
      provider: row.provider,
      displayName: row.displayName,
      status: row.status,
      lastSyncedAt: row.lastSyncedAt,
    })),
    recommendations,
    unitInsights,
    postAnalyses,
    collectingMessage: collecting,
  };
}
