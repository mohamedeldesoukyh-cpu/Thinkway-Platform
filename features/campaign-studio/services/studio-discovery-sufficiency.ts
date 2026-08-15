import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import { deriveCreatorQuantityRecommendation } from "./creator-quantity";
import { resolveCreatorCounts } from "./section-data-resolver";

export type StudioDiscoveryState =
  | "discovery_ready"
  | "acquisition_running"
  | "no_inventory"
  | "enrichment_required"
  | "insufficient_intelligence"
  | "discovery_sufficient";

export type StudioDiscoverySufficiency = {
  state: StudioDiscoveryState;
  title: string;
  detail: string;
  nextAction: string;
  inventoryCount: number;
  qualifiedCount: number;
  recommendedQuantity: number | null;
  missingIntelligence: string[];
  factsConfirmed: boolean;
};

function readCreatorsData(campaignObject: CampaignObject | undefined): CreatorsSectionData {
  return (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
}

function enrichmentGaps(creatorsData: CreatorsSectionData): string[] {
  const gaps = new Set<string>();
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    for (const missing of entry.missingData ?? []) {
      if (missing.trim()) gaps.add(missing.trim());
    }
  }
  const draftChanges = creatorsData.studioDraft?.changes ?? [];
  const pendingEnrichment = draftChanges.some(
    (change) =>
      change.kind === "add_creator" &&
      (change.creator.enrichmentStatus === "pending" ||
        change.creator.enrichmentStatus === "not_requested")
  );
  if (pendingEnrichment) gaps.add("Creator enrichment not complete");
  return [...gaps];
}

/**
 * Studio Discovery decision state from the Campaign Object.
 * Reuses stored pipeline / facts / quantity — does not enrich the whole DB.
 */
export function resolveStudioDiscoverySufficiency(
  campaignObject: CampaignObject | undefined,
  isRunning: boolean
): StudioDiscoverySufficiency {
  const facts = getCampaignFacts(campaignObject);
  const factsConfirmed = Boolean(facts);
  const creatorsData = readCreatorsData(campaignObject);
  const counts = resolveCreatorCounts(campaignObject);
  const inventoryCount = counts.discoveryIds.length;
  const qualifiedCount =
    counts.recommendationCount > 0 ? counts.recommendationCount : inventoryCount;
  const quantity = deriveCreatorQuantityRecommendation(facts, {
    poolSize: Math.max(inventoryCount, qualifiedCount),
  });
  const missingIntelligence = enrichmentGaps(creatorsData);
  const blocked = creatorsData.slateProposalStatus?.reason;
  const searching = isRunning || creatorsData.phase === "discovery";

  const base = {
    inventoryCount,
    qualifiedCount,
    recommendedQuantity: quantity.recommended,
    missingIntelligence,
    factsConfirmed,
  };

  if (searching && qualifiedCount === 0) {
    return {
      ...base,
      state: "acquisition_running",
      title: "Acquisition running",
      detail:
        "Discovery is searching inventory against confirmed campaign intelligence. Apify acquisition stays budget-capped — this does not enrich the whole database.",
      nextAction: "Wait for this run to finish, then review coverage versus the required profile.",
    };
  }

  if (!factsConfirmed) {
    return {
      ...base,
      state: "discovery_ready",
      title: "Confirm campaign intelligence first",
      detail:
        "Discovery is driven by confirmed Campaign Facts and Strategy. Confirm intelligence before searching inventory so quantity, market, and platforms are not invented.",
      nextAction: "Confirm Campaign Intelligence, then run Discovery against that profile.",
    };
  }

  if (inventoryCount === 0 && qualifiedCount === 0) {
    if (blocked === "no_discovery_results" || creatorsData.lastDiscoveryAt) {
      return {
        ...base,
        state: "no_inventory",
        title: "No matching inventory",
        detail:
          "This search did not return creators for the required profile. That is an inventory gap — not a dead end. Broaden non-mandatory filters, acquire a capped set, or import a shortlist.",
        nextAction: "Broaden Discovery filters, run capped acquisition, or import a shortlist.",
      };
    }
    return {
      ...base,
      state: "discovery_ready",
      title: "Discovery ready",
      detail: `Required profile is confirmed (${facts?.objective ?? "objective"} · ${(facts?.platforms ?? []).join(", ") || "platforms"} · ${facts?.geography?.join(", ") || "market"}). Inventory has not been searched yet.`,
      nextAction: "Run Discovery against the confirmed profile. Do not enrich the entire database.",
    };
  }

  if (missingIntelligence.length > 0 && qualifiedCount > 0) {
    return {
      ...base,
      state: "enrichment_required",
      title: "Enrichment required",
      detail: `Inventory exists, but ${missingIntelligence.slice(0, 3).join("; ")} is still missing. Enrich only the shortlisted creators — not the whole database.`,
      nextAction: "Refresh intelligence for the current slate, then re-check sufficiency.",
    };
  }

  const need = quantity.recommended ?? 0;
  if (need > 0 && qualifiedCount < need) {
    return {
      ...base,
      state: "insufficient_intelligence",
      title: "Insufficient qualified creators",
      detail: `${qualifiedCount} qualified creator${qualifiedCount === 1 ? "" : "s"} versus ${need} recommended for this brief. Coverage is too thin to treat Discovery as sufficient.`,
      nextAction: "Acquire or shortlist additional creators that match the required profile.",
    };
  }

  if (blocked === "insufficient_pool" || blocked === "no_strategy_vendors") {
    return {
      ...base,
      state: "insufficient_intelligence",
      title: "Insufficient intelligence to rank a slate",
      detail:
        creatorsData.slateProposalStatus?.message ??
        "Creators are present but cannot be ranked into a strategy-coherent slate yet.",
      nextAction: creatorsData.slateProposalStatus?.actionLabel ?? "Run Vendor Discovery again or import a shortlist.",
    };
  }

  return {
    ...base,
    state: "discovery_sufficient",
    title: "Discovery sufficient",
    detail: `${qualifiedCount} qualified creator${qualifiedCount === 1 ? "" : "s"} cover the recommended slate${
      need > 0 ? ` of ${need}` : ""
    }. Review recommendations and keep enrichment limited to this set.`,
    nextAction: "Review creator recommendations and lock the slate.",
  };
}
