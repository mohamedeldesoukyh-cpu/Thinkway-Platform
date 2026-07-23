/**
 * Expandable "Why?" rationale bullets for internal Media Plan sections.
 * Evidence drawn from quotation, calendar weights, market intelligence, and slate.
 */

import type { MarketSchedulingContext } from "@/features/market-intelligence";
import { buildMarketTimingCitations } from "@/features/market-intelligence/market-timing-rationale";

import { classifyCampaignType } from "./campaign-type-classifier";
import type { SlateCreator } from "./output-inputs";
import { sortedPlatforms } from "./media-plan-strategy-narrative";

export type MediaPlanSectionRationaleKey =
  | "platformAllocation"
  | "weeklyObjectives"
  | "creatorOrdering"
  | "marketTiming";

export type MediaPlanSectionRationaleInput = {
  briefText: string;
  objective?: string;
  industry?: string;
  weekWeights: number[];
  activityWeights?: number[];
  platformAllocation: Record<string, number>;
  slate: SlateCreator[];
  marketContext?: MarketSchedulingContext;
  campaignStartDate?: string;
};

function dominantPlatform(allocation: Record<string, number>): string | undefined {
  return sortedPlatforms(allocation)[0]?.platform;
}

function tierOrderingSummary(slate: SlateCreator[]): string {
  const tiers = slate
    .map((creator) => creator.tier?.trim())
    .filter((tier): tier is string => Boolean(tier));
  if (!tiers.length) return "Creator tier order follows quotation sequence once slate is confirmed.";
  const unique = [...new Set(tiers)];
  return `Quotation slate orders ${slate.length} creators across ${unique.join(", ")} — hero tiers publish first when journey weights peak.`;
}

/** Bullet evidence for expandable "Why?" under strategy sections — internal view only. */
export function buildSectionRationale(
  section: MediaPlanSectionRationaleKey,
  input: MediaPlanSectionRationaleInput
): string[] {
  const classification = classifyCampaignType({
    briefText: input.briefText,
    objective: input.objective,
    industry: input.industry,
    marketCountry: input.marketContext?.countries[0],
    season: input.marketContext?.category,
  });

  switch (section) {
    case "platformAllocation": {
      const ranked = sortedPlatforms(input.platformAllocation);
      const dominant = ranked[0];
      const bullets: string[] = [];
      if (dominant) {
        bullets.push(
          `${dominant.platform} carries ${dominant.percentage}% of deliverable slots — aligned to ${classification.primary.replace(/_/g, " ")} campaign type and brief platform signals.`
        );
      }
      if (input.objective?.trim()) {
        bullets.push(`Campaign objective "${input.objective.trim()}" informs platform mix — conversion objectives weight commerce-friendly surfaces.`);
      }
      const platformMentions = ranked
        .filter((entry) => new RegExp(`\\b${entry.platform}\\b`, "i").test(input.briefText))
        .map((entry) => entry.platform);
      if (platformMentions.length) {
        bullets.push(`Brief explicitly references ${platformMentions.join(", ")} — allocation respects client-stated channel priority.`);
      }
      if (!bullets.length) {
        bullets.push("Platform allocation derived from quotation deliverable types and creator platform strengths.");
      }
      return bullets.slice(0, 4);
    }

    case "weeklyObjectives": {
      const display = input.activityWeights ?? input.weekWeights;
      const peakIndex = display.reduce(
        (best, weight, index) => (weight > (display[best] ?? 0) ? index : best),
        0
      );
      const peakWeight = display[peakIndex] ?? 0;
      const bullets = [
        `Week ${peakIndex + 1} carries ${peakWeight}% activity weight — peak emphasis matches ${classification.primary.replace(/_/g, " ")} rollout pattern.`,
        classification.toneHint,
      ];
      if (input.objective?.trim()) {
        bullets.push(`Phase goals tied to objective: ${input.objective.trim()}.`);
      }
      if (display.length >= 2 && display[0]! > display[display.length - 1]! + 10) {
        bullets.push("Front-loaded weight curve — launch energy concentrates in early weeks per brief journey.");
      }
      return bullets.slice(0, 4);
    }

    case "creatorOrdering": {
      const bullets = [tierOrderingSummary(input.slate)];
      const megaMacro = input.slate.filter((c) => /mega|macro|celebrity/i.test(c.tier ?? "")).length;
      if (megaMacro > 0) {
        bullets.push(
          `${megaMacro} hero-tier creator${megaMacro === 1 ? "" : "s"} anchor narrative before mid/micro amplification weeks.`
        );
      }
      if (classification.primary === "product_launch") {
        bullets.push("Product launch sequencing — credibility creators first, then community proof and trial content.");
      } else if (classification.primary === "engagement") {
        bullets.push("Engagement flight — participatory creators scheduled when week weights invite audience action.");
      }
      if (input.briefText.match(/\bsequenc|order|hero\b/i)) {
        bullets.push("Brief references creator sequencing — calendar honours stated hero-to-support progression.");
      }
      return bullets.slice(0, 4);
    }

    case "marketTiming": {
      if (!input.marketContext?.config.enabled) {
        return ["Market intelligence disabled — timing follows creator journey weights only."];
      }
      const citations = buildMarketTimingCitations({
        context: input.marketContext,
        weekWeights: input.weekWeights,
        durationWeeks: input.weekWeights.length,
        objective: input.objective,
      });
      return citations
        .slice(0, 4)
        .map(
          (citation) =>
            `${citation.driver}: ${citation.reason} (${citation.confidencePercent}% confidence)`
        );
    }

    default:
      return [];
  }
}
