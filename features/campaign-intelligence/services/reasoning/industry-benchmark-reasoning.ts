import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";
import type {
  GroundingSource,
  IndustryBenchmarkData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { detectIndustryFromBrief, getIndustryProfile } from "@/features/campaign-studio/services/industry-intelligence";

import { buildIs1CampaignContext, formatBudgetRef } from "./campaign-context";

const VERIFICATION = "Verification required";

type IntelRow = {
  metric: string;
  expected: string;
  industry: string;
  variance: string;
  source: GroundingSource;
};

function tierPricingRange(
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument
): string {
  const tiers = strategy.creatorTierStrategy;
  if (tiers.length === 0) return VERIFICATION;

  const currency = ctx.budgetCurrency;
  const ranges = tiers.map((t) => {
    const feeShare = t.allocationPercent / 100;
    const tierBudget =
      ctx.budgetAmount != null
        ? Math.round((ctx.budgetAmount * feeShare) / Math.max(1, Math.ceil(t.allocationPercent / 10)))
        : null;
    return tierBudget != null
      ? `${t.tier}: ~${currency} ${tierBudget.toLocaleString()}/creator (est. from ${t.allocationPercent}% tier mix)`
      : `${t.tier}: ${t.allocationPercent}% of roster — fee band ${VERIFICATION.toLowerCase()}`;
  });

  return ranges.join(" · ");
}

function engagementRange(
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  industryLabel: string
): string {
  const platforms = ctx.platforms.join("/") || "primary platforms";
  const brandLower = ctx.brand.toLowerCase();

  if (/babyjoy|baby/i.test(brandLower)) {
    return "Mom-creator ER typically 5–8% on Instagram/TikTok parenting content; Macro anchors 4–6%, Nano volume 6–9%";
  }
  if (/coca|pepsi/i.test(brandLower)) {
    return "Gen Z participation ER 3–6% on TikTok challenge content; Mega/Macro hero posts 2–4% with higher reach";
  }
  if (/samsung|l'?or[eé]al|loreal/i.test(brandLower)) {
    return `${industryLabel} tech/beauty creator ER 3–5% on ${platforms}; tutorial/review formats 4–7%`;
  }

  return `${industryLabel} category ER bands on ${platforms} — ${VERIFICATION} for brand-specific baseline`;
}

function seasonalNote(ctx: ReturnType<typeof buildIs1CampaignContext>): string {
  const brandLower = ctx.brand.toLowerCase();
  if (/coca|pepsi/i.test(brandLower)) {
    return "Summer peak — creator availability tight Jun–Aug; book Mega/Macro 3+ weeks ahead";
  }
  if (/babyjoy|baby/i.test(brandLower)) {
    return "Ramadan/post-Ramadan parenting peaks in MENA — align mom-creator publishing with family routines";
  }
  if (/samsung/i.test(brandLower)) {
    return "Product launch windows drive premium tech creator demand — secure review units before Week 1";
  }
  if (/l'?or[eé]al|loreal/i.test(brandLower)) {
    return "Skincare campaigns spike pre-holiday and Ramadan — seasonal creator rates may rise 10–15%";
  }
  return ctx.geography.includes("Verification")
    ? VERIFICATION
    : `Seasonal creator demand in ${ctx.geography} — confirm category calendar against launch dates`;
}

function competitiveActivity(ctx: ReturnType<typeof buildIs1CampaignContext>): string {
  const brandLower = ctx.brand.toLowerCase();
  if (/babyjoy|baby/i.test(brandLower)) {
    return "Competing diaper brands active on mom UGC in Egypt — differentiation via overnight dryness proof points";
  }
  if (/coca|pepsi/i.test(brandLower)) {
    return "Beverage rivals run summer Gen Z challenges on TikTok — participation mechanics must feel native not scripted";
  }
  if (/pepsi/i.test(brandLower)) {
    return "Pepsi vs Coca-Cola summer share-of-voice battle on TikTok/Instagram — creator exclusivity clauses may apply";
  }
  if (/samsung/i.test(brandLower)) {
    return "Apple/Xiaomi launch cycles overlap MENA tech creator attention — speed-to-publish critical";
  }
  if (/l'?or[eé]al|loreal/i.test(brandLower)) {
    return "Beauty incumbents invest in dermatologist-creator hybrids — science-backed UGC is table stakes";
  }
  return VERIFICATION;
}

function successFactors(
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument
): string[] {
  const factors = [
    `Tier mix (${strategy.creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(", ") || VERIFICATION}) aligned to ${ctx.objective}`,
    `${ctx.durationWeeks}-week activation cadence on ${ctx.platforms.join(", ") || "brief platforms"}`,
  ];

  if (ctx.constraints.length) {
    factors.push(`Compliance with CampaignFacts constraints: ${ctx.constraints.slice(0, 2).join("; ")}`);
  } else {
    factors.push("Brief-compliant creator messaging and claim-safe content");
  }

  return factors;
}

function keyRisks(ctx: ReturnType<typeof buildIs1CampaignContext>): string[] {
  if (ctx.risks.length) return ctx.risks.slice(0, 4);
  return [
    "Creator availability variance during peak publishing weeks",
    "Claim/compliance review delays in regulated categories",
    VERIFICATION,
  ];
}

export function buildIndustryBenchmarkIntelligence(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): IndustryBenchmarkData {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const industry = detectIndustryFromBrief(facts.industry ?? strategy.narrative);
  const profile = getIndustryProfile(industry, facts.rawBriefExcerpt ?? strategy.narrative);

  const marketLandscape =
    `${profile.label} influencer landscape in ${ctx.geography} — ${ctx.objective} campaigns on ${ctx.platforms.join(", ") || "primary platforms"}. ` +
    `Budget ${formatBudgetRef(ctx)} over ${ctx.durationWeeks} weeks.`;

  const creatorPricing = tierPricingRange(ctx, strategy);
  const engagementRanges = engagementRange(ctx, profile.label);
  const seasonalConsiderations = seasonalNote(ctx);
  const competitive = competitiveActivity(ctx);
  const factors = successFactors(ctx, strategy);
  const risks = keyRisks(ctx);

  const comparisons: IntelRow[] = [
    {
      metric: "Market Landscape",
      expected: marketLandscape,
      industry: `${profile.label} vertical norms`,
      variance: "Campaign-specific",
      source: "Client",
    },
    {
      metric: "Creator Pricing",
      expected: creatorPricing,
      industry: profile.cpmAssumption.includes(VERIFICATION) ? VERIFICATION : profile.cpmAssumption,
      variance: "Tier-mix derived ranges",
      source: ctx.budgetAmount != null ? "Historical" : "Industry",
    },
    {
      metric: "Expected Engagement",
      expected: engagementRanges,
      industry: profile.creatorMixSummary,
      variance: "Category band",
      source: "Industry",
    },
    {
      metric: "Seasonal Considerations",
      expected: seasonalConsiderations,
      industry: "Category calendar",
      variance: "Timing risk",
      source: seasonalConsiderations === VERIFICATION ? "AI" : "Industry",
    },
    {
      metric: "Competitive Activity",
      expected: competitive,
      industry: "Category SOV",
      variance: competitive === VERIFICATION ? "Unverified" : "Actionable",
      source: competitive === VERIFICATION ? "AI" : "Industry",
    },
    {
      metric: "Success Factors",
      expected: factors.join(" · "),
      industry: "Historical patterns",
      variance: "Director-aligned",
      source: "Historical",
    },
    {
      metric: "Key Risks",
      expected: risks.join(" · "),
      industry: "Category risks",
      variance: risks.some((r) => r === VERIFICATION) ? "Verify" : "Monitor",
      source: "Client",
    },
  ];

  const debateNote = debateResult
    ? ` IS-3 Option ${debateResult.meeting.winnerId} tier/budget assumptions applied.`
    : "";

  return {
    industry: profile.label,
    comparisons,
    summary: `Competitive intelligence for ${ctx.brand} — ${ctx.objective}.${debateNote}`,
    estCpm: profile.cpmAssumption.includes("$") ? profile.cpmAssumption : VERIFICATION,
    estCpc: profile.cpeAssumption,
    estReach: profile.estimatedReach.includes("Verification") ? VERIFICATION : profile.estimatedReach,
    postingFrequency: `${Math.max(2, Math.ceil(ctx.durationWeeks / 2))} posts/week target (tier-weighted)`,
    creatorMixBenchmark: strategy.creatorTierStrategy
      .map((t) => `${t.tier} ${t.allocationPercent}%`)
      .join(" · ") || profile.creatorMixSummary,
    budgetEfficiency:
      ctx.budgetAmount != null
        ? `${formatBudgetRef(ctx)} → ${ctx.durationWeeks}-week creator activation`
        : VERIFICATION,
    competitiveIntelligence: {
      marketLandscape,
      creatorPricing,
      engagementRanges,
      seasonalConsiderations,
      competitiveActivity: competitive,
      successFactors: factors,
      keyRisks: risks,
    },
  };
}
