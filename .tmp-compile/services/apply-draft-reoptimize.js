import { buildCreatorMixFromFacts, getCampaignFacts, } from "@/features/campaign-director/facts/facts-display-bridge";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { computeCampaignScores } from "./campaign-scores";
import { mapBrowseCreatorToSearchResult } from "./creator-platform-utils";
import { composeCreatorSlate, creatorTierOf } from "./creator-slate";
import { patchSlateIntelligence } from "./slate-intelligence";
import { normalizeCreatorId } from "./studio-draft";
/**
 * Post-apply re-optimization: re-rank the applied slate with the strategy
 * tier mix, refresh creator roles, and recompute the campaign scores from
 * the real creator data. Hand-picked creators are protected — re-ranking
 * reorders the slate but never drops a creator the team chose.
 */
export async function reoptimizeCampaignAfterApply(supabase, campaignObject, options = {}) {
    const creatorsData = (campaignObject.sections.creators.data ?? {});
    const recommendations = creatorsData.recommendations;
    const slateIds = recommendations?.creatorIds ?? [];
    if (slateIds.length === 0)
        return campaignObject;
    const facts = getCampaignFacts(campaignObject);
    // Hydrate production creators; dp:/dis: entries stay in place untouched.
    const influencerIds = [
        ...new Set(slateIds
            .map((id) => id.trim())
            .filter((id) => Boolean(id) && !id.startsWith("dp:") && !id.startsWith("dis:"))
            .map(normalizeCreatorId)),
    ];
    if (influencerIds.length === 0)
        return campaignObject;
    let cards;
    try {
        const result = await browseUnifiedCreators(supabase, { influencerIds, page: 1, pageSize: influencerIds.length, productionOnly: true }, "discovery");
        cards = result.creators.map((creator) => mapBrowseCreatorToSearchResult(creator, facts?.platforms));
    }
    catch {
        // Re-optimization is best-effort — an hydration failure must never lose the apply.
        return campaignObject;
    }
    if (cards.length === 0)
        return campaignObject;
    // Re-rank with the strategy mix; append anything compose dropped (e.g. a
    // hand-picked off-platform creator) so no chosen creator disappears.
    const tierMix = facts ? buildCreatorMixFromFacts(facts) : [];
    const { creators: ranked } = composeCreatorSlate(cards, {
        platforms: facts?.platforms,
        tierMix,
        targetCount: cards.length,
    });
    const rankedIds = new Set(ranked.map((c) => normalizeCreatorId(c.id)));
    const finalCards = [
        ...ranked,
        ...cards.filter((c) => !rankedIds.has(normalizeCreatorId(c.id))),
    ];
    // Preserve original id spelling (inf:-prefixed or raw) per creator.
    const originalIdByNormalized = new Map(slateIds.map((id) => [normalizeCreatorId(id), id]));
    const orderedIds = finalCards.map((card) => originalIdByNormalized.get(normalizeCreatorId(card.id)) ?? card.id);
    const unhydratedIds = slateIds.filter((id) => id.startsWith("dp:") ||
        id.startsWith("dis:") ||
        !finalCards.some((card) => normalizeCreatorId(card.id) === normalizeCreatorId(id)));
    // Roles follow the refreshed follower data; reasoning text is preserved.
    const reasoningByNormalized = new Map((recommendations?.selectedReasoning ?? []).map((entry) => [
        normalizeCreatorId(entry.creatorId),
        entry,
    ]));
    const nextReasoning = [];
    for (const card of finalCards) {
        const existing = reasoningByNormalized.get(normalizeCreatorId(card.id));
        if (!existing)
            continue;
        nextReasoning.push({ ...existing, expectedRole: creatorTierOf(card) });
    }
    for (const id of unhydratedIds) {
        const existing = reasoningByNormalized.get(normalizeCreatorId(id));
        if (existing)
            nextReasoning.push(existing);
    }
    const fitScores = recommendations?.creatorFitScores;
    const fitValues = Object.values(fitScores ?? {});
    const avgFitScore = fitValues.length > 0
        ? Math.round(fitValues.reduce((a, b) => a + b, 0) / fitValues.length)
        : recommendations?.avgFitScore;
    const scores = computeCampaignScores({
        cards: finalCards,
        facts,
        fitScores,
        tierMix,
        unenrichedCreatorIds: options.unenrichedCreatorIds,
    });
    const performanceData = (campaignObject.sections.performance.data ??
        {});
    const nextPerformance = {
        ...performanceData,
        campaignScores: scores,
        ...(performanceData.successProbability
            ? {
                successProbability: {
                    ...performanceData.successProbability,
                    score: scores.overall,
                },
            }
            : {}),
    };
    const withCreators = {
        ...campaignObject,
        sections: {
            ...campaignObject.sections,
            creators: {
                ...campaignObject.sections.creators,
                data: {
                    ...creatorsData,
                    recommendations: {
                        ...(recommendations ?? { creatorIds: [] }),
                        creatorIds: [...orderedIds, ...unhydratedIds],
                        selectedReasoning: nextReasoning,
                        avgFitScore,
                    },
                },
            },
            performance: {
                ...campaignObject.sections.performance,
                data: nextPerformance,
            },
        },
        updatedAt: new Date().toISOString(),
    };
    return patchSlateIntelligence(withCreators, finalCards);
}
