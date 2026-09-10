/**
 * Eligibility of a replacement candidate — stated, never silently applied.
 *
 * `selectStudioRecommendedVendors` drops a creator from the recommendations
 * list on three grounds: outside the campaign market, an ECI decision that is
 * not "Recommended", and off the brief's creator mix. Its own contract says
 * "Once a decision exists, only Recommended belongs on the 'recommended
 * creators' list" — that is a rule about the SELECTED slate.
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

export type CandidateIneligibility = "outside_market" | "eci_not_recommended" | "off_brief_mix";

export const CANDIDATE_INELIGIBILITY_LABEL: Record<CandidateIneligibility, string> = {
  outside_market: "Outside campaign market",
  eci_not_recommended: "ECI: not recommended",
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
    passesEciGate: (vendor: T) => boolean;
    fitsBriefMix: (vendor: T) => boolean;
  }
): Array<ClassifiedCandidate<T>> {
  return vendors.map((vendor) => {
    if (!gates.matchesMarket(vendor)) {
      return { vendor, ineligibility: "outside_market" as const };
    }
    if (!gates.passesEciGate(vendor)) {
      return { vendor, ineligibility: "eci_not_recommended" as const };
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
 * reason but not offered. An ECI judgement and a brief-mix miss are advisory:
 * the creator stays selectable, flagged, because replacement runs through
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
