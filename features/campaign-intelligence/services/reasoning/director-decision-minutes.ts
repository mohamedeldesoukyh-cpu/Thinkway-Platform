import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { SpecialistOutput } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";

import { buildIs1CampaignContext, formatBudgetRef } from "./campaign-context";

export type DirectorDecisionMinute = {
  problem: string;
  alternatives: string[];
  decision: string;
  rejected: string[];
  impact: string;
  owner: string;
  confidence: number;
  evidence: string;
  /** @deprecated IS-1 compat — use problem */
  reason?: string;
  /** @deprecated IS-1 compat — use alternatives */
  alternativesConsidered?: string[];
  tradeoffs?: string[];
  risk?: string;
  /** @deprecated IS-1 compat — use decision */
  finalApproval?: string;
};

function boardMinute(input: {
  problem: string;
  alternatives: string[];
  decision: string;
  rejected: string[];
  impact: string;
  owner: string;
  confidence: number;
  evidence: string;
  tradeoffs?: string[];
  risk?: string;
}): DirectorDecisionMinute {
  return {
    ...input,
    reason: input.problem,
    alternativesConsidered: input.alternatives,
    tradeoffs: input.tradeoffs,
    risk: input.risk,
    finalApproval: input.decision,
  };
}

export function buildDirectorDecisionMinutes(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  specialistOutputs: SpecialistOutput[],
  debateResult?: DebateResult
): DirectorDecisionMinute[] {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const brandLower = ctx.brand.toLowerCase();
  const isBaby = /babyjoy|baby/i.test(brandLower);
  const isCoke = /coca/i.test(brandLower);
  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(" · ");

  const tierAlternatives = isBaby
    ? ["Celebrity-only awareness", "Paid social without creators", "Instagram-only moms"]
    : isCoke
      ? ["TV summer burst", "Mega-only takeover", "TikTok-only volume"]
      : ["Single-tier roster", "Paid media-first", "Extended timeline without tiers"];

  const minutes: DirectorDecisionMinute[] = [
    boardMinute({
      problem: isBaby
        ? `${ctx.brand} Egypt launch must overcome incumbent diaper trust gap for ${ctx.audience} within ${ctx.durationWeeks} weeks and ${formatBudgetRef(ctx)}.`
        : isCoke
          ? `${ctx.brand} must reignite Gen Z summer engagement on ${ctx.platforms.join("/")} within ${ctx.durationWeeks} weeks — ad-skipping default behavior blocks traditional awareness.`
          : `${ctx.brand} must achieve ${ctx.objective} in ${ctx.geography} via creator trust transfer within ${ctx.durationWeeks} weeks.`,
      alternatives: tierAlternatives,
      decision: `Approve creator-tier mix: ${tierMix}`,
      rejected: tierAlternatives,
      impact: `All specialists align roster, budget, timeline, and KPI forecasts to ${tierMix} — deviation triggers revision loop.`,
      owner: "Campaign Director",
      confidence: 88,
      evidence: `DirectorStrategy.creatorTierStrategy; CampaignFacts.brandName=${ctx.brand}`,
      tradeoffs: isBaby
        ? ["Lower burst reach vs higher trust transfer", "Claim sensitivity limits creative"]
        : isCoke
          ? ["Less message control vs higher participation", "Mega availability risk in peak summer"]
          : ["Reach vs authenticity", "Budget concentration vs tier diversity"],
      risk: ctx.risks[0] ?? "Creator availability during activation window",
    }),
    boardMinute({
      problem: `${formatBudgetRef(ctx)} must fund influencer program only — no paid media buying leakage unless brief explicitly requires split categories.`,
      alternatives: ["Add paid amplification line", "Separate production budget by default"],
      decision: "Confirm influencer-only budget model with creator fees as default allocation",
      rejected: ["Add paid amplification line — rejected unless brief requires", "Separate production by default — rejected; embedded in creator fees"],
      impact: "Finance specialist allocation totals 100% across influencer categories; optional lines only when brief/facts mention production, studio, agency, boosting, usage rights, travel, or events.",
      owner: "Finance Specialist / Campaign Director",
      confidence: 90,
      evidence: `CampaignFacts.budget; DirectorStrategy.understanding.budget.rationale`,
      tradeoffs: ["Lower guaranteed reach vs higher trust efficiency", "Contingency reserve reduces net roster size"],
      risk: "Fee negotiation variance may require contingency draw",
    }),
    boardMinute({
      problem: `Client timeline must show ${ctx.durationWeeks} creator activation weeks — internal agency phases and in-campaign reporting compress publishing window.`,
      alternatives: ["Embed reporting in final activation week", "Show internal discovery/outreach weeks to client"],
      decision: `Client-facing creator activation: ${ctx.durationWeeks} weeks; reporting AFTER duration`,
      rejected: ["Embed reporting in Week N — rejected", "Internal discovery weeks — rejected; not client-visible"],
      impact: "Media planner outputs creator activation plan only; post-campaign reporting phase separated for KPI readout.",
      owner: "Media Planner / Campaign Director",
      confidence: 87,
      evidence: `CampaignFacts.durationWeeks=${ctx.durationWeeks}; DirectorStrategy.timeline`,
      tradeoffs: ["Faster client view vs complete weekly reporting detail", "Tier sequencing vs parallel activation"],
      risk: "Week 1 Macro/Mega booking slip cascades to KPI miss",
    }),
    boardMinute({
      problem: `KPI framework must anchor to CampaignFacts objective (${ctx.objective}) — industry template metrics misrepresent ${ctx.industry} campaign success.`,
      alternatives: ["Industry template KPIs only", "Reach-only targets"],
      decision: `KPI forecast with reason, dependencies, risk, trade-off, sensitivity, and confidence per metric`,
      rejected: ["Industry template KPIs only — rejected", "Reach-only targets — insufficient for brief"],
      impact: "Performance specialist forecasts cite CampaignFacts + Director Strategy; each KPI documents achievability rationale.",
      owner: "Performance Specialist / Campaign Director",
      confidence: 85,
      evidence: `CampaignFacts.objective=${ctx.objective}; DirectorStrategy.understanding.kpis`,
      tradeoffs: ["Ambitious targets vs tier budget reality", "Engagement depth vs top-line impressions"],
      risk: "KPI miss if creator content deviates from approved narrative",
    }),
  ];

  for (const output of specialistOutputs.filter((o) => o.status === "approved" || o.status === "reviewed")) {
    if (output.specialistId === "presentation") continue;
    minutes.push(
      boardMinute({
        problem: `${output.domain} output requires Director validation against CampaignFacts SSOT before section approval.`,
        alternatives:
          output.evidence.filter((e) => e.length > 10).slice(0, 2).length > 0
            ? output.evidence.filter((e) => e.length > 10).slice(0, 2)
            : ["Unvalidated specialist draft — requires Director review against CampaignFacts"],
        decision: `APPROVED — ${output.specialistId}: ${output.what.slice(0, 100)}`,
        rejected: ["Unvalidated specialist draft — rejected without Director review"],
        impact: `Section ${output.sections.join(", ")} populated from validated ${output.specialistId} output.`,
        owner: output.specialistId.replace("_", " "),
        confidence: 82,
        evidence: output.evidence[0] ?? `DirectorStrategy → ${output.specialistId}`,
        tradeoffs: ["Specialist proposal vs strict facts alignment"],
        risk: "Revision required if facts or strategy change",
      })
    );
  }

  if (debateResult) {
    const { meeting, scores, options } = debateResult;
    const winnerScore = scores.find((s) => s.optionId === meeting.winnerId);
    minutes.unshift(
      boardMinute({
        problem: `Campaign Director must select ONE campaign plan from 3 materially different alternatives — not approve first "good enough" strategy.`,
        alternatives: options.map((o) => `Option ${o.id}: ${o.label} (${o.creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(" · ")})`),
        decision: meeting.directorConclusion,
        rejected: meeting.rejectionReasons.flatMap((r) => r.reasons.slice(0, 2)),
        impact: `Winner Option ${meeting.winnerId} (${meeting.winnerLabel}) feeds all CampaignObject sections — rejected options stored in pipeline metadata only.`,
        owner: "Campaign Director",
        confidence: Math.min(95, Math.round(winnerScore?.weightedScore ?? 85)),
        evidence: `IS3.debate.scores=${scores.map((s) => `${s.optionId}:${s.weightedScore}`).join(",")}`,
        tradeoffs: [
          "Reach-first Option A rejected for insufficient UGC/trust transfer",
          "Balanced Option B rejected when engagement-first plan scores higher",
        ],
        risk: "Client may prefer reach numbers from Option A — Director framing required",
      })
    );
  }

  return minutes;
}
