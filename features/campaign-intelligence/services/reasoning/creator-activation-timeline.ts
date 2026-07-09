import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";
import type { ActivationPlan } from "@/features/campaign-director/debate/debate-types";

import { buildIs1CampaignContext } from "./campaign-context";

export type CreatorActivationWeek = {
  week: number;
  tier: string;
  objective: string;
  reason: string;
  evidence: string;
  tradeoff: string;
  confidence: number;
};

export type CreatorActivationTimeline = {
  activationWeeks: CreatorActivationWeek[];
  reportingPhase: {
    label: string;
    reason: string;
    evidence: string;
  };
  durationWeeks: number;
};

function dominantTierForWeek(
  week: number,
  strategy: CampaignStrategyDocument,
  activationPlan?: ActivationPlan
): string {
  const tiers = strategy.creatorTierStrategy;
  if (tiers.length === 0) return "Macro";

  if (activationPlan) {
    const weight = activationPlan.weekWeights[week - 1] ?? 0;
    const sorted = [...tiers].sort((a, b) => b.allocationPercent - a.allocationPercent);

    switch (activationPlan.approach) {
      case "burst":
        if (week === 1 && weight >= 50) {
          return sorted.find((t) => /mega|macro/i.test(t.tier))?.tier ?? sorted[0].tier;
        }
        return sorted.find((t) => /micro|nano/i.test(t.tier))?.tier ?? sorted[sorted.length - 1].tier;
      case "ramp": {
        const rampIndex = Math.min(week - 1, sorted.length - 1);
        return sorted[rampIndex]?.tier ?? sorted[0].tier;
      }
      case "even":
      default: {
        const idx = (week - 1) % tiers.length;
        return tiers[idx]?.tier ?? sorted[0].tier;
      }
    }
  }

  const sorted = [...tiers].sort((a, b) => b.allocationPercent - a.allocationPercent);
  if (week === 1) {
    return sorted.find((t) => /mega|macro/i.test(t.tier))?.tier ?? sorted[0].tier;
  }
  if (week <= Math.ceil(strategy.understanding.timeline?.durationWeeks ?? tiers.length)) {
    const mid = sorted.find((t) => /macro|mid/i.test(t.tier));
    const micro = sorted.find((t) => /micro|nano/i.test(t.tier));
    return week % 2 === 0 ? (micro?.tier ?? "Micro") : (mid?.tier ?? sorted[0].tier);
  }
  return sorted.map((t) => t.tier).join(" + ");
}

function weekObjective(
  week: number,
  durationWeeks: number,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  tier: string
): string {
  const brandLower = ctx.brand.toLowerCase();
  const isBaby = /babyjoy|baby/i.test(brandLower);
  const isCoke = /coca|pepsi/i.test(brandLower);

  if (week === 1) {
    return isBaby
      ? `Anchor ${tier} mom creators — compliance brief + trust foundation`
      : isCoke
        ? `Launch ${tier} cultural hooks — set participatory creative guardrails`
        : `Activate ${tier} anchors — align on ${ctx.objective}`;
  }

  if (week < durationWeeks) {
    return isBaby
      ? `${tier} UGC publishing — drive ${ctx.objective} via peer-validation content`
      : isCoke
        ? `${tier} participation wave — sustain Gen Z engagement toward ${ctx.objective}`
        : `${tier} creator publishing — advance ${ctx.objective} on ${ctx.platforms.join("/")}`;
  }

  return isBaby
    ? "Final publishing push — maximize UGC volume before campaign close"
    : isCoke
      ? "Peak-week creator publishing — close summer engagement window"
      : `Final ${tier} publishing week — maximize ${ctx.objective} before close`;
}

function weekReason(
  week: number,
  durationWeeks: number,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  tier: string,
  activationPlan?: ActivationPlan
): string {
  const approach = activationPlan?.approach ?? "tier-sequenced";
  const weight = activationPlan?.weekWeights[week - 1];

  if (week === 1) {
    return `Week 1 ${tier} activation (${approach}) — Director tier strategy front-loads credibility for ${ctx.durationWeeks}-week ${ctx.objective} plan in ${ctx.geography}.`;
  }

  if (week < durationWeeks) {
    const weightNote = weight != null ? `${weight}% creator weight` : "tier cadence";
    return `Week ${week} ${tier} publishing — ${weightNote} from activation plan; objective ${ctx.objective} on ${ctx.platforms.join("/")}.`;
  }

  return `Week ${week} final creator publishing — all assigned tiers live; reporting is post-campaign (Week ${durationWeeks + 1}+), not embedded in live weeks.`;
}

export function buildCreatorActivationTimeline(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): CreatorActivationTimeline {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const durationWeeks = ctx.durationWeeks;

  const winnerOption = debateResult?.options.find((o) => o.id === debateResult.meeting.winnerId);
  const activationPlan = winnerOption?.timeline.activationPlan;

  const activationWeeks: CreatorActivationWeek[] = [];

  for (let week = 1; week <= durationWeeks; week++) {
    const tier = dominantTierForWeek(week, strategy, activationPlan);
    activationWeeks.push({
      week,
      tier,
      objective: weekObjective(week, durationWeeks, ctx, tier),
      reason: weekReason(week, durationWeeks, ctx, tier, activationPlan),
      evidence: `CampaignFacts.durationWeeks=${durationWeeks}; DirectorStrategy.creatorTierStrategy; activation=${activationPlan?.approach ?? "default"}`,
      tradeoff:
        week === 1
          ? "Earlier Nano volume vs Macro anchor — Director chose credibility-first sequencing"
          : week === durationWeeks
            ? "Extend publishing vs reserve reporting week — reporting kept outside campaign duration"
            : "Parallel tier activation vs sequenced cadence",
      confidence: week === 1 ? 90 : week < durationWeeks ? 86 : 88,
    });
  }

  const brandLower = ctx.brand.toLowerCase();
  const reportingReason = /babyjoy|baby/i.test(brandLower)
    ? `Post-campaign reporting (Week ${durationWeeks + 1}+) measures UGC volume, trust sentiment, and trial proxy KPIs — outside the ${durationWeeks}-week creator activation window.`
    : /coca|pepsi/i.test(brandLower)
      ? `Reporting AFTER Week ${durationWeeks} captures participation rate, Gen Z engagement depth, and brand-search lift — not mixed into live publishing weeks.`
      : `Reporting phase follows ${durationWeeks}-week creator activation — KPI readout against CampaignFacts objectives without compressing publishing window.`;

  const debateTimelineNote = debateResult
    ? ` IS-3 debate: ${activationPlan?.approach ?? "tier-sequenced"} activation from winning Option ${debateResult.meeting.winnerId} — ${winnerOption?.timeline.activationOrder ?? "tier-sequenced plan"} applied.`
    : "";

  return {
    activationWeeks,
    reportingPhase: {
      label: "Post-Campaign Reporting",
      reason: reportingReason + debateTimelineNote,
      evidence: `CampaignFacts.objective=${ctx.objective}; reporting week=${durationWeeks + 1} (outside duration)`,
    },
    durationWeeks,
  };
}
