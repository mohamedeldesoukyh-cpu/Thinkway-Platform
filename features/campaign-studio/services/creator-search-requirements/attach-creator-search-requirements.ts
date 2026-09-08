/**
 * Attach Strategy-derived Creator Search Requirements to a Campaign Object.
 *
 * Phase 1 persistence step. This runs AFTER slate selection has completed and
 * only ever adds `sections.creators.data.searchRequirements`. It reads nothing
 * that selection depends on and writes nothing that selection reads, so creator
 * recommendations are bit-for-bit unchanged.
 *
 * Version-aware (Phase 1 scope): an existing CSR is kept when it was generated
 * from the same Strategy revision, so repeated calls do not churn the object.
 * Re-ranking on Strategy change is deliberately NOT implemented yet.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";

import type { CreatorSearchRequirements } from "../../types/creator-search-requirements";
import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";

/** True when the stored CSR already reflects this Strategy revision. */
export function isCreatorSearchRequirementsCurrent(
  existing: CreatorSearchRequirements | undefined,
  strategyId: string | undefined,
  strategyVersion: number | undefined
): boolean {
  if (!existing) return false;
  if (!strategyId) return existing.strategyRef == null;
  return (
    existing.strategyRef?.id === strategyId && existing.strategyRef?.version === strategyVersion
  );
}

/**
 * Returns the campaign object with CSR attached. Returns the SAME reference when
 * an up-to-date CSR is already present.
 */
export function attachCreatorSearchRequirements(
  campaignObject: CampaignObject,
  options?: { now?: string }
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const strategy = getStrategyFromWorkflowData(
    campaignObject.meta as unknown as Record<string, unknown>
  );

  if (
    isCreatorSearchRequirementsCurrent(
      creatorsData.searchRequirements,
      strategy?.id,
      strategy?.version
    )
  ) {
    return campaignObject;
  }

  const requirements = buildCreatorSearchRequirements({
    strategy,
    facts: getCampaignFacts(campaignObject),
    campaignIntelligenceProfileId: creatorsData.cipProfileId,
    now: options?.now,
  });

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: {
          ...creatorsData,
          searchRequirements: requirements,
        } satisfies CreatorsSectionData as unknown as Record<string, unknown>,
      },
    },
  };
}
