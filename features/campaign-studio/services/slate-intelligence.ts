import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorMixTier,
  CreatorsSectionData,
  SlateCreatorRecommendation,
  SlateIntelligence,
  SlateRecommendationReasonCode,
  TierShortageWarning,
  TimelineSectionExtras,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  buildCreatorMixFromFacts,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { canonicalTierLabel } from "@/lib/creators/influencer-tier";

import type { SearchCreatorCardItem } from "./creator-platform-utils";
import { estimateCreatorPostFee } from "./creator-fee-estimator";
import { allocateTierCounts, creatorTierOf, matchesTierLabel } from "./creator-slate";
import { normalizeCreatorId } from "./studio-draft";
import { resolveCreatorMix } from "./section-data-resolver";

function readStrategyMix(campaignObject: CampaignObject): CreatorMixTier[] {
  const strategyMix = (campaignObject.sections.strategy.data as { creatorMix?: CreatorMixTier[] } | undefined)
    ?.creatorMix;
  if (strategyMix?.length) return strategyMix;

  const facts = getCampaignFacts(campaignObject);
  return facts ? buildCreatorMixFromFacts(facts) : [];
}

function summarizeActualMix(cards: SearchCreatorCardItem[]): CreatorMixTier[] {
  const byTier = new Map<string, number>();
  for (const card of cards) {
    const tier = canonicalTierLabel(creatorTierOf(card));
    byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
  }
  const total = cards.length || 1;
  return [...byTier.entries()].map(([tier, count]) => ({
    tier: tier as CreatorMixTier["tier"],
    count,
    percent: Math.round((count / total) * 100),
    reasoning: `${count} creator${count === 1 ? "" : "s"} on the active slate`,
  }));
}

function strategyTargetCounts(
  strategyMix: CreatorMixTier[],
  slateSize: number
): Map<string, number> {
  if (strategyMix.length === 0) return new Map();

  const explicitTotal = strategyMix.reduce((sum, tier) => sum + tier.count, 0);
  const targetTotal = explicitTotal > 0 ? explicitTotal : Math.max(slateSize, 1);

  if (explicitTotal > 0) {
    return new Map(strategyMix.map((tier) => [tier.tier.toLowerCase(), tier.count]));
  }

  const mixPercents = strategyMix.map((tier) => ({
    tier: tier.tier,
    percent: tier.percent,
  }));
  return allocateTierCounts(mixPercents, targetTotal);
}

export function detectTierShortages(
  strategyMix: CreatorMixTier[],
  cards: SearchCreatorCardItem[]
): TierShortageWarning[] {
  if (strategyMix.length === 0 || cards.length === 0) return [];

  const targets = strategyTargetCounts(strategyMix, cards.length);
  const actualByTier = new Map<string, number>();
  for (const card of cards) {
    const tier = creatorTierOf(card).toLowerCase();
    for (const [targetTier] of targets) {
      if (matchesTierLabel(targetTier, tier)) {
        actualByTier.set(targetTier, (actualByTier.get(targetTier) ?? 0) + 1);
        break;
      }
    }
  }

  const warnings: TierShortageWarning[] = [];
  for (const [tier, required] of targets) {
    const actual = actualByTier.get(tier) ?? 0;
    if (actual < required) {
      const label = canonicalTierLabel(tier);
      warnings.push({
        tier: label,
        required,
        actual,
        message: `Shortage in ${label} — strategy calls for ${required}, you have ${actual}`,
      });
    } else if (actual > required) {
      const label = canonicalTierLabel(tier);
      warnings.push({
        tier: label,
        required,
        actual,
        message: `Excess in ${label} — strategy calls for ${required}, you have ${actual}. Consider demoting to alternatives.`,
      });
    }
  }
  return warnings;
}

function parseFeeAmount(priceEstimate?: string): number | undefined {
  if (!priceEstimate?.trim()) return undefined;
  const digits = priceEstimate.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : undefined;
}

function scoreCreator(
  card: SearchCreatorCardItem,
  fitScores: Record<string, number> | undefined,
  currency: string
): { score: number; reasonCode?: SlateRecommendationReasonCode; reason?: string } {
  // fitScores are ECI investment scores when Studio Sprint 2 wiring has run.
  const hasEciFit =
    fitScores?.[normalizeCreatorId(card.id)] != null || fitScores?.[card.id] != null;
  const fit = fitScores?.[normalizeCreatorId(card.id)] ?? fitScores?.[card.id] ?? 60;
  const er = card.engagementRate ?? 2;
  const erScore = Math.min(er / 5, 1) * 100;

  const feeEstimate = estimateCreatorPostFee({
    followers: card.followers,
    platform: card.platform,
    currency,
  });
  const quotedFee = parseFeeAmount(feeEstimate);
  let pricePenalty = 0;
  let reasonCode: SlateRecommendationReasonCode | undefined;
  let reason: string | undefined;

  if (quotedFee != null && card.followers) {
    const tier = creatorTierOf(card).toLowerCase();
    const perFollower = quotedFee / Math.max(card.followers, 1);
    if (tier === "micro" && perFollower > 0.004) {
      pricePenalty = 25;
      reasonCode = "high_price";
      reason = "Fee runs high for this tier — consider as alternate";
    } else if (tier === "mid" && perFollower > 0.002) {
      pricePenalty = 20;
      reasonCode = "high_price";
      reason = "Above typical Mid-tier rate card";
    }
  }

  if ((card.followers ?? 0) < 5_000 && !reasonCode) {
    reasonCode = "reach_risk";
    reason = "Reach may under-deliver for this tier target";
  }

  if (!reason && hasEciFit) {
    reason = `Enterprise Creator Intelligence investment ${Math.round(fit)}/100`;
  }

  const score = fit * 0.45 + erScore * 0.35 + Math.max(0, 100 - pricePenalty) * 0.2;
  return { score, reasonCode, reason };
}

function readActivationWeeks(
  campaignObject: CampaignObject
): Array<{ week: number; tier: string; label: string }> {
  const timelineData = campaignObject.sections.timeline.data as TimelineSectionExtras | undefined;
  const activation = timelineData?.creatorActivationTimeline?.activationWeeks;
  if (activation?.length) {
    return activation.map((entry) => ({
      week: entry.week,
      tier: entry.tier,
      label: `Week ${entry.week} · ${entry.objective || entry.tier}`,
    }));
  }

  const milestones =
    (campaignObject.sections.timeline.data as { milestones?: Array<{ week: number; phase: string }> } | undefined)
      ?.milestones ?? [];
  return milestones.map((m) => ({
    week: m.week,
    tier: "",
    label: `Week ${m.week} · ${m.phase}`,
  }));
}

function suggestTimelineSlot(
  card: SearchCreatorCardItem,
  activationWeeks: Array<{ week: number; tier: string; label: string }>,
  index: number
): string | undefined {
  if (activationWeeks.length === 0) return undefined;

  const cardTier = creatorTierOf(card).toLowerCase();
  const tierWeek = activationWeeks.find((w) =>
    w.tier ? matchesTierLabel(w.tier, cardTier) : false
  );
  if (tierWeek) return tierWeek.label;

  const week = activationWeeks[index % activationWeeks.length];
  return week ? `${week.label} (advisory)` : undefined;
}

export function rankSlateRecommendations(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[],
  fitScores?: Record<string, number>
): SlateCreatorRecommendation[] {
  if (cards.length === 0) return [];

  const strategyMix = readStrategyMix(campaignObject);
  const targets = strategyTargetCounts(strategyMix, cards.length);
  const currency = getCampaignFacts(campaignObject)?.budget?.currency ?? "EGP";
  const activationWeeks = readActivationWeeks(campaignObject);

  const byTier = new Map<string, SearchCreatorCardItem[]>();
  for (const card of cards) {
    const tier = creatorTierOf(card).toLowerCase();
    let bucket = tier;
    for (const targetTier of targets.keys()) {
      if (matchesTierLabel(targetTier, tier)) {
        bucket = targetTier;
        break;
      }
    }
    const list = byTier.get(bucket) ?? [];
    list.push(card);
    byTier.set(bucket, list);
  }

  const recommendations: SlateCreatorRecommendation[] = [];
  let timelineIndex = 0;

  for (const [tierKey, tierCards] of byTier) {
    const targetCount = targets.get(tierKey) ?? Math.max(1, Math.ceil(tierCards.length / 2));
    const scored = tierCards
      .map((card) => {
        const { score, reasonCode, reason } = scoreCreator(card, fitScores, currency);
        return { card, score, reasonCode, reason };
      })
      .sort((a, b) => b.score - a.score);

    scored.forEach((entry, index) => {
      const role = index < targetCount ? "main" : "maybe";
      let reasonCode = entry.reasonCode;
      let reason = entry.reason;

      if (role === "maybe" && !reasonCode) {
        if (index === targetCount) {
          reasonCode = "client_choice";
          reason = "Strong alternate — client can choose between options";
        } else {
          reasonCode = "alternate";
          reason = "Backup pick if primary creators are unavailable";
        }
      }

      const slot = suggestTimelineSlot(entry.card, activationWeeks, timelineIndex);
      timelineIndex += 1;

      const waveMatch = slot?.match(/Week\s+(\d+)/i);
      const wave = waveMatch ? Number.parseInt(waveMatch[1]!, 10) : index + 1;
      const priority: SlateCreatorRecommendation["priority"] =
        role === "main" ? (index === 0 ? "high" : "medium") : "low";
      const serviceType =
        entry.card.platform === "tiktok"
          ? "1× TikTok video"
          : entry.card.platform === "youtube"
            ? "1× YouTube integration"
            : "1× IG Reel";
      const contentPillar =
        entry.card.categories?.[0] ??
        entry.card.contentIdea?.split("·")[0]?.trim() ??
        "Brand story";

      recommendations.push({
        creatorId: entry.card.id,
        tier: canonicalTierLabel(creatorTierOf(entry.card)),
        role,
        reasonCode,
        reason,
        suggestedTimelineSlot: slot,
        wave,
        priority,
        serviceType,
        contentPillar,
        score: Math.round(entry.score),
      });
    });
  }

  return recommendations;
}

export function computeSlateIntelligence(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[]
): SlateIntelligence {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const fitScores = creatorsData.recommendations?.creatorFitScores;
  const strategyMix = resolveCreatorMix(campaignObject);
  const actualMix = summarizeActualMix(cards);
  const tierShortages = detectTierShortages(strategyMix, cards);
  const recommendations = rankSlateRecommendations(campaignObject, cards, fitScores);

  return {
    actualMix,
    tierShortages,
    recommendations,
    updatedAt: new Date().toISOString(),
  };
}

export function patchSlateIntelligence(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[]
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateIntelligence = computeSlateIntelligence(campaignObject, cards);

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: {
          ...creatorsData,
          slateIntelligence,
        } satisfies CreatorsSectionData as unknown as Record<string, unknown>,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Build vendor slate entries from shortlist unified creators. */
export function buildRecommendationsFromShortlistCreators(
  creators: Array<{
    unified_id: string;
    display_name: string;
    platforms?: Array<{ platform?: string; handle?: string | null; follower_count?: number | null }>;
    metrics?: { followers?: { value?: number | null }; engagement_rate?: { value?: number | null } };
    role?: string | null;
    brand_fit_score?: number | null;
  }>
): CreatorsSectionData["recommendations"] {
  const creatorIds: string[] = [];
  const selectedReasoning: NonNullable<
    CreatorsSectionData["recommendations"]
  >["selectedReasoning"] = [];

  for (const creator of creators) {
    const id = creator.unified_id;
    if (!id) continue;
    creatorIds.push(id);

    const platform = creator.platforms?.[0];
    const followers =
      creator.metrics?.followers?.value ?? platform?.follower_count ?? undefined;
    const tier = resolveCreatorTierLabel({ followers, role: creator.role });

    selectedReasoning.push({
      creatorId: id,
      displayName: creator.display_name,
      platform: platform?.platform ?? undefined,
      handle: platform?.handle ?? undefined,
      whySelected:
        "Imported from Discovery shortlist — Enterprise Creator Intelligence applied on planning hydrate",
      expectedRole: tier,
      audienceMatch: "",
      risk: "",
      alternative: "",
      confidence: 0.75,
      evidence: "Shortlist sync",
      tradeoff: "",
    });
  }

  return {
    creatorIds,
    creatorFitScores: undefined,
    selectedReasoning,
    rationale: `${creatorIds.length} creator${creatorIds.length === 1 ? "" : "s"} from shortlist`,
  };
}
