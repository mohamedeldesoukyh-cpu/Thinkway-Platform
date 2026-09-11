/**
 * What may be OFFERED as a replacement creator.
 *
 * Browser evidence: the Kérastase campaign — Beauty & Personal Care, creator
 * categories Beauty and Fashion, premium haircare, Instagram + TikTok, Egypt,
 * Strategy-approved tiers Macro / Mid / Micro — offered `aber_kitchen`, a
 * Food creator, as a replacement.
 *
 * Cause: `candidateIsSelectable` treated only `outside_market` as
 * disqualifying and called a brief-mix miss "advisory", so an off-category
 * creator stayed on the offer list with a badge. That reading is what the
 * browser disproved: the brief's creator categories are a campaign requirement,
 * not a preference, and a Food creator is not a candidate for a haircare
 * campaign in any tier.
 *
 * No new scoring system and no new eligibility source. Eligibility is the
 * campaign requirement set `classifyReplacementCandidates` already computes
 * from `vendorMatchesCampaignMarket` and `vendorFitsStudioBriefMix` — the same
 * predicates the recommendation gate uses. Ordering reuses the Strategy's
 * approved tiers. Platform Score is not consulted, and neither is ECI.
 */

import type { CandidateIneligibility, ClassifiedCandidate } from "./studio-replacement-candidates";

/**
 * A replacement must satisfy EVERY campaign requirement the classifier checked.
 *
 * Distinct from `candidateIsSelectable`, which governs whether a listed
 * alternative can still be picked: an off-category creator remains VISIBLE in
 * the alternatives list with its reason — nothing is hidden — but it is not
 * offered as a replacement for a creator on this campaign's slate.
 */
export function replacementCandidateIsEligible<T>(
  candidate: ClassifiedCandidate<T>
): boolean {
  return candidate.ineligibility == null;
}

/** Why an otherwise-hydrated candidate is not offered, for the operator. */
export const REPLACEMENT_EXCLUSION_REASON: Record<CandidateIneligibility, string> = {
  outside_market: "outside the campaign's market",
  off_brief_mix: "outside the campaign's creator categories",
};

function tierKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "");
}

/**
 * Role-aware ordering, and nothing off-strategy.
 *
 * Replacing a Mid Beauty creator should offer Mid candidates first. When the
 * exact tier is unavailable the Strategy's other approved tiers follow — the
 * same shortage-then-coverage order `composeCreatorSlate` works in — and a tier
 * the Strategy did not approve is dropped rather than silently substituted.
 *
 * With no approved tier set (a campaign that never stated one), nothing is
 * dropped: an unstated requirement cannot disqualify a creator.
 */
export function orderReplacementCandidatesByRole<T>(
  candidates: T[],
  options: {
    /** Tier of the creator being replaced, when replacing rather than adding. */
    targetTier?: string | null;
    tierOf: (candidate: T) => string | null | undefined;
    /** Strategy-approved tiers. Empty or absent means the campaign stated none. */
    approvedTiers?: Array<string | null | undefined>;
  }
): T[] {
  const approved = new Set(
    (options.approvedTiers ?? []).map(tierKey).filter(Boolean)
  );
  const target = tierKey(options.targetTier);

  const onStrategy =
    approved.size === 0
      ? candidates
      : candidates.filter((candidate) => {
          const key = tierKey(options.tierOf(candidate));
          // A candidate whose tier is unknown is not excluded for it — missing
          // data is missing, not disqualifying.
          return !key || approved.has(key);
        });

  if (!target) return onStrategy;

  const sameRole: T[] = [];
  const otherApproved: T[] = [];
  for (const candidate of onStrategy) {
    if (tierKey(options.tierOf(candidate)) === target) sameRole.push(candidate);
    else otherApproved.push(candidate);
  }
  return [...sameRole, ...otherApproved];
}

/**
 * What to tell the operator when the campaign has no eligible replacement.
 *
 * Silence here is what let an unrelated creator look like the answer. Browsing
 * Discovery with the campaign's own confirmed filters stays available — this
 * states why the recommended-candidate route is empty.
 */
export function replacementShortageNote(input: {
  /** Candidates hydrated for this campaign, before eligibility. */
  consideredCount: number;
  /** Counts by the requirement that excluded them. */
  excludedBy: Partial<Record<CandidateIneligibility, number>>;
}): string | null {
  if (input.consideredCount === 0) return null;
  const parts = (Object.keys(input.excludedBy) as CandidateIneligibility[])
    .filter((reason) => (input.excludedBy[reason] ?? 0) > 0)
    .map((reason) => `${input.excludedBy[reason]} ${REPLACEMENT_EXCLUSION_REASON[reason]}`);
  if (parts.length === 0) return null;
  return `No eligible replacement from this campaign's candidates — ${parts.join(
    ", "
  )}. Browse Discovery with the campaign's confirmed filters instead.`;
}
