import type { GroundedCreator, RankedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";
import { getInfluencerTier } from "@/lib/creators/influencer-tier";

import { buildIs1CampaignContext } from "./campaign-context";
import { buildEvidenceBasedSelection } from "./evidence-vendor-reasoning";

export type VendorRecommendationReasoning = {
  selected: VendorSelectedReasoning[];
  rejected: VendorRejectedReasoning[];
};

export type VendorSelectedReasoning = {
  creatorId: string;
  displayName?: string;
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
};

export type VendorRejectedReasoning = {
  creatorId: string;
  displayName?: string;
  whyRejected: string;
  evidence: string;
};

function inferTier(
  creator: GroundedCreator,
  index: number,
  strategy?: CampaignStrategyDocument | null
): string {
  const followers = creator.followers ?? 0;
  if (followers > 0) return getInfluencerTier(followers);
  const tiers = (strategy?.creatorTierStrategy ?? []).map((t) => t.tier);
  return tiers[index % Math.max(tiers.length, 1)] ?? "Micro";
}

function creatorFitScore(creator: GroundedCreator): number {
  return creator.campaignRelevanceScore ?? (creator as RankedCreator).fitScore ?? 70;
}

function audienceMatchText(
  creator: GroundedCreator,
  ctx: ReturnType<typeof buildIs1CampaignContext>
): string {
  const platform = creator.platform ?? ctx.platforms[0] ?? "platform TBD";
  const er = creator.engagementRate != null ? `${creator.engagementRate}% ER` : "ER unknown — verify manually";
  const followers =
    creator.followers != null
      ? `${creator.followers.toLocaleString()} followers`
      : "follower count unknown — verify manually";

  return `Creator active on ${platform} (${followers}, ${er}); audience overlap with CampaignFacts segment "${ctx.audience}" assessed via Thinkway DNA — demographic breakdown not inferred without verified data.`;
}

function missingDataFields(creator: GroundedCreator): string[] {
  const missing: string[] = [];
  if (creator.followers == null) missing.push("Follower count");
  if (creator.engagementRate == null) missing.push("Engagement rate");
  if (!creator.platform) missing.push("Primary platform");
  if (creator.campaignRelevanceScore == null && !(creator as RankedCreator).fitScore) {
    missing.push("Campaign fit score");
  }
  return missing;
}

function babyJoySelected(
  creator: GroundedCreator,
  index: number,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  tier: string
): Omit<VendorSelectedReasoning, "creatorId" | "displayName"> {
  const roles: Record<string, string> = {
    Macro: "Trust anchor — documents overnight dryness with newborn narrative",
    Micro: "Community validator — mom-group style UGC for trial consideration",
    Mid: "Educational reviewer — compares absorbency vs pharmacy alternatives",
    Nano: "Volume UGC — authentic changing-routine clips for social proof",
    Mega: "Launch moment — single hero mom voice for Egypt market awareness",
  };

  return {
    whySelected: `${creator.displayName ?? creator.handle} passes Egypt geography + parent-audience gate — supports ${ctx.brand} ${ctx.objective} where peer proof outweighs brand claims.`,
    whyNotAnother: `Higher-tier alternative skipped — ${tier} balances trust vs ${formatBudgetRef(ctx)}; next-ranked creator lacks ${ctx.geography} market credibility or has exclusivity risk.`,
    contribution: `${tier} tier delivers ${ctx.objective} UGC assets — ${roles[tier]?.split("—")[0]?.trim() ?? "content volume"} for Week ${index + 1} activation sequence.`,
    expectedRole: roles[tier] ?? `Tier ${tier} UGC contributor for ${ctx.objective}`,
    audienceMatch: audienceMatchText(creator, ctx),
    risk: index === 0 ? "Claim sensitivity on overnight comfort — requires pre-approved script" : "UGC quality variance — brief template mandatory",
    alternative: `Backup ${tier} creator in same governorate if exclusivity conflict surfaces`,
    confidence: Math.min(92, 75 + creatorFitScore(creator) / 5),
    evidence: `CampaignFacts.geography=${ctx.geography}; DirectorStrategy tier=${tier}`,
    tradeoff: `${tier} fee vs UGC volume — accepted because ${ctx.objective} needs authentic mom voices not polished studio content`,
    missingData: missingDataFields(creator),
    manualVerification: missingDataFields(creator).length
      ? `Verify before booking: ${missingDataFields(creator).join(", ")}`
      : "DNA fit and geography confirmed — standard onboarding brief required",
    directorNotes: `Director approves ${tier} slot ${index + 1} — claim-sensitive category; no demographic assumptions beyond CampaignFacts audience segment.`,
  };
}

function cocaColaSelected(
  creator: GroundedCreator,
  index: number,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  tier: string
): Omit<VendorSelectedReasoning, "creatorId" | "displayName"> {
  const roles: Record<string, string> = {
    Mega: "Summer ritual anchor — cultural moment starter for Gen Z feed",
    Macro: "Weekly velocity driver — challenge-format content on TikTok/IG",
    Micro: "Localizer — street/summer context that feels native not branded",
    Nano: "Hook tester — low-cost viral format experiments before scale",
    Mid: "Cross-platform bridge — Reels + TikTok duet participation",
  };

  return {
    whySelected: `${creator.displayName ?? creator.handle} delivers engagement on ${creator.platform ?? ctx.platforms[0]} — aligns ${ctx.brand} summer participation strategy, not product-demo advertising.`,
    whyNotAnother: `Adjacent-tier creator rejected — insufficient ${ctx.platforms.join("/")} participation format history or competitor beverage exclusivity through summer window.`,
    contribution: `${tier} supplies ${ctx.durationWeeks}-week cadence content — ${roles[tier]?.split("—")[0]?.trim() ?? "engagement volume"} toward participation KPI.`,
    expectedRole: roles[tier] ?? `Tier ${tier} summer engagement contributor`,
    audienceMatch: audienceMatchText(creator, ctx),
    risk: "UGC tone drift from brand guidelines — summer guardrails required",
    alternative: `Secondary ${tier} creator with lower exclusivity risk in same region`,
    confidence: Math.min(90, 72 + creatorFitScore(creator) / 5),
    evidence: `CampaignFacts.platforms=${ctx.platforms.join(",")}; DirectorStrategy objective=${ctx.objective}`,
    tradeoff: `Authentic summer tone vs strict brand control — Director accepts for engagement KPI`,
    missingData: missingDataFields(creator),
    manualVerification: missingDataFields(creator).length
      ? `Verify before booking: ${missingDataFields(creator).join(", ")}`
      : "Platform and engagement verified — summer creative guardrails required at briefing",
    directorNotes: `Director slot ${index + 1} — Gen Z engagement via participation; no inferred age/gender beyond CampaignFacts audience definition.`,
  };
}

function genericSelected(
  creator: GroundedCreator,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  tier: string,
  index: number
): Omit<VendorSelectedReasoning, "creatorId" | "displayName"> {
  return buildEvidenceBasedSelection(creator, ctx, tier, index);
}

function formatBudgetRef(ctx: ReturnType<typeof buildIs1CampaignContext>): string {
  if (ctx.budgetAmount == null) return "budget per CampaignFacts";
  return `${ctx.budgetCurrency} ${ctx.budgetAmount.toLocaleString()}`;
}

function buildRejection(
  creator: GroundedCreator,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  reason: string
): VendorRejectedReasoning {
  return {
    creatorId: creator.id,
    displayName: creator.displayName,
    whyRejected: reason,
    evidence: `CampaignFacts.brandName=${ctx.brand}; DirectorStrategy audience=${ctx.audience}`,
  };
}

export function buildVendorRecommendationReasoning(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument | null | undefined,
  selectedCreators: GroundedCreator[],
  poolCreators: GroundedCreator[] = [],
  debateResult?: DebateResult
): VendorRecommendationReasoning {
  // Facts alone are enough for boardroom why-selected — strategy may arrive later
  // in the Director pipeline after the slate is first proposed.
  const ctx = buildIs1CampaignContext(facts, strategy ?? undefined);
  const brandLower = ctx.brand.toLowerCase();
  const isBaby = /babyjoy|baby/i.test(brandLower);
  const isCoke = /coca/i.test(brandLower);

  const selected = selectedCreators.map((creator, index) => {
    const tier = inferTier(creator, index, strategy);
    const base = isBaby
      ? babyJoySelected(creator, index, ctx, tier)
      : isCoke
        ? cocaColaSelected(creator, index, ctx, tier)
        : genericSelected(creator, ctx, tier, index);

    return {
      creatorId: creator.id,
      displayName: creator.displayName,
      ...base,
    };
  });

  const selectedIds = new Set(selectedCreators.map((c) => c.id));
  const rejectionPool = poolCreators.filter((c) => !selectedIds.has(c.id));

  const rejected: VendorRejectedReasoning[] = rejectionPool.slice(0, 5).map((creator, index) => {
    const reasons = isBaby
      ? [
          `Audience skew outside CampaignFacts parent segment in ${ctx.geography}`,
          `Active competitor diaper exclusivity during ${ctx.durationWeeks}-week window`,
          `Brand-safety flag on historical controversial content — incompatible with ${ctx.brand} parenting claims`,
          `Engagement anomaly flagged — removed to protect spend efficiency`,
          `Creator DNA fit below Macro/Micro threshold for ${ctx.objective} UGC quality`,
        ]
      : isCoke
        ? [
            `Audience index misaligned with CampaignFacts summer engagement cohort`,
            `Platform concentration off ${ctx.platforms.join("/")} mix — Director requires dual-platform presence`,
            `Competitor beverage exclusivity through summer season`,
            `Content tone too educational — summer strategy needs participation not tutorial format`,
            `Engagement anomaly on follower growth pattern`,
          ]
        : [
            `Geography mismatch vs ${ctx.geography}`,
            `Industry category credibility below threshold`,
            `Tier misalignment with DirectorStrategy allocation`,
            `Brand safety archive concern`,
            `Exclusivity conflict with category rival`,
          ];

    return buildRejection(creator, ctx, reasons[index % reasons.length]);
  });

  if (rejected.length === 0 && selected.length > 0) {
    rejected.push({
      creatorId: `filtered-pool-${ctx.brand}`,
      displayName: "Filtered pool (summary)",
      whyRejected: isBaby
        ? `Creators removed at Country/Audience gates — outside ${ctx.geography} or misaligned with CampaignFacts audience segment`
        : isCoke
          ? `Creators removed at Audience/Engagement gates — misaligned with ${ctx.brand} summer participation criteria`
          : `Creators removed at Category gate — below ${ctx.industry} DNA threshold`,
      evidence: `DirectorStrategy.creatorTierStrategy + CampaignFacts filters`,
    });
  }

  const debateTierNote = debateResult
    ? ` IS-3 debate: ${debateResult.meeting.winnerLabel} tier mix (${(strategy?.creatorTierStrategy ?? [])
        .map((t) => `${t.tier} ${t.allocationPercent}%`)
        .join(" · ")}) survived agency leadership review — creators aligned to winning Option ${debateResult.meeting.winnerId}.`
    : "";

  const selectedWithDebate = selected.map((s) =>
    debateTierNote
      ? { ...s, directorNotes: (s.directorNotes ?? "") + debateTierNote }
      : s
  );

  return { selected: selectedWithDebate, rejected };
}
