import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";
import {
  buildSingleCreatorFeesAllocation,
  deriveInfluencerBudgetAllocations,
  normalizeBudgetAllocationPercents,
} from "@/features/campaign-studio/services/budget-allocation";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import {
  defaultCreatorFeesRationale,
  detectBudgetSplitKeywords,
} from "@/features/campaign-director/services/budget-rules";

import { buildIs1CampaignContext, formatBudgetRef } from "./campaign-context";

export type BudgetAllocationReasoning = {
  category: string;
  amount?: number;
  percent?: number;
  reason: string;
  evidence: string;
  tradeoff: string;
  confidence: number;
  alternativeConsidered: string;
};

export type BudgetPlannerReasoning = {
  total?: number;
  currency: string;
  allocations: BudgetAllocationReasoning[];
  directorRationale: string;
};

const INFLUENCER_CATEGORIES = [
  /creator\s*fees?/i,
  /usage\s*rights?/i,
  /production/i,
  /agency/i,
  /tax/i,
  /contingency/i,
];

function categoryReason(
  category: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument,
  percent: number
): Omit<BudgetAllocationReasoning, "category" | "amount" | "percent"> {
  const brandLower = ctx.brand.toLowerCase();
  const isBaby = /babyjoy|baby/i.test(brandLower);
  const isCoke = /coca/i.test(brandLower);
  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(", ");

  if (/creator\s*fees?/i.test(category)) {
    return isBaby
      ? {
          reason: `${percent}% funds Macro/Micro/Nano mom roster (${tierMix}) — primary spend because ${ctx.objective} requires 80+ UGC assets, not media buying; creator fees include production per CampaignFacts constraints.`,
          evidence: `CampaignFacts.budget=${formatBudgetRef(ctx)}; DirectorStrategy.creatorTierStrategy`,
          tradeoff: "Fewer Macro anchors vs more Nano volume — Director chose volume for trial proof",
          confidence: 88,
          alternativeConsidered: "Shift 10% to paid amplification — rejected; trust transfers via creators not ads",
        }
      : isCoke
        ? {
            reason: `${percent}% activates Mega/Macro summer moments + Micro/Nano participation (${tierMix}) across ${ctx.durationWeeks} weeks on ${ctx.platforms.join("/")} — engagement KPI needs sustained creator cadence.`,
            evidence: `CampaignFacts.platforms=${ctx.platforms.join(",")}; DirectorStrategy.budget.rationale`,
            tradeoff: "Lower Mega count vs longer Macro/Micro runway — accepted for ${ctx.durationWeeks}-week participation",
            confidence: 86,
            alternativeConsidered: "Celebrity single-fee allocation — rejected; burns budget without weekly velocity",
          }
        : {
            reason: `${percent}% to creator roster per Director tier mix (${tierMix}) — influencer model default; fees include production unless brief splits production line.`,
            evidence: `CampaignFacts.budget=${formatBudgetRef(ctx)}`,
            tradeoff: "Reach vs authenticity per tier allocation",
            confidence: 82,
            alternativeConsidered: "Paid media line item — excluded; not influencer campaign model",
          };
  }

  if (/usage\s*rights?/i.test(category)) {
    return {
      reason: `${percent}% reserved only if brief mandates extended whitelisting — ${ctx.brand} ${ctx.durationWeeks}-week window needs 90-day digital rights for UGC reuse in ${ctx.geography} retail touchpoints.`,
      evidence: `CampaignFacts.constraints=${ctx.constraints.join("; ") || "default influencer bundle"}`,
      tradeoff: "Higher fee per creator vs limited organic-only usage",
      confidence: 70,
      alternativeConsidered: "Organic repost only — rejected if retail/e-commerce needs paid usage",
    };
  }

  if (/production/i.test(category)) {
    return {
      reason: `${percent}% added because brief explicitly requires separate production — otherwise embedded in creator fees per Director default for ${ctx.industry}.`,
      evidence: `DirectorStrategy.constraints`,
      tradeoff: "Production quality vs creator count",
      confidence: 65,
      alternativeConsidered: "Bundle production in creator fees — default when brief silent",
    };
  }

  if (/agency/i.test(category)) {
    return {
      reason: `${percent}% covers Thinkway coordination, briefing, compliance review — mandatory for ${isBaby ? "claim-sensitive baby category" : isCoke ? "brand-safe summer UGC" : ctx.industry} at ${formatBudgetRef(ctx)} scale.`,
      evidence: `CampaignFacts.brandName=${ctx.brand}`,
      tradeoff: "Coordination overhead vs direct creator booking risk",
      confidence: 90,
      alternativeConsidered: "Self-serve creator booking — rejected; compliance and tier orchestration required",
    };
  }

  if (/tax/i.test(category)) {
    return {
      reason: `${percent}% withholding/VAT provision for ${ctx.geography} vendor payments — statutory; not available for roster expansion.`,
      evidence: `CampaignFacts.geography=${ctx.geography}`,
      tradeoff: "Net creator fees reduced vs gross budget",
      confidence: 95,
      alternativeConsidered: "Gross-up budget — requires client approval outside current facts",
    };
  }

  return {
    reason: `${percent}% contingency for creator drop-out and fee negotiation variance during ${ctx.durationWeeks}-week activation — ${ctx.risks[0] ?? "vendor availability risk"}.`,
    evidence: `DirectorStrategy.risks`,
    tradeoff: "Lower roster depth vs buffer for replacements",
    confidence: 85,
    alternativeConsidered: "Zero contingency — rejected; outreach variance is structural risk",
  };
}

export function buildBudgetPlannerReasoning(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  briefText: string,
  debateResult?: DebateResult
): BudgetPlannerReasoning {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const industry = detectIndustryFromBrief(facts.industry ?? strategy.narrative);
  const total = ctx.budgetAmount;

  const splitKeywords = detectBudgetSplitKeywords(briefText, facts);
  let allocations = deriveInfluencerBudgetAllocations(industry, strategy.narrative, total);

  if (splitKeywords.length === 0) {
    const why = defaultCreatorFeesRationale(
      briefText,
      facts,
      strategy.understanding.budget?.rationale
    );
    allocations = buildSingleCreatorFeesAllocation(total, why);
  } else {
    allocations = allocations.filter(
      (line) =>
        INFLUENCER_CATEGORIES.some((p) => p.test(line.category)) ||
        /creator\s*fees?|contingency|agency/i.test(line.category)
    );
    allocations = normalizeBudgetAllocationPercents(allocations, total);
  }

  const reasoningAllocations: BudgetAllocationReasoning[] = allocations.map((line) => {
    const meta = categoryReason(line.category, ctx, strategy, line.percent ?? 0);
    const isSingleCreatorFees =
      splitKeywords.length === 0 && /creator\s*fees?/i.test(line.category);
    return {
      category: line.category,
      amount: line.amount,
      percent: line.percent,
      ...(isSingleCreatorFees
        ? {
            reason: defaultCreatorFeesRationale(
              briefText,
              facts,
              strategy.understanding.budget?.rationale
            ),
            evidence: `CampaignFacts.budget=${formatBudgetRef(ctx)}; no split keywords in brief/constraints`,
            tradeoff: "Separate production/agency lines — rejected; brief silent on split categories",
            confidence: 92,
            alternativeConsidered: "Industry-weighted multi-line split — rejected per BL-1 influencer default",
          }
        : meta),
    };
  });

  const debateNote = debateResult
    ? ` IS-3 debate: Option A reach-first allocation (${debateResult.options.find((o) => o.id === "A")?.budget.creatorFeePercent}% creator fees) rejected — Finance Director cited premium Macro/Mega fee concentration; winner Option ${debateResult.meeting.winnerId} (${debateResult.meeting.winnerLabel}) allocation applied.`
    : "";

  return {
    total,
    currency: ctx.budgetCurrency,
    allocations: reasoningAllocations,
    directorRationale:
      (strategy.understanding.budget?.rationale ??
      `Influencer-only model for ${ctx.brand} — ${formatBudgetRef(ctx)} over ${ctx.durationWeeks} weeks; no paid media buying lines.`) + debateNote,
  };
}
