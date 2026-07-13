import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  PendingCreatorProposal,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { buildCreatorRecommendationData, formatRecommendationDisplay } from "@/features/campaign-intelligence/services/structured-section-builders";
import {
  buildCreatorMixFromFacts,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";

import { composeCreatorSlate } from "./creator-slate";
import { computeSlateIntelligence } from "./slate-intelligence";
import { groundedCreatorToSearchCard } from "./plan-section-regeneration";

export type ProposeCreatorSlateOptions = {
  poolCreators?: GroundedCreator[];
  query?: string;
};

export type ProposeCreatorSlateResult = {
  campaignObject: CampaignObject;
  proposed: boolean;
  blockedReason?: CreatorsSectionData["slateProposalStatus"];
};

/**
 * After Campaign Director approval, auto-propose an initial creator slate from
 * discovery/search results. First run commits immediately; re-runs use
 * pendingProposal and only replace committed recommendations on success.
 */
export function proposeInitialCreatorSlate(
  campaignObject: CampaignObject,
  options: ProposeCreatorSlateOptions = {}
): CampaignObject {
  return proposeInitialCreatorSlateWithStatus(campaignObject, options).campaignObject;
}

export function proposeInitialCreatorSlateWithStatus(
  campaignObject: CampaignObject,
  options: ProposeCreatorSlateOptions = {}
): ProposeCreatorSlateResult {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const existingIds = creatorsData.recommendations?.creatorIds ?? [];
  const isRerun = existingIds.length > 0;

  if (
    existingIds.length > 0 &&
    creatorsData.phase !== "discovery" &&
    creatorsData.pendingProposal?.status !== "generating"
  ) {
    return { campaignObject, proposed: true };
  }

  const pool = resolveProposalPool(campaignObject, options.poolCreators) ?? [];
  if (pool.length === 0) {
    const blocked = blockedStatusFor(campaignObject);
    if (isRerun) {
      return {
        campaignObject: withRerunProposalFailure(campaignObject, blocked),
        proposed: false,
        blockedReason: blocked,
      };
    }
    return {
      campaignObject: withSlateProposalBlocked(campaignObject, blocked),
      proposed: false,
      blockedReason: blocked,
    };
  }

  const facts = getCampaignFacts(campaignObject);
  const strategy = getStrategyFromWorkflowData(
    campaignObject.meta as unknown as Record<string, unknown>
  );

  const cards = pool.map(groundedCreatorToSearchCard);
  const tierMix = facts ? buildCreatorMixFromFacts(facts) : [];
  const targetCount =
    tierMix.reduce((s, t) => s + (t.count ?? 0), 0) || Math.min(cards.length, 12);
  const { creators: ranked } = composeCreatorSlate(cards, {
    platforms: facts?.platforms,
    tierMix,
    targetCount,
  });

  const recommendationData = buildCreatorRecommendationData(
    ranked.map((c, index) => ({
      id: c.id,
      handle: c.handle,
      displayName: c.displayName,
      platform: c.platform,
      followers: c.followers,
      engagementRate: c.engagementRate,
      avatarUrl: c.avatarUrl,
      profileUrl: c.profileUrl,
      campaignRelevanceScore: c.campaignRelevanceScore,
      fitScore: c.campaignRelevanceScore ?? 70,
      rank: index + 1,
    })),
    options.query,
    facts,
    strategy,
    pool
  );

  if (!recommendationData.creatorIds.length) {
    const blocked = {
      status: "blocked" as const,
      reason: "insufficient_pool" as const,
      message:
        "Could not rank creators into a slate — run Vendor Discovery or import a shortlist, then review.",
      actionLabel: "Run Vendor Discovery",
      updatedAt: new Date().toISOString(),
    };
    if (isRerun) {
      return {
        campaignObject: withRerunProposalFailure(campaignObject, blocked),
        proposed: false,
        blockedReason: blocked,
      };
    }
    return {
      campaignObject: withSlateProposalBlocked(campaignObject, blocked),
      proposed: false,
      blockedReason: blocked,
    };
  }

  const recommendationsDisplay = formatRecommendationDisplay(ranked, options.query);
  const withRecommendations = commitCreatorProposal(campaignObject, {
    recommendationData,
    recommendationsDisplay,
    ranked,
    poolSource: poolSourceLabel(options.poolCreators, creatorsData),
    isRerun,
  });

  return { campaignObject: withRecommendations, proposed: true };
}

function commitCreatorProposal(
  campaignObject: CampaignObject,
  input: {
    recommendationData: NonNullable<CreatorsSectionData["recommendations"]>;
    recommendationsDisplay: string;
    ranked: ReturnType<typeof composeCreatorSlate>["creators"];
    poolSource: string;
    isRerun: boolean;
  }
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateIntelligence = computeSlateIntelligence(campaignObject, input.ranked);
  const now = new Date().toISOString();

  const nextData: CreatorsSectionData = {
    ...creatorsData,
    phase: "proposal",
    recommendations: input.recommendationData,
    recommendationsDisplay: input.recommendationsDisplay,
    vendorDecisions: undefined,
    linkedShortlistId: undefined,
    vendorGrounding: undefined,
    lastShortlistAt: now,
    slateIntelligence,
    slateProposalStatus: {
      status: "proposed",
      message: `Auto-proposed ${input.recommendationData.creatorIds.length} creators from ${input.poolSource}.`,
      updatedAt: now,
    },
    pendingProposal: undefined,
  };

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: nextData satisfies CreatorsSectionData as unknown as Record<string, unknown>,
      },
    },
    updatedAt: now,
  };
}

function withRerunProposalFailure(
  campaignObject: CampaignObject,
  status: NonNullable<CreatorsSectionData["slateProposalStatus"]>
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const pendingProposal: PendingCreatorProposal = {
    status: "failed",
    error: {
      reason: status.reason ?? "insufficient_pool",
      message: status.message,
      actionLabel: status.actionLabel,
    },
    generatedAt: new Date().toISOString(),
  };

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: {
          ...creatorsData,
          pendingProposal,
          slateProposalStatus: {
            ...status,
            status: "blocked",
          },
        } satisfies CreatorsSectionData as unknown as Record<string, unknown>,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function resolveProposalPool(
  campaignObject: CampaignObject,
  poolCreators?: GroundedCreator[]
): GroundedCreator[] | undefined {
  if (poolCreators && poolCreators.length > 0) return poolCreators;
  const fromDiscovery = readDiscoveryPool(campaignObject);
  if (fromDiscovery && fromDiscovery.length > 0) return fromDiscovery;
  const fromStrategy = readStrategyVendorPool(campaignObject);
  if (fromStrategy && fromStrategy.length > 0) return fromStrategy;
  return undefined;
}

function blockedStatusFor(
  campaignObject: CampaignObject
): NonNullable<CreatorsSectionData["slateProposalStatus"]> {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const hasDiscovery = (creatorsData.discovery?.creatorIds?.length ?? 0) > 0;
  const hasStrategyVendors =
    (creatorsData.recommendations?.selectedReasoning?.length ?? 0) > 0;

  if (!hasDiscovery && !hasStrategyVendors) {
    return {
      status: "blocked",
      reason: "no_discovery_results",
      message: "No discovery results — run Vendor Discovery to auto-propose a creator slate.",
      actionLabel: "Run Vendor Discovery",
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    status: "blocked",
    reason: "no_strategy_vendors",
    message:
      "Discovery returned no rankable creators — run Vendor Discovery again or import a shortlist.",
    actionLabel: "Run Vendor Discovery",
    updatedAt: new Date().toISOString(),
  };
}

function withSlateProposalBlocked(
  campaignObject: CampaignObject,
  status: NonNullable<CreatorsSectionData["slateProposalStatus"]>
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: {
          ...creatorsData,
          slateProposalStatus: status,
        } satisfies CreatorsSectionData as unknown as Record<string, unknown>,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function poolSourceLabel(
  poolCreators: GroundedCreator[] | undefined,
  creatorsData: CreatorsSectionData
): string {
  if (poolCreators && poolCreators.length > 0) return "discovery search results";
  if ((creatorsData.discovery?.creatorIds?.length ?? 0) > 0) return "stored discovery results";
  return "Director strategy vendor recommendations";
}

function readDiscoveryPool(campaignObject: CampaignObject): GroundedCreator[] | undefined {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const discoveryIds = creatorsData.discovery?.creatorIds ?? [];
  if (discoveryIds.length === 0) return undefined;

  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  return discoveryIds.map((id, index) => {
    const entry = reasoning.find((r) => r.creatorId === id);
    return groundedFromReasoning(id, entry, index);
  });
}

/** Fallback when workflow searchResults are unavailable — use Director IS-1 vendor metadata. */
function readStrategyVendorPool(campaignObject: CampaignObject): GroundedCreator[] | undefined {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  const withIds = reasoning.filter((entry) => entry.creatorId?.trim());
  if (withIds.length === 0) return undefined;

  return withIds.map((entry, index) => groundedFromReasoning(entry.creatorId, entry, index));
}

function groundedFromReasoning(
  id: string,
  entry: VendorSelectedReasoning | undefined,
  index: number
): GroundedCreator {
  return {
    id,
    handle: entry?.handle ?? `@creator${index + 1}`,
    displayName: entry?.displayName ?? `Creator ${index + 1}`,
    platform: entry?.platform ?? "instagram",
    fitScore: entry?.confidence != null ? Math.round(entry.confidence * 100) : 70,
    rank: index + 1,
  };
}
