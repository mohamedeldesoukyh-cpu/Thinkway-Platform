import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  buildCreatorMixFromFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";

import { allocateTierCounts } from "./creator-slate";

export type CreatorQuantityRecommendation = {
  /** Null when budget, duration, and objective are all missing — never invent 10. */
  recommended: number | null;
  confidence: number;
  rationale: string;
  evidence: string[];
  mix: CreatorMixTier[];
};

const MIN_SLATE = 4;
const MAX_SLATE = 16;

function objectiveKind(
  objective: string | undefined
): "awareness" | "acquisition" | "both" | "other" {
  const text = objective?.toLowerCase() ?? "";
  const awareness = /aware|reach|brand|consider/i.test(text);
  const acquisition = /acqui|convert|lead|sale|app |issuance|sign.?up/i.test(text);
  if (awareness && acquisition) return "both";
  if (acquisition) return "acquisition";
  if (awareness) return "awareness";
  return "other";
}

function budgetLift(facts: CampaignFacts | null | undefined): { lift: number; evidence?: string } {
  const amount = facts?.budget?.amount;
  const currency = facts?.budget?.currency?.toUpperCase();
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || !currency) {
    return { lift: 0 };
  }

  const formatted = `${amount.toLocaleString()} ${currency}`;

  if (currency === "EGP") {
    if (amount >= 8_000_000) return { lift: 4, evidence: `Budget ${formatted} supports a broader mixed slate.` };
    if (amount >= 5_000_000) return { lift: 3, evidence: `Budget ${formatted} funds a mid-size mixed slate.` };
    if (amount >= 2_000_000) return { lift: 2, evidence: `Budget ${formatted} funds a compact mixed slate.` };
    if (amount >= 1_000_000) return { lift: 1, evidence: `Budget ${formatted} constrains the slate toward fewer creators.` };
    return { lift: 0, evidence: `Budget ${formatted} requires a concentrated slate.` };
  }

  if (currency === "AED" || currency === "SAR" || currency === "QAR") {
    if (amount >= 1_500_000) return { lift: 4, evidence: `Budget ${formatted} supports a broader mixed slate.` };
    if (amount >= 800_000) return { lift: 3, evidence: `Budget ${formatted} funds a mid-size mixed slate.` };
    if (amount >= 400_000) return { lift: 2, evidence: `Budget ${formatted} funds a compact mixed slate.` };
    if (amount >= 150_000) return { lift: 1, evidence: `Budget ${formatted} constrains the slate toward fewer creators.` };
    return { lift: 0, evidence: `Budget ${formatted} requires a concentrated slate.` };
  }

  if (amount >= 400_000) return { lift: 4, evidence: `Budget ${formatted} supports a broader mixed slate.` };
  if (amount >= 200_000) return { lift: 3, evidence: `Budget ${formatted} funds a mid-size mixed slate.` };
  if (amount >= 80_000) return { lift: 2, evidence: `Budget ${formatted} funds a compact mixed slate.` };
  if (amount >= 40_000) return { lift: 1, evidence: `Budget ${formatted} constrains the slate toward fewer creators.` };
  return { lift: 0, evidence: `Budget ${formatted} requires a concentrated slate.` };
}

function durationBase(weeks: number | undefined): { base: number | null; evidence?: string } {
  if (weeks == null || !Number.isFinite(weeks) || weeks <= 0) {
    return { base: null };
  }
  if (weeks <= 2) {
    return { base: 5, evidence: `${weeks}-week flight needs a concentrated creator set.` };
  }
  if (weeks <= 4) {
    return { base: 7, evidence: `${weeks}-week flight supports a standard mixed slate.` };
  }
  if (weeks <= 8) {
    return { base: 9, evidence: `${weeks}-week flight needs extra creators to sustain weekly output.` };
  }
  return { base: 12, evidence: `${weeks}-week flight needs a larger slate to hold momentum.` };
}

function applyMixCounts(mix: CreatorMixTier[], recommended: number): CreatorMixTier[] {
  const percents = mix.map((tier) => ({ tier: tier.tier, percent: tier.percent }));
  const counts = allocateTierCounts(percents, recommended);
  return mix.map((tier) => ({
    ...tier,
    count: counts.get(tier.tier.toLowerCase()) ?? counts.get(tier.tier) ?? 0,
  }));
}

/**
 * Evidence-based slate size from Campaign Facts. Never defaults to 10 when
 * evidence is missing — returns null so Studio cannot present a fake CURRENT quantity.
 */
export function deriveCreatorQuantityRecommendation(
  facts: CampaignFacts | null | undefined,
  options?: { poolSize?: number }
): CreatorQuantityRecommendation {
  const mix = facts ? buildCreatorMixFromFacts(facts) : [];
  const duration = durationBase(facts?.durationWeeks);
  const budget = budgetLift(facts);
  const kind = objectiveKind(facts?.objective);
  const platforms = (facts?.platforms ?? []).filter((p) => p.trim());
  const evidence: string[] = [];

  const present = [
    duration.base != null,
    Boolean(budget.evidence),
    Boolean(facts?.objective?.trim()),
  ].filter(Boolean).length;

  if (duration.base == null && !budget.evidence && !facts?.objective?.trim()) {
    return {
      recommended: null,
      confidence: 0,
      rationale:
        "Recommended creator quantity cannot be set until campaign budget, duration, and objective are confirmed.",
      evidence: [],
      mix,
    };
  }

  let recommended = duration.base ?? 6;
  if (duration.evidence) evidence.push(duration.evidence);
  recommended += budget.lift;
  if (budget.evidence) evidence.push(budget.evidence);

  if (kind === "acquisition") {
    recommended += 2;
    evidence.push("Acquisition objective adds creators for conversion coverage.");
  } else if (kind === "both") {
    recommended += 1;
    evidence.push("Awareness plus acquisition needs both reach and conversion coverage.");
  } else if (kind === "awareness") {
    evidence.push("Awareness objective concentrates spend on fewer higher-reach creators.");
  } else if (facts?.objective?.trim()) {
    evidence.push(`Objective “${facts.objective.trim()}” shapes mix, not a fixed headcount.`);
  }

  if (platforms.length >= 3) {
    recommended += 1;
    evidence.push(`${platforms.length} platforms need additional creator coverage.`);
  } else if (platforms.length > 0) {
    evidence.push(`Platform focus: ${platforms.join(", ")}.`);
  }

  if (mix.length > 0) {
    evidence.push(
      `Tier mix: ${mix.map((tier) => `${tier.percent}% ${tier.tier}`).join(", ")}.`
    );
  }

  recommended = Math.max(MIN_SLATE, Math.min(MAX_SLATE, Math.round(recommended)));

  const poolSize = options?.poolSize;
  if (poolSize != null && poolSize > 0 && poolSize < recommended) {
    evidence.push(
      `Inventory currently has ${poolSize} rankable creator${poolSize === 1 ? "" : "s"} — quantity is capped to available pool until Discovery fills the gap.`
    );
    recommended = poolSize;
  }

  const confidence = present === 3 ? 0.86 : present === 2 ? 0.64 : 0.42;
  const sizedMix = recommended > 0 && mix.length > 0 ? applyMixCounts(mix, recommended) : mix;

  return {
    recommended,
    confidence,
    rationale: `Recommend ${recommended} creators because ${evidence.slice(0, 3).join(" ")}`,
    evidence,
    mix: sizedMix,
  };
}
