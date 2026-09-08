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
 *
 * Two entry points, because CSR is built from three sources but the two existing
 * callers are synchronous and have no database access:
 *
 *   attachCreatorSearchRequirements(...)                     — sync; caller may
 *       supply already-resolved validated intelligence.
 *   attachCreatorSearchRequirementsWithValidatedIntelligence — async; resolves
 *       validated intelligence from the campaign's CIP, then delegates to the
 *       sync path. Resolution is read-only and reuses the canonical helper; it
 *       never re-parses a brief.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import { getValidatedIntelligence } from "@/features/campaign-intelligence-profile/services/get-validated-intelligence";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";
import { getCampaignIntelligenceProfileById } from "@/features/campaign-intelligence-profile/services/profile-repository";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

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
  options?: {
    now?: string;
    /**
     * Canonical validated intelligence, already resolved by the caller.
     * Omitted by the synchronous callers, which have no database access — CSR
     * is then built from Strategy + Facts exactly as before.
     */
    validated?: ValidatedCampaignIntelligence | null;
  }
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
    validated: options?.validated,
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

/**
 * Resolve canonical validated intelligence for a campaign object.
 *
 * Reuses the existing repository read and the canonical
 * `getValidatedIntelligence()` resolver — which prefers
 * `profile.validatedIntelligence` and otherwise derives from
 * `profile.normalizedEntities`. It never re-parses a raw brief.
 *
 * Returns undefined (never throws) when there is no `cipProfileId`, the profile
 * cannot be retrieved, or the profile carries no validated intelligence, so the
 * caller falls back to the existing Strategy + Facts behaviour.
 */
export async function resolveValidatedIntelligenceForCampaignObject(
  supabase: SupabaseClient,
  campaignObject: CampaignObject
): Promise<ValidatedCampaignIntelligence | undefined> {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const profileId = creatorsData.cipProfileId?.trim();
  if (!profileId) return undefined;

  try {
    const row = await getCampaignIntelligenceProfileById(supabase, profileId);
    if (!row) return undefined;
    return getValidatedIntelligence(normalizeCampaignIntelligenceProfile(row.profile));
  } catch {
    // A profile read failure must never break slate proposal or CSR attachment.
    return undefined;
  }
}

/**
 * Server-side attachment: resolves validated intelligence from the campaign's
 * Campaign Intelligence Profile, then delegates to the synchronous path so CSR
 * is built from Strategy + Validated Intelligence + Facts.
 *
 * Idempotence is unchanged and checked first: when the stored CSR already
 * reflects the current Strategy revision the object is returned untouched and
 * no profile read is issued.
 */
export async function attachCreatorSearchRequirementsWithValidatedIntelligence(
  supabase: SupabaseClient,
  campaignObject: CampaignObject,
  options?: { now?: string }
): Promise<CampaignObject> {
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

  const validated = await resolveValidatedIntelligenceForCampaignObject(supabase, campaignObject);
  return attachCreatorSearchRequirements(campaignObject, { ...options, validated });
}
