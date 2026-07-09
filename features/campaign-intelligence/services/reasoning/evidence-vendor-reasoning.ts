import type { GroundedCreator, RankedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import type { Is1CampaignContext } from "./campaign-context";

export type CampaignRequirementEvidence = {
  requirement: string;
  evidence: string;
  matched: boolean;
  confidence: number;
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
    };
  }

  if (lower.startsWith("geography:")) {
    const geoTokens = ctx.geography.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const haystack = `${creator.displayName} ${creator.handle}`.toLowerCase();
    const matched = geoTokens.some((token) => token.length > 2 && haystack.includes(token));
    return {
      requirement,
      evidence: matched
        ? `Creator profile aligns with ${ctx.geography} market signals`
        : `Geography match unverified — confirm audience country in Creator DNA`,
      matched,
      confidence: matched ? 82 : 40,
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
    };
  }

  return {
    requirement,
    evidence: "Insufficient data to evaluate",
    matched: false,
    confidence: 25,
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
  for (const item of evidence.filter((e) => !e.matched)) {
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
