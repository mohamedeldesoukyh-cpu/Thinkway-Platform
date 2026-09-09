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
 * CSR is built from Strategy + Validated Intelligence + Facts, but the attach
 * call sites are synchronous and have no database access. Validated intelligence
 * is therefore resolved upstream — in the workflow engine, which already holds a
 * Supabase client and the campaign's CIP id — parked on the workflow state as
 * `validatedCampaignIntelligence`, and threaded down through the existing
 * stateData argument, the same way `campaignFacts` already travels.
 *
 * Production chain:
 *   workflow-engine  → resolveValidatedIntelligenceForProfile(supabase, id)
 *                    → state.data.validatedCampaignIntelligence
 *   CampaignDirector.applyTaskResult(result, state.data)
 *                    → applyTaskResultToCampaignObject(..., stateData)
 *                    → proposeInitialCreatorSlate(obj, { validated })
 *                    → attachCreatorSearchRequirements(obj, { validated })
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  getCampaignFactsFromWorkflowData,
  getStrategyFromWorkflowData,
} from "@/features/campaign-director/services/campaign-director";
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
 * Resolve canonical validated intelligence for a Campaign Intelligence Profile.
 *
 * Reuses the existing repository read and the canonical
 * `getValidatedIntelligence()` resolver — which prefers
 * `profile.validatedIntelligence` and otherwise derives from
 * `profile.normalizedEntities`. It never re-parses a raw brief.
 *
 * Returns undefined (never throws) when there is no profile id, the profile
 * cannot be retrieved, or it carries no validated intelligence, so callers fall
 * back to the existing Strategy + Facts behaviour.
 */
export async function resolveValidatedIntelligenceForProfile(
  supabase: SupabaseClient,
  profileId: string | null | undefined
): Promise<ValidatedCampaignIntelligence | undefined> {
  const id = profileId?.trim();
  if (!id) return undefined;

  try {
    const row = await getCampaignIntelligenceProfileById(supabase, id);
    if (!row) return undefined;
    return getValidatedIntelligence(normalizeCampaignIntelligenceProfile(row.profile));
  } catch {
    // A profile read failure must never break the workflow or CSR attachment.
    return undefined;
  }
}

/**
 * Minimal structural view of workflow state — avoids importing the workflow
 * engine's types (and its module graph) into the CSR module.
 */
export type ValidatedIntelligenceStateCarrier = { data: Record<string, unknown> };

/**
 * Workflow-state contract: whenever `campaignIntelligenceProfileId` is present,
 * `validatedCampaignIntelligence` must hold the canonical validated intelligence
 * for that same profile, so the downstream synchronous CSR attachment receives it.
 *
 * Resolves at most once per profile id — `validatedCampaignIntelligenceProfileId`
 * records which profile the stored value belongs to, so a resume issues no query
 * when the value is already current, and a profile that changes mid-workflow is
 * re-resolved instead of going stale. Never throws.
 */
export async function hydrateValidatedIntelligenceOnState(
  state: ValidatedIntelligenceStateCarrier,
  supabase: SupabaseClient | undefined,
  profileId: string | null | undefined
): Promise<void> {
  const id = typeof profileId === "string" ? profileId.trim() : "";
  if (!supabase || !id) return;
  if (state.data.validatedCampaignIntelligenceProfileId === id) return;

  state.data.validatedCampaignIntelligence = await resolveValidatedIntelligenceForProfile(
    supabase,
    id
  );
  state.data.validatedCampaignIntelligenceProfileId = id;
}

/**
 * Build the pre-search CSR from workflow state.
 *
 * Phase 2. The CSR attached by `attachCreatorSearchRequirements` lands on the
 * Campaign Object AFTER slate proposal, which is after creator search — too
 * late to steer retrieval. The workflow engine calls this immediately before
 * the `search-creators` task instead, so the same contract, built by the same
 * pure builder, reaches live Discovery.
 *
 * Reads only what the engine already holds: the bootstrap Director-SSOT
 * strategy document, the validated intelligence hydrated by
 * `hydrateValidatedIntelligenceOnState`, and Campaign Facts. It performs no
 * I/O, invents nothing, and never consults campaign budget — a campaign
 * briefed without one produces a CSR and searches normally.
 */
export function buildPreSearchCreatorSearchRequirements(
  data: Record<string, unknown>,
  now?: string
): CreatorSearchRequirements {
  return buildCreatorSearchRequirements({
    strategy: getStrategyFromWorkflowData(data),
    validated: data.validatedCampaignIntelligence as ValidatedCampaignIntelligence | undefined,
    facts: getCampaignFactsFromWorkflowData(data),
    campaignIntelligenceProfileId:
      typeof data.campaignIntelligenceProfileId === "string"
        ? data.campaignIntelligenceProfileId
        : undefined,
    now,
  });
}
