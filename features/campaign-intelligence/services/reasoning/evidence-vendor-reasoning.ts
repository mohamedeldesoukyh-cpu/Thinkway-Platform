import type { GroundedCreator, RankedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import { resolveCountryCode } from "@/lib/creators/country-code";

import type { Is1CampaignContext } from "./campaign-context";

export type CampaignRequirementEvidence = {
  requirement: string;
  evidence: string;
  matched: boolean;
  confidence: number;
  /**
   * The requirement could not be evaluated because the CREATOR RECORD lacks
   * the field it needs — as opposed to being evaluated and not matching.
   *
   * Only this belongs in `missingData`, which Package reports as "missing from
   * the enrichment records of creators on this slate". A creator whose country
   * is on record but outside the market is a fit judgement for ranking, not an
   * enrichment gap, and reporting it as one held the package at "in progress"
   * with an instruction (refresh intelligence) that could never clear it.
   */
  dataMissing: boolean;
};

function creatorFitScore(creator: GroundedCreator): number {
  return (
    creator.campaignRelevanceScore ??
    (creator as RankedCreator).fitScore ??
    undefined
  );
}

function buildRequirements(ctx: Is1CampaignContext): string[] {
  const requirements: string[] = [];
  if (ctx.objective) requirements.push(`Objective: ${ctx.objective}`);
  if (ctx.audience) requirements.push(`Audience: ${ctx.audience}`);
  if (ctx.geography) requirements.push(`Geography: ${ctx.geography}`);
  if (ctx.platforms.length) requirements.push(`Platform: ${ctx.platforms.join(", ")}`);
  return requirements;
}

function evaluateRequirement(
  requirement: string,
  creator: GroundedCreator,
  ctx: Is1CampaignContext
): CampaignRequirementEvidence {
  const lower = requirement.toLowerCase();

  if (lower.startsWith("platform:")) {
    const needed = ctx.platforms.map((p) => p.toLowerCase());
    const actual = (creator.platform ?? "").toLowerCase();
    const matched = needed.length === 0 || needed.includes(actual);
    return {
      requirement,
      evidence: matched
        ? `Active on ${creator.platform ?? "unknown platform"}`
        : `Primary platform ${creator.platform ?? "unknown"} — verify multi-platform presence`,
      matched,
      confidence: matched ? 88 : 35,
      dataMissing: !creator.platform,
    };
  }

  if (lower.startsWith("geography:")) {
    /*
     * Judge the market requirement against the creator's GEOGRAPHY.
     *
     * This used to search the campaign's market tokens in
     * `${displayName} ${handle}` — so a creator recorded in Egypt matched only
     * if "egypt" appeared in their username. Practically no creator passed,
     * every slate row carried `missingData: ["Geography"]`, and Package sat at
     * "Discovery — in progress" claiming geography was missing from creator
     * enrichment records that actually held it. The creator's country is now
     * carried through `GroundedCreator.country`, and country names and ISO-2
     * codes are compared through the platform's one country registry.
     *
     * A creator with no country on record is still unverified — that is a real
     * enrichment gap, and the name heuristic remains as the only signal left.
     */
    const wanted = ctx.geography
      .split(/[,/]+/)
      .map((value) => resolveCountryCode(value))
      .filter(Boolean);
    const creatorCountry = resolveCountryCode(creator.country);
    if (creatorCountry) {
      const matched = wanted.length === 0 || wanted.includes(creatorCountry);
      return {
        requirement,
        evidence: matched
          ? `Creator record country ${creatorCountry} matches ${ctx.geography}`
          : `Creator record country ${creatorCountry} is outside ${ctx.geography}`,
        matched,
        confidence: matched ? 82 : 40,
        // The country is on record either way — nothing to enrich.
        dataMissing: false,
      };
    }
    const geoTokens = ctx.geography.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const haystack = `${creator.displayName} ${creator.handle}`.toLowerCase();
    const matched = geoTokens.some((token) => token.length > 2 && haystack.includes(token));
    return {
      requirement,
      evidence: matched
        ? `Creator profile aligns with ${ctx.geography} market signals`
        : `Geography match unverified — no country on the creator record`,
      matched,
      confidence: matched ? 82 : 40,
      dataMissing: !matched,
    };
  }

  if (lower.startsWith("audience:")) {
    const er =
      creator.engagementRate != null
        ? `${creator.engagementRate}% engagement rate`
        : "engagement rate missing";
    const followers =
      creator.followers != null
        ? `${creator.followers.toLocaleString()} followers`
        : "follower count missing";
    const matched = creator.followers != null || creator.engagementRate != null;
    return {
      requirement,
      evidence: `${followers}, ${er} on ${creator.platform ?? "platform TBD"}`,
      matched,
      confidence: matched ? 75 : 30,
      dataMissing: !matched,
    };
  }

  if (lower.startsWith("objective:")) {
    const score = creatorFitScore(creator);
    const matched = score != null && score >= 50;
    return {
      requirement,
      evidence:
        score != null
          ? `Campaign fit score ${score}/100 from brief criteria + creator profile`
          : "Campaign fit score unavailable — template fallback used",
      matched,
      confidence: score ?? 45,
      dataMissing: score == null,
    };
  }

  return {
    requirement,
    evidence: "Insufficient data to evaluate",
    matched: false,
    confidence: 25,
    dataMissing: true,
  };
}

export function buildCreatorRequirementEvidence(
  creator: GroundedCreator,
  ctx: Is1CampaignContext
): CampaignRequirementEvidence[] {
  return buildRequirements(ctx).map((requirement) =>
    evaluateRequirement(requirement, creator, ctx)
  );
}

export function formatEvidenceSummary(items: CampaignRequirementEvidence[]): string {
  const matched = items.filter((item) => item.matched);
  if (matched.length === 0) {
    return items.map((item) => `${item.requirement} → ${item.evidence} (unverified)`).join("; ");
  }
  return matched.map((item) => `${item.requirement} → ${item.evidence}`).join("; ");
}

export function evidenceMissingDataFields(
  creator: GroundedCreator,
  evidence: CampaignRequirementEvidence[]
): string[] {
  const missing: string[] = [];
  if (creator.followers == null) missing.push("Follower count");
  if (creator.engagementRate == null) missing.push("Engagement rate");
  if (!creator.platform) missing.push("Primary platform");
  if (creator.campaignRelevanceScore == null && !(creator as RankedCreator).fitScore) {
    missing.push("Campaign fit score");
  }
  // Only requirements the creator record cannot answer — see `dataMissing`.
  for (const item of evidence.filter((e) => e.dataMissing)) {
    missing.push(item.requirement.replace(/:.*/, ""));
  }
  return [...new Set(missing)];
}

export function buildEvidenceBasedSelection(
  creator: GroundedCreator,
  ctx: Is1CampaignContext,
  tier: string,
  index: number
): {
  whySelected: string;
  whyNotAnother: string;
  contribution: string;
  expectedRole: string;
  audienceMatch: string;
  risk: string;
  alternative: string;
  confidence: number;
  evidence: string;
  tradeoff: string;
  missingData: string[];
  manualVerification: string;
  directorNotes: string;
} {
  const requirementEvidence = buildCreatorRequirementEvidence(creator, ctx);
  const fitScore = creatorFitScore(creator) ?? 55;
  const missingData = evidenceMissingDataFields(creator, requirementEvidence);
  const evidenceSummary = formatEvidenceSummary(requirementEvidence);
  const usedTemplateFallback = requirementEvidence.every((item) => !item.matched);

  return {
    whySelected: usedTemplateFallback
      ? `${creator.displayName ?? creator.handle} — limited campaign evidence; ${evidenceSummary}`
      : `${creator.displayName ?? creator.handle} selected: ${evidenceSummary}`,
    whyNotAnother: `Lower-ranked creators missed required campaign signals or scored below ${Math.max(50, fitScore - 10)}/100 campaign fit.`,
    contribution: `${tier} tier supports ${ctx.objective} on ${ctx.platforms.join(", ") || "assigned platforms"}.`,
    expectedRole: `${tier} contributor — slot ${index + 1} in ranked shortlist`,
    audienceMatch: requirementEvidence.find((e) => e.requirement.startsWith("Audience:"))?.evidence
      ?? `Audience overlap assessed via creator metrics only — no inferred demographics.`,
    risk: missingData.length ? `Missing data: ${missingData.join(", ")}` : "Standard creator onboarding risk",
    alternative: `Next ranked creator from searchResults pool at rank ${index + 2}`,
    confidence: Math.min(95, Math.round(fitScore * 0.9)),
    evidence: evidenceSummary,
    tradeoff: `${tier} tier balances reach vs campaign-fit score (${fitScore}/100)`,
    missingData,
    manualVerification: missingData.length
      ? `Verify before booking: ${missingData.join(", ")}`
      : "Evidence complete from search ranking pipeline",
    directorNotes: usedTemplateFallback
      ? "Evidence-based reasoning degraded to template — missing campaign or creator fields."
      : "Evidence-linked selection from CIP search + relevance ranking pipeline.",
  };
}
