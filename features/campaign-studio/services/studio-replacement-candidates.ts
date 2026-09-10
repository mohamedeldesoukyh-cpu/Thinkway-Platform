/**
 * Eligibility of a replacement candidate — stated, never silently applied.
 *
 * `selectStudioRecommendedVendors` drops a creator from the recommendations
 * list on the campaign's own requirements: outside the campaign market, and off
 * the brief's creator mix. (It once also required a positive ECI investment
 * verdict; investment intelligence no longer decides campaign membership.)
 *
 * Deriving the alternatives from that same filtered list applied the rule to
 * candidates too, so a recommended creator that ECI later judged differently
 * simply vanished from "Other Recommended Creators" and the count shrank with
 * no explanation. The operator lost a replacement option and could not tell.
 *
 * The selected list keeps those gates exactly as they are. Candidates are
 * classified instead: every remaining recommendation is listed, and one that is
 * no longer eligible carries the reason. Nothing is hidden and nothing is
 * promoted — the operator sees the real state and decides.
 */

/**
 * Why a candidate would not join the campaign's recommendation.
 *
 * `eci_not_recommended` used to be one of these, labelled "Campaign
 * recommendation: not recommended" — an INVESTMENT verdict presented as the
 * campaign's answer. Investment intelligence no longer gates campaign
 * membership, so the class is gone with it; both remaining reasons are
 * requirements the campaign itself stated.
 */
export type CandidateIneligibility = "outside_market" | "off_brief_mix";

export const CANDIDATE_INELIGIBILITY_LABEL: Record<CandidateIneligibility, string> = {
  outside_market: "Outside campaign market",
  off_brief_mix: "Off brief creator mix",
};

export type ClassifiedCandidate<T> = {
  vendor: T;
  /** Absent when the candidate is fully eligible. */
  ineligibility?: CandidateIneligibility;
};

/**
 * Classify in the same order `selectStudioRecommendedVendors` tests, so a
 * candidate's stated reason is the one that would have removed it.
 *
 * Market is checked first and is the campaign's own geography — a hard
 * campaign rule rather than an enrichment judgement.
 */
export function classifyReplacementCandidates<T>(
  vendors: T[],
  gates: {
    matchesMarket: (vendor: T) => boolean;
    fitsBriefMix: (vendor: T) => boolean;
  }
): Array<ClassifiedCandidate<T>> {
  return vendors.map((vendor) => {
    if (!gates.matchesMarket(vendor)) {
      return { vendor, ineligibility: "outside_market" as const };
    }
    if (!gates.fitsBriefMix(vendor)) {
      return { vendor, ineligibility: "off_brief_mix" as const };
    }
    return { vendor };
  });
}

/**
 * Candidates offered as replacements.
 *
 * Market is a campaign rule, so an out-of-market creator is listed with its
 * reason but not offered. A brief-mix miss is advisory: the creator stays
 * selectable, flagged, because replacement runs through
 * `reoptimizeCampaignAfterApply`, which re-scores the campaign either way.
 */
export function candidateIsSelectable<T>(candidate: ClassifiedCandidate<T>): boolean {
  return candidate.ineligibility !== "outside_market";
}

export function summarizeCandidates<T>(candidates: Array<ClassifiedCandidate<T>>): {
  total: number;
  eligible: number;
  flagged: number;
  notSelectable: number;
} {
  let eligible = 0;
  let flagged = 0;
  let notSelectable = 0;
  for (const candidate of candidates) {
    if (!candidate.ineligibility) eligible += 1;
    else flagged += 1;
    if (!candidateIsSelectable(candidate)) notSelectable += 1;
  }
  return { total: candidates.length, eligible, flagged, notSelectable };
}

// ---------------------------------------------------------------------------
// Group semantics.
//
// The Creators screen renders creators in groups, and a group used to be
// identified only by its heading text. One heading said "Other Recommended
// Creators" while the cards inside it carried the ECI campaign decision — so a
// creator could sit under a "recommended" heading with a red "Not Recommended"
// pill and a reason. The two states come from different systems and both were
// telling the truth; the heading was the lie.
//
// Membership of the alternatives group means "searched by Discovery and not in
// the slate". It asserts nothing about the ECI decision, which is exactly why
// the heading must not claim a recommendation.

export type StudioCreatorGroupKind =
  /** The composed slate — every member passed the recommendation gate. */
  | "selected"
  /**
   * ON the canonical slate, but a campaign gate now rejects it.
   *
   * These used to appear NOWHERE. The selected group was
   * `marketVendors.filter(in slate)` — already gated — and the alternatives
   * group was the pool MINUS the slate, so a slate member the gate rejected
   * fell through both and disappeared from the screen. Content, which reads the
   * same slate ungated, kept showing all ten: ten in Content, three in Studio.
   *
   * They are the recommendation the campaign persisted, so they are shown; the
   * gate's verdict is shown with them; and they are not counted as recommended.
   */
  | "needs_review"
  /** Discovery's remaining pool, offered as replacements. Not a recommendation. */
  | "alternatives";

export type StudioCreatorGroup<T> = {
  kind: StudioCreatorGroupKind;
  title: string | null;
  items: T[];
};

export type StudioCreatorGroupConflict = {
  kind: StudioCreatorGroupKind;
  title: string | null;
  creatorId?: string;
  reason: "not_recommended_in_selected_group" | "recommendation_claimed_in_title";
};

/** Headings that assert a recommendation, and so may only head a slate group. */
const CLAIMS_RECOMMENDATION = /\brecommend(ed|ation)?\b/i;

/**
 * Contradictions between group membership and per-card recommendation state.
 *
 * Two rules, both about one screen telling one story:
 *   - a creator the ECI decision rejects may not sit in the SELECTED group;
 *   - a group that is not the selected slate may not claim a recommendation in
 *     its heading, because its members' decisions are shown per card.
 */
export function studioCreatorGroupConflicts<T>(
  groups: Array<StudioCreatorGroup<T>>,
  read: {
    /** The ECI campaign decision for this creator, when hydrated. */
    isNotRecommended: (item: T) => boolean;
    creatorIdOf?: (item: T) => string | undefined;
  }
): StudioCreatorGroupConflict[] {
  const conflicts: StudioCreatorGroupConflict[] = [];

  for (const group of groups) {
    if (group.kind !== "selected" && group.title && CLAIMS_RECOMMENDATION.test(group.title)) {
      conflicts.push({
        kind: group.kind,
        title: group.title,
        reason: "recommendation_claimed_in_title",
      });
    }
    if (group.kind !== "selected") continue;
    for (const item of group.items) {
      if (!read.isNotRecommended(item)) continue;
      conflicts.push({
        kind: group.kind,
        title: group.title,
        creatorId: read.creatorIdOf?.(item),
        reason: "not_recommended_in_selected_group",
      });
    }
  }

  return conflicts;
}
