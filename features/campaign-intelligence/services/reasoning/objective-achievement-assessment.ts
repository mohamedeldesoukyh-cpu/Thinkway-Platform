import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";
import type {
  GroundedElement,
  ObjectiveAchievementEntry,
  SuccessProbabilityData,
} from "@/features/campaign-intelligence/types/section-schemas";

import { buildIs1CampaignContext, formatBudgetRef } from "./campaign-context";

const VERIFICATION = "Verification required";

function parseObjectives(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): string[] {
  const raw = facts.objective ?? strategy.understanding.objective ?? "";
  const parts = raw
    .split(/[,;]| and /i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts;
  return [raw.trim() || "Campaign objective per brief"];
}

function objectiveEvidence(
  objective: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument
): string {
  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(", ");
  return `Brief evidence — ${ctx.brand}; objective ${objective}; budget ${formatBudgetRef(ctx)}; tier mix: ${tierMix || VERIFICATION}; ${ctx.durationWeeks} weeks on ${ctx.platforms.join("/") || "platforms TBD"}`;
}

function objectiveRisks(
  objective: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>
): string[] {
  const base = ctx.risks.slice(0, 2);
  if (/awareness/i.test(objective)) {
    base.push("Reach concentration in single tier may limit unique audience");
  }
  if (/ugc|content/i.test(objective)) {
    base.push("UGC quality variance across Nano/Micro roster");
  }
  if (/engagement/i.test(objective)) {
    base.push("Algorithm volatility on short-form platforms");
  }
  if (base.length === 0) base.push(VERIFICATION);
  return [...new Set(base)].slice(0, 3);
}

function objectiveRecommendations(
  objective: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument
): string[] {
  const recs: string[] = [];
  if (/awareness/i.test(objective)) {
    recs.push("Front-load Macro/Mega anchors Week 1–2 for credibility spike");
  }
  if (/ugc|content/i.test(objective)) {
    recs.push("Deploy Nano volume in Weeks 2–4 with claim-safe brief templates");
  }
  if (/engagement/i.test(objective)) {
    recs.push("Use participatory formats (duet/stitch/challenge) on TikTok/Instagram");
  }
  if (strategy.creatorTierStrategy.some((t) => /nano|micro/i.test(t.tier))) {
    recs.push(`Maintain ${ctx.durationWeeks}-week publishing cadence — avoid gaps mid-campaign`);
  }
  if (ctx.budgetAmount == null) {
    recs.push(`Confirm budget ${VERIFICATION.toLowerCase()} before final roster lock`);
  }
  return recs.length ? recs.slice(0, 3) : [VERIFICATION];
}

function confidenceForObjective(
  objective: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): number {
  let score = 78;
  if (ctx.budgetAmount != null) score += 4;
  if (strategy.creatorTierStrategy.length >= 2) score += 3;
  if (ctx.platforms.length >= 2) score += 2;
  if (/babyjoy|baby|coca|pepsi|samsung|l'?or[eé]al|loreal/i.test(ctx.brand.toLowerCase())) score += 3;
  if (debateResult?.meeting.winnerId) score += 2;
  if (/trial|conversion/i.test(objective) && !ctx.budgetAmount) score -= 5;
  return Math.min(92, Math.max(55, score));
}

export function buildObjectiveAchievementAssessment(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): SuccessProbabilityData {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const objectives = parseObjectives(facts, strategy);

  const objectiveAssessments: ObjectiveAchievementEntry[] = objectives.map((objective) => {
    const confidence = confidenceForObjective(objective, ctx, strategy, debateResult);
    return {
      objective,
      confidence,
      supportingEvidence: objectiveEvidence(objective, ctx, strategy),
      risks: objectiveRisks(objective, ctx),
      recommendations: objectiveRecommendations(objective, ctx, strategy),
    };
  });

  const avgConfidence = Math.round(
    objectiveAssessments.reduce((sum, entry) => sum + entry.confidence, 0) /
      Math.max(1, objectiveAssessments.length)
  );

  const strengths = objectiveAssessments.map(
    (entry) => `${entry.objective}: ${entry.confidence}% confidence — ${entry.supportingEvidence.split(";")[0]}`
  );

  const weaknesses = objectiveAssessments
    .filter((entry) => entry.confidence < 80)
    .map((entry) => `${entry.objective} below 80% confidence — ${entry.risks[0] ?? VERIFICATION}`);

  if (weaknesses.length === 0 && ctx.budgetAmount == null) {
    weaknesses.push(`Budget ${VERIFICATION.toLowerCase()} — limits roster depth validation`);
  }

  const risks = [...new Set(objectiveAssessments.flatMap((entry) => entry.risks))].slice(0, 5);
  const improvements = [
    ...new Set(objectiveAssessments.flatMap((entry) => entry.recommendations)),
  ].slice(0, 5);

  const debateNote = debateResult
    ? `Director debate winner Option ${debateResult.meeting.winnerId} assumptions applied.`
    : "";

  const grounding: GroundedElement = {
    source: "AI",
    confidence: avgConfidence,
    reason: `Objective Achievement Assessment — ${objectives.length} objective(s) scored from CampaignFacts + Director strategy`,
    evidence: `${formatBudgetRef(ctx)} · ${ctx.durationWeeks} weeks · ${debateNote}`.trim(),
  };

  return {
    score: avgConfidence,
    strengths,
    weaknesses: weaknesses.length ? weaknesses : [`No major gaps — monitor ${objectives[0]}`],
    risks,
    improvements,
    grounding,
    objectiveAssessments,
  };
}
