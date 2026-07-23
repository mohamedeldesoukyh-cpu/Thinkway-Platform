/**
 * Full Campaign Strategy generator — a derived *view* over the Campaign Object.
 *
 * Assembles the complete strategy from data that already lives on the Campaign
 * Object (facts + slate + strategy section). It never invents facts and never
 * stores a second copy of them — it renders the SSOT into the standard strategy
 * structure. Deterministic, so it can be regenerated on demand.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import { resolveSlate, type SlateCreator } from "../output-inputs";
import { resolveMarketIntelligenceConfig } from "@/features/market-intelligence/market-intelligence-config";
import { buildMarketSchedulingContext } from "@/features/market-intelligence";
import { buildMarketTimingRationale } from "@/features/market-intelligence/market-timing-rationale";
import { deriveEffectiveWeekWeights } from "../media-plan-schedule";
import { resolveBriefTextForScheduling } from "../brief-media-plan-schedule";

export const STRATEGY_GENERATOR_VERSION = "1.1.0";

function parseCampaignStartForMarket(iso?: string): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-").map((part) => Number(part));
    if (year && month && day) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  now.setDate(now.getDate() + daysUntilMonday);
  now.setHours(12, 0, 0, 0);
  return now;
}

function tierMix(slate: SlateCreator[]): string[] {
  const counts: Record<string, number> = {};
  for (const creator of slate) {
    const tier = creator.tier?.trim() || "Unclassified";
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return Object.entries(counts).map(([tier, count]) => `${count} × ${tier}`);
}

function strategyNarrative(campaignObject: CampaignObject): string | undefined {
  const content = campaignObject.sections.strategy?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  return undefined;
}

export function generateFullStrategy(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const sections: CampaignOutputContentSection[] = [];

  const brand = facts?.brandName ?? facts?.clientName ?? "the brand";
  const objective = facts?.objective;
  const audience = facts?.audience;
  const platforms = facts?.platforms ?? [];
  const budget = facts?.budget;
  const durationWeeks = facts?.durationWeeks;
  const kpis = facts?.kpis ?? [];
  const risks = facts?.risks ?? [];
  const narrative = strategyNarrative(campaignObject);

  sections.push({
    heading: "Executive Summary",
    body:
      narrative?.slice(0, 600) ??
      `A ${durationWeeks ? `${durationWeeks}-week ` : ""}influencer campaign for ${brand}${objective ? ` focused on ${objective}` : ""}, activating ${slate.length} creator${slate.length === 1 ? "" : "s"}${platforms.length ? ` across ${platforms.join(", ")}` : ""}.`,
  });

  if (objective) sections.push({ heading: "Campaign Objectives", body: objective });
  if (audience) sections.push({ heading: "Audience Strategy", body: audience });

  sections.push({
    heading: "Creator Strategy",
    body: "The slate blends tiers to balance reach and authenticity.",
    items: tierMix(slate).length ? tierMix(slate) : ["No creators selected yet"],
  });

  if (platforms.length) {
    sections.push({
      heading: "Platform Strategy",
      body: `Priority order: ${platforms.join(" → ")}. The primary platform anchors reach; secondary platforms extend frequency and format variety.`,
    });
  }

  if (narrative) sections.push({ heading: "Creative Direction & Key Messages", body: narrative });

  const durationForMarket = Math.max(1, facts?.durationWeeks ?? 4);
  const { weights: weekWeights } = deriveEffectiveWeekWeights(campaignObject, durationForMarket);
  const marketConfig = resolveMarketIntelligenceConfig(
    campaignObject,
    resolveBriefTextForScheduling(campaignObject)
  );
  const marketContext = buildMarketSchedulingContext({
    campaignStartDate: parseCampaignStartForMarket(facts?.campaignStartDate),
    durationWeeks: durationForMarket,
    config: marketConfig,
  });
  sections.push({
    heading: "Market & Timing Intelligence",
    body: buildMarketTimingRationale({
      context: marketContext,
      weekWeights,
      durationWeeks: durationForMarket,
      objective: facts?.objective,
    }),
  });

  sections.push({
    heading: "Activation Phases & Timeline",
    items: [
      "Phase 1 — Launch: kickoff and top-tier content",
      "Phase 2 — Sustain: multi-tier publishing and stories",
      "Phase 3 — Optimize: reallocate to top performers",
      "Phase 4 — Report: performance analysis and recommendations",
      durationWeeks ? `Total duration: ${durationWeeks} weeks` : "Duration: to be confirmed",
    ],
  });

  sections.push({
    heading: "Creator Mix & Content Plan",
    items: [
      ...(tierMix(slate).length ? tierMix(slate) : ["Creator mix pending"]),
      "Content plan: Reels/Posts from lead tiers, Stories for frequency, paid boost on top performers",
    ],
  });

  if (budget) {
    sections.push({
      heading: "Budget Allocation",
      body: `Total budget: ${budget.amount.toLocaleString()} ${budget.currency}, allocated across the creator slate and paid amplification.`,
    });
  }

  if (kpis.length) sections.push({ heading: "KPI Forecast & Success Metrics", items: kpis });

  sections.push({
    heading: "Risk Assessment",
    items: risks.length
      ? risks
      : ["No material risks flagged — monitor delivery and engagement quality."],
  });

  sections.push({
    heading: "Recommendations",
    items: [
      "Lock content and schedule with the client before launch",
      "Protect budget for a mid-campaign optimization window",
      slate.length ? "Lead each wave with the highest-tier creators for reach" : "Finalize the creator slate",
    ],
  });

  return {
    title: "Full Campaign Strategy",
    summary: `Complete strategy for ${brand}${objective ? ` — ${objective}` : ""}.`,
    sections,
  };
}
