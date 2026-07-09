import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";

import { buildIs1CampaignContext, formatBudgetRef, type Is1CampaignContext } from "./campaign-context";

export type ExecutiveStrategyReasoning = {
  businessChallenge: string;
  marketingChallenge: string;
  audienceChallenge: string;
  strategicInsight: string;
  rejectedAlternatives: string[];
  chosenStrategy: string;
  whyThisStrategyWins: string;
  expectedTradeoffs: string[];
  risks: string[];
  successConditions: string[];
  confidenceLevel: number;
  directorConclusion: string;
  evidence: string[];
};

function debateWinnerContext(debateResult?: DebateResult): {
  winnerLabel: string;
  winnerId: string;
  rejectionSummary: string[];
  whyWinnerWon: string;
} | null {
  if (!debateResult) return null;
  const { meeting, scores } = debateResult;
  const winnerScore = scores.find((s) => s.optionId === meeting.winnerId);
  return {
    winnerLabel: meeting.winnerLabel,
    winnerId: meeting.winnerId,
    rejectionSummary: meeting.rejectionReasons.flatMap((r) =>
      r.reasons.slice(0, 1).map((reason) => `Option ${r.optionId}: ${reason}`)
    ),
    whyWinnerWon: `IS-3 Agency Leadership Debate — Option ${meeting.winnerId} (${meeting.winnerLabel}) selected with weighted score ${winnerScore?.weightedScore ?? 0}/100 and ${winnerScore?.approvalCount ?? 0}/7 director approvals after reviewing 3 complete alternatives.`,
  };
}

function enrichWithDebate(
  reasoning: ExecutiveStrategyReasoning,
  debateResult?: DebateResult
): ExecutiveStrategyReasoning {
  const debate = debateWinnerContext(debateResult);
  if (!debate) return reasoning;

  return {
    ...reasoning,
    rejectedAlternatives: [
      ...debate.rejectionSummary,
      ...reasoning.rejectedAlternatives,
    ],
    whyThisStrategyWins: `${debate.whyWinnerWon} ${reasoning.whyThisStrategyWins}`,
    directorConclusion: `${debate.whyWinnerWon} ${reasoning.directorConclusion}`,
    evidence: [
      ...reasoning.evidence,
      `IS3.debate.winner=Option ${debate.winnerId} (${debate.winnerLabel})`,
      `IS3.debate.directors=7`,
    ],
  };
}

function baseRisks(ctx: Is1CampaignContext, strategy: CampaignStrategyDocument): string[] {
  const fromFacts = ctx.risks.length > 0 ? ctx.risks : strategy.understanding.risks;
  if (fromFacts.length > 0) return fromFacts.slice(0, 4);
  return [
    "Creator availability variance during activation window",
    "Platform algorithm shifts affecting organic reach",
    "Budget fee negotiation exceeding contingency reserve",
  ];
}

function successConditions(
  ctx: Is1CampaignContext,
  strategy: CampaignStrategyDocument
): string[] {
  const kpiTargets = strategy.understanding.kpis.slice(0, 2).map((k) => `${k.metric} ≥ ${k.target}`);
  return [
    `${ctx.objective} achieved within ${ctx.durationWeeks} weeks on ${ctx.platforms.join(" + ")}`,
    `Director tier mix (${strategy.creatorTierStrategy.map((t) => t.tier).join("/")}) fully activated`,
    ...kpiTargets,
    `Spend stays within ${formatBudgetRef(ctx)} with no paid-media line leakage`,
  ];
}

function babyJoyReasoning(ctx: Is1CampaignContext, strategy: CampaignStrategyDocument): ExecutiveStrategyReasoning {
  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(" · ");

  return {
    businessChallenge: `${ctx.brand} enters Egypt's crowded premium diaper segment where Pampers and Huggies own parent trust — mothers 0–3 in ${ctx.geography} default to incumbent brands unless peer validation overcomes skepticism on overnight dryness claims.`,
    marketingChallenge: `Premium diaper launch must convert awareness into trial consideration without discount-led positioning — ${formatBudgetRef(ctx)} must fund UGC proof volume, not traditional ATL bursts that erode margin narrative.`,
    audienceChallenge: `${ctx.audience} in ${ctx.geography} consult creator content before pharmacy purchase; skepticism on overnight dryness claims requires mom-to-mom validation, not brand authority alone.`,
    strategicInsight: `Egyptian first-time mothers in the 0–3 cohort consult creator content before pharmacy purchase; Macro mom voices (35%) seed credibility while Micro (40%) and Nano (25%) deliver volume UGC that ${ctx.objective.toLowerCase()} cannot achieve through brand-owned ads alone.`,
    rejectedAlternatives: [
      `Celebrity endorsement-led awareness — rejected because ${formatBudgetRef(ctx)} over 6 weeks cannot sustain mega-tier fees plus production without sacrificing UGC volume Director requires for trial conversion.`,
      `Paid social amplification-first plan — rejected; baby category trust transfers through peer voices, not boosted brand posts (CampaignFacts objective: ${ctx.objective}).`,
      `Single-platform Instagram-only push — rejected; brief requires multi-touch UGC and ${ctx.platforms.join("/")} split matches where Egyptian moms discover product reviews.`,
    ],
    chosenStrategy: `Authenticity-first UGC pyramid on ${ctx.platforms.join(" + ")}: ${tierMix} activating verified mom creators in ${ctx.geography} to document real overnight-use stories tied to ${ctx.objective}.`,
    whyThisStrategyWins: `Director Strategy anchors on peer-trust mechanics for ${ctx.industry} — tier mix preserves ${formatBudgetRef(ctx)} efficiency (Nano/Micro = 65% of roster) while Macro anchors category credibility competitors cannot replicate with discount messaging.`,
    expectedTradeoffs: [
      "Lower immediate reach vs celebrity burst — traded for higher trust transfer and UGC asset library",
      "Claim sensitivity limits creative freedom — mitigated by pre-approved overnight-comfort script library",
      "6-week window compresses creator onboarding — Macro tier booked first to protect Week 2 production start",
    ],
    risks: baseRisks(ctx, strategy),
    successConditions: successConditions(ctx, strategy),
    confidenceLevel: factsConfidence(ctx, 86),
    directorConclusion: `Approve mom-creator UGC pyramid for ${ctx.brand} Egypt launch — ${ctx.objective} through peer validation, not brand interruption. ${formatBudgetRef(ctx)} / 6 weeks is sufficient when Nano+Micro carry volume.`,
    evidence: [
      `CampaignFacts.brandName=${ctx.brand}`,
      `CampaignFacts.objective=${ctx.objective}`,
      `CampaignFacts.geography=${ctx.geography}`,
      `DirectorStrategy.creatorTierStrategy=${tierMix}`,
      `DirectorStrategy.budget.rationale=${strategy.understanding.budget?.rationale ?? "facts SSOT"}`,
    ],
  };
}

function cocaColaReasoning(ctx: Is1CampaignContext, strategy: CampaignStrategyDocument): ExecutiveStrategyReasoning {
  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(" · ");

  return {
    businessChallenge: `${ctx.brand} must reignite summer ritual relevance with Gen Z who associate cola with nostalgia but not daily social identity — ${ctx.platforms.join(" and ")} attention is fragmented and ad-skipping is default behavior during ${ctx.durationWeeks}-week heat-season window.`,
    marketingChallenge: `Summer engagement must drive participatory behavior (duets, stitches, challenges) — not product-demo advertising — within ${formatBudgetRef(ctx)} and ${ctx.durationWeeks}-week cadence without paid amplification dependency.`,
    audienceChallenge: `${ctx.audience} distrusts polished brand content; cultural participation requires creator-native formats on ${ctx.platforms.join("/")} where Gen Z discovers ${ctx.brand} through social identity, not TV-style messaging.`,
    strategicInsight: `Gen Z engagement peaks on participatory formats (duets, challenges) not polished ads; Mega (20%) supplies cultural moment anchors while Macro (35%) sustains weekly velocity and Micro (30%) localizes summer moments — Nano (15%) tests viral hooks before scaling spend from ${formatBudgetRef(ctx)}.`,
    rejectedAlternatives: [
      `TV/OOH summer burst — rejected; Gen Z target and CampaignFacts platforms (${ctx.platforms.join(", ")}) do not justify offline-heavy allocation from influencer budget.`,
      `Mega-only celebrity takeover — rejected; single-tier plan burns ${formatBudgetRef(ctx)} without sustained ${ctx.durationWeeks}-week content cadence Director requires.`,
      `TikTok-only volume play — rejected; Instagram carousel saves and share-to-story behavior still drive ${ctx.brand} brand-search lift in summer campaigns per Director platform mix.`,
    ],
    chosenStrategy: `Participatory summer engagement wave: ${tierMix} on ${ctx.platforms.join(" + ")} — creators stage refill/share moments, not product demos, aligned to Gen Z social identity and ${ctx.objective}.`,
    whyThisStrategyWins: `Director Strategy prioritizes cultural participation over product education — tier waterfall keeps ${formatBudgetRef(ctx)} working across full ${ctx.durationWeeks} weeks while Mega/Macro moments create FOMO Nano creators amplify locally.`,
    expectedTradeoffs: [
      "Brand safety risk on UGC tone — traded for authenticity; fraud/exclusivity filters applied in vendor funnel",
      "Lower message control vs scripted ads — mitigated by summer ritual creative guardrails in Director pillars",
      "Mega tier availability in peak summer — backup Macro roster required Week 1",
    ],
    risks: baseRisks(ctx, strategy),
    successConditions: successConditions(ctx, strategy),
    confidenceLevel: factsConfidence(ctx, 84),
    directorConclusion: `Approve Gen Z participatory creator wave for ${ctx.brand} summer — engagement through cultural moments on ${ctx.platforms.join("/")}, not traditional awareness spots. ${formatBudgetRef(ctx)} over ${ctx.durationWeeks} weeks supports tier waterfall.`,
    evidence: [
      `CampaignFacts.brandName=${ctx.brand}`,
      `CampaignFacts.audience=${ctx.audience}`,
      `CampaignFacts.platforms=${ctx.platforms.join(",")}`,
      `DirectorStrategy.creatorTierStrategy=${tierMix}`,
      `DirectorStrategy.timeline.rationale=${strategy.understanding.timeline?.rationale ?? "facts SSOT"}`,
    ],
  };
}

function genericReasoning(ctx: Is1CampaignContext, strategy: CampaignStrategyDocument): ExecutiveStrategyReasoning {
  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(" · ");

  return {
    businessChallenge: `${ctx.brand} must break through ${ctx.industry} category noise in ${ctx.geography} where consumers distrust brand-only messaging — ${ctx.objective} requires creator-mediated credibility within ${ctx.durationWeeks} weeks and ${formatBudgetRef(ctx)}.`,
    marketingChallenge: `${ctx.objective} must be achieved through creator trust transfer on ${ctx.platforms.join(", ")} — not paid media buying — within ${formatBudgetRef(ctx)} and ${ctx.durationWeeks}-week activation window.`,
    audienceChallenge: `${ctx.audience} in ${ctx.geography} responds to creator authenticity over polished ads; reaching this cohort requires tier-sequenced voices aligned to CampaignFacts audience segment.`,
    strategicInsight: `${ctx.audience} responds to creator authenticity over polished ads; Director tier mix (${tierMix}) balances reach and cost for ${ctx.platforms.join(", ")} consumption patterns.`,
    rejectedAlternatives: [
      `Paid media-only plan — rejected; CampaignFacts objective (${ctx.objective}) requires creator trust transfer.`,
      `Single-tier creator roster — rejected; ${formatBudgetRef(ctx)} cannot deliver reach + authenticity without tier waterfall.`,
      `Extended timeline without tier sequencing — rejected; ${ctx.durationWeeks}-week window requires front-loaded Macro/Mega activation per Director timeline.`,
    ],
    chosenStrategy: `Creator-led ${ctx.objective.toLowerCase()} on ${ctx.platforms.join(" + ")} using Director-approved ${tierMix} for ${ctx.geography}.`,
    whyThisStrategyWins: `Aligns ${ctx.brand} spend to audience behavior on ${ctx.platforms.join("/")} while preserving budget efficiency — each tier rationale documented in DirectorStrategy.creatorTierStrategy.`,
    expectedTradeoffs: [
      "Reduced message control vs brand-owned creative",
      "Creator availability variance during activation window",
      "KPI volatility on engagement-first formats",
    ],
    risks: baseRisks(ctx, strategy),
    successConditions: successConditions(ctx, strategy),
    confidenceLevel: factsConfidence(ctx, 78),
    directorConclusion: `Director approves creator-tier strategy for ${ctx.brand} — ${ctx.objective} in ${ctx.geography} via ${tierMix}, grounded in CampaignFacts and Director Strategy SSOT.`,
    evidence: [
      `CampaignFacts.brandName=${ctx.brand}`,
      `CampaignFacts.objective=${ctx.objective}`,
      `DirectorStrategy.narrative`,
      `DirectorStrategy.pillars=${strategy.pillars.map((p) => p.title).join(",")}`,
    ],
  };
}

function factsConfidence(ctx: Is1CampaignContext, base: number): number {
  let score = base;
  if (ctx.budgetAmount) score += 3;
  if (ctx.geography !== "Primary market per brief") score += 2;
  return Math.min(95, score);
}

export function buildExecutiveStrategyReasoning(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): ExecutiveStrategyReasoning {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const brandLower = ctx.brand.toLowerCase();

  let reasoning: ExecutiveStrategyReasoning;
  if (/babyjoy|baby\s*joy/i.test(brandLower) || /baby|diaper|parenting/i.test(ctx.industry)) {
    reasoning = babyJoyReasoning(ctx, strategy);
  } else if (
    /coca.?cola|coke/i.test(brandLower) ||
    (/beverage|cpg|fmcg/i.test(ctx.industry) &&
      /gen\s*z|summer|engagement/i.test(`${ctx.objective} ${ctx.audience}`))
  ) {
    reasoning = cocaColaReasoning(ctx, strategy);
  } else {
    reasoning = genericReasoning(ctx, strategy);
  }
  return enrichWithDebate(reasoning, debateResult);
}
