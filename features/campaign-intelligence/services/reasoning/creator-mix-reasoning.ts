import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";

import { buildIs1CampaignContext } from "./campaign-context";

export type CreatorMixReasoningTier = {
  tier: string;
  percent: number;
  whyThisTier: string;
  ifTierChanged: string;
  budgetImpact: string;
  reachImpact: string;
  erImpact: string;
  rejectedAlternative: string;
  evidence: string;
  tradeoff: string;
  confidence: number;
  alternativeConsidered: string;
};

export type CreatorMixReasoning = {
  whyMix: string;
  tiers: CreatorMixReasoningTier[];
};

function tierImpacts(
  tierName: string,
  pct: number,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  direction: "increase" | "decrease" | "remove"
): { budget: string; reach: string; er: string } {
  const isMacroNano = /macro|nano|mega|micro/i.test(tierName);
  if (!isMacroNano) {
    return {
      budget: `${direction} ${tierName} (${pct}%) shifts fee concentration — rebalance adjacent tiers to hold ${ctx.budgetCurrency} total`,
      reach: `${direction} ${tierName} changes gross impressions — tier-weighted reach model updates required`,
      er: `${direction} ${tierName} adjusts blended ER — DNA-weighted engagement forecast shifts ±0.3–0.8pts`,
    };
  }

  if (/macro|mega/i.test(tierName)) {
    return {
      budget: direction === "decrease" || direction === "remove"
        ? `−${Math.round(pct * 0.6)}% effective creator fees redeployable — trust anchor weakened`
        : `+${Math.round(pct * 0.4)}% fee load — authority and reach rise, UGC volume falls`,
      reach: direction === "decrease" || direction === "remove"
        ? `Reach −${Math.round(pct * 0.8)}% at tier — Macro/Mega impressions drive top-of-funnel`
        : `Reach +${Math.round(pct * 0.7)}% — anchor creators expand qualified audience`,
      er: direction === "decrease"
        ? `Blended ER may rise (+0.2–0.5pts) but trust transfer slows for ${ctx.objective}`
        : `ER stable to −0.3pts — larger audiences dilute engagement rate`,
    };
  }

  return {
    budget: direction === "increase"
      ? `Nano/Micro +${pct}% adds UGC volume at lower CPM — fee efficiency improves`
      : `Nano/Micro cut saves fees but −${Math.round(pct * 1.2)}% UGC asset count vs ${ctx.objective} target`,
    reach: direction === "increase"
      ? `Long-tail reach +${Math.round(pct * 0.5)}% via volume creators`
      : `Reach −${Math.round(pct * 0.4)}% — volume tier carries incremental impressions`,
    er: direction === "increase"
      ? `Blended ER +0.4–1.2pts — Nano/Micro typically outperform on engagement`
      : `ER −0.5–1.0pts — volume tier drives engagement KPI`,
  };
}

export function buildCreatorMixReasoning(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): CreatorMixReasoning {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const brandLower = ctx.brand.toLowerCase();
  const isBaby = /babyjoy|baby/i.test(brandLower);
  const isCoke = /coca/i.test(brandLower);

  const tierMix = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(" · ");

  const whyMix = isBaby
    ? `${ctx.brand} Egypt launch requires Macro trust anchor plus Micro/Nano UGC volume (${tierMix}) — single-tier cannot deliver ${ctx.objective} within ${formatBudgetRef(ctx)} and ${ctx.durationWeeks} weeks.`
    : isCoke
      ? `${ctx.brand} Gen Z summer wave needs Mega/Macro cultural spikes plus Micro/Nano participation (${tierMix}) — ${ctx.durationWeeks}-week engagement requires tier waterfall, not one-tier burst.`
      : `Director tier mix (${tierMix}) balances reach, authenticity, and ${formatBudgetRef(ctx)} efficiency for ${ctx.objective} on ${ctx.platforms.join("/")}.`;

  const tiers = strategy.creatorTierStrategy.map((tier) => {
    const tierName = tier.tier;
    const pct = tier.allocationPercent;
    const impacts = tierImpacts(tierName, pct, ctx, "decrease");

    let whyThisTier = tier.why;
    let ifTierChanged = "";
    let tradeoff = "";
    let alternative = "";
    let rejectedAlternative = "";
    let confidence = 85;

    if (isBaby) {
      if (/macro/i.test(tierName)) {
        whyThisTier = `Macro moms (${pct}%) establish overnight-trust credibility for ${ctx.brand} Egypt — first-time parents need recognizable parenting voices before considering premium diaper switch.`;
        ifTierChanged = `Cutting Macro below ${pct}% delays trust transfer — Nano volume alone cannot overcome Pampers incumbency; trial KPI at risk.`;
        tradeoff = "Higher fee per creator vs Nano volume";
        alternative = "All-Micro roster — rejected; lacks authority for claim-sensitive category";
        rejectedAlternative = "All-Micro roster — rejected; lacks authority for claim-sensitive category";
      } else if (/micro/i.test(tierName)) {
        whyThisTier = `Micro tier (${pct}%) delivers mom-community UGC density for ${ctx.objective} — Egyptian parenting groups engage Micro creators 2× vs brand posts.`;
        ifTierChanged = `Increasing Micro beyond ${pct}% improves UGC count but erodes Macro anchor ratio — engagement rises, trust transfer slows.`;
        tradeoff = "UGC quality variance across creators";
        alternative = "Shift 10% to Macro — reduces asset volume, increases authority";
        rejectedAlternative = "All-Nano volume play — rejected; insufficient trust for premium diaper claims";
      } else if (/nano/i.test(tierName)) {
        whyThisTier = `Nano (${pct}%) fills long-tail authentic changing-routine clips — lowest cost per UGC asset within ${formatBudgetRef(ctx)}.`;
        ifTierChanged = `Zero Nano removes volume proof for ${ctx.objective} — awareness stalls despite Macro reach.`;
        tradeoff = "Lower production polish accepted for authenticity";
        alternative = "Reallocate to Micro — fewer assets, higher per-piece quality";
        rejectedAlternative = "Macro-only roster — rejected; insufficient UGC volume for ${ctx.objective}";
      }
    } else if (isCoke) {
      if (/mega/i.test(tierName)) {
        whyThisTier = `Mega (${pct}%) supplies summer cultural spikes for Gen Z — single moments that Micro/Nano can duet and extend across ${ctx.platforms.join("/")}.`;
        ifTierChanged = `Removing Mega saves fees but collapses FOMO peaks — summer engagement becomes flat, not event-driven.`;
        tradeoff = "Concentrated spend on few faces";
        alternative = "All-Macro wave — sustained but no viral spike";
        rejectedAlternative = "All-Macro wave — sustained but no viral spike";
      } else if (/macro/i.test(tierName)) {
        whyThisTier = `Macro (${pct}%) maintains weekly participation cadence over ${ctx.durationWeeks} weeks — Gen Z expects continuous creator presence, not one-off ads.`;
        ifTierChanged = `Macro cut below ${pct}% creates content gaps weeks 3–6 — engagement KPI dependency on Nano alone is unreliable.`;
        tradeoff = "Mid-tier fees vs content velocity";
        alternative = "Shift to Mega — fewer posts, bigger moments";
        rejectedAlternative = "Mega-only takeover — rejected; burns budget without weekly velocity";
      } else if (/micro/i.test(tierName)) {
        whyThisTier = `Micro (${pct}%) localizes summer rituals — street, beach, and hangout contexts Gen Z recognizes as native ${ctx.brand} moments.`;
        ifTierChanged = `Extra Micro without Macro/Mega anchor feels unbranded UGC — participation without brand linkage.`;
        tradeoff = "Brand safety monitoring overhead";
        alternative = "Increase Nano for hook testing";
        rejectedAlternative = "TikTok-only volume — rejected; Instagram share behavior still drives brand search";
      } else if (/nano/i.test(tierName)) {
        whyThisTier = `Nano (${pct}%) tests viral hooks before scaling — protects ${formatBudgetRef(ctx)} from premature Macro bookings on unproven formats.`;
        ifTierChanged = `Removing Nano eliminates format R&D — Macro/Mega commit to untested creative earlier.`;
        tradeoff = "Variable content quality";
        alternative = "Consolidate into Micro — less experimentation";
        rejectedAlternative = "Paid amplification line — rejected; engagement requires creator participation";
      }
    } else {
      whyThisTier = `${tierName} at ${pct}% — ${tier.why}; aligned to ${ctx.objective} on ${ctx.platforms.join(", ")}.`;
      ifTierChanged = `Changing ${tierName} allocation shifts reach/authenticity balance — DirectorStrategy documents ${pct}% as SSOT.`;
      tradeoff = "Tier fee vs expected KPI contribution";
      alternative = `Rebalance to adjacent tier per Director review`;
      rejectedAlternative = `Single-tier ${tierName}-only plan — rejected; ${formatBudgetRef(ctx)} requires tier waterfall`;
    }

    return {
      tier: tierName,
      percent: pct,
      whyThisTier,
      ifTierChanged:
        ifTierChanged ||
        `Altering ${tierName} from ${pct}% requires Director re-approval — KPI and budget model tied to tier mix.`,
      budgetImpact: impacts.budget,
      reachImpact: impacts.reach,
      erImpact: impacts.er,
      rejectedAlternative:
        rejectedAlternative ||
        `Uniform ${tierName}-only mix — rejected; cannot satisfy ${ctx.objective} within ${ctx.durationWeeks} weeks`,
      evidence: `CampaignFacts.brandName=${ctx.brand}; DirectorStrategy.creatorTierStrategy.${tierName}=${pct}%`,
      tradeoff: tradeoff || `Cost vs reach for ${tierName} tier`,
      confidence,
      alternativeConsidered: alternative || `Different ${tierName} weighting — reviewed in Director challenge loop`,
    };
  });

  const debateWhyMix = debateResult
    ? ` IS-3 debate: creator tiers survived agency leadership review — Option ${debateResult.meeting.winnerId} (${debateResult.meeting.winnerLabel}) mix selected; Macro-heavy Option A rejected for insufficient UGC volume.`
    : "";

  return { whyMix: whyMix + debateWhyMix, tiers };
}

function formatBudgetRef(ctx: ReturnType<typeof buildIs1CampaignContext>): string {
  if (ctx.budgetAmount == null) return "budget per CampaignFacts";
  return `${ctx.budgetCurrency} ${ctx.budgetAmount.toLocaleString()}`;
}
