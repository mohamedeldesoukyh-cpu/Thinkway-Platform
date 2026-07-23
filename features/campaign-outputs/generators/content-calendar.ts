/**
 * Content Calendar generator — a week-by-week content schedule with the
 * recommended service type per post. Lighter than the Media Plan (no paid/
 * milestone machinery): it answers "what content publishes when". Derives from
 * creators + platforms + timeline.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";
import { primaryService, tierRank } from "./generator-utils";

import { resolveMarketIntelligenceConfig } from "@/features/market-intelligence/market-intelligence-config";

export const CONTENT_CALENDAR_GENERATOR_VERSION = "1.1.0";

const DEFAULT_DURATION_WEEKS = 6;
/** Content pieces scheduled per week. */
const PIECES_PER_WEEK = 3;

export function generateContentCalendar(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = Math.max(1, Math.min(52, facts?.durationWeeks ?? DEFAULT_DURATION_WEEKS));
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const slate = [...resolveSlate(campaignObject)].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  const marketConfig = resolveMarketIntelligenceConfig(campaignObject);

  const serviceCounts: Record<string, number> = {};
  let cursor = 0;
  let platformCursor = 0;

  const weeks = Array.from({ length: durationWeeks }, (_, i) => {
    const week = i + 1;
    const pieces = Array.from({ length: PIECES_PER_WEEK }, () => {
      const creator = slate.length ? slate[cursor % slate.length] : undefined;
      cursor += 1;
      const platform = platforms[platformCursor % platforms.length]!;
      platformCursor += 1;
      const service = creator ? primaryService(creator.tier, platform) : "Content";
      serviceCounts[service] = (serviceCounts[service] ?? 0) + 1;
      return {
        creator: creator?.displayName ?? "TBD",
        tier: creator?.tier,
        platform,
        service,
      };
    });
    return { week, pieces };
  });

  const sections: CampaignOutputContent["sections"] = weeks.map((w) => ({
    heading: `Week ${w.week}`,
    items: w.pieces.map((p) => `${p.creator} — ${p.service} · ${p.platform}`),
  }));

  const mixEntries = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);
  if (mixEntries.length) {
    sections.push({
      heading: "Content Mix",
      items: mixEntries.map(([service, count]) => `${service}: ${count} pieces`),
    });
  }

  sections.unshift({
    heading: "Scheduling Context",
    body: marketConfig.enabled
      ? `Market intelligence is active for ${marketConfig.countries.join(", ")} — content weeks follow the same local timing signals as the Media Plan.`
      : "Market intelligence is off — weeks distribute content evenly without local market timing.",
  });

  return {
    title: "Content Calendar",
    summary: `${durationWeeks}-week content calendar with ${weeks.length * PIECES_PER_WEEK} scheduled pieces across ${platforms.length} platform${platforms.length === 1 ? "" : "s"}.`,
    sections,
    data: { durationWeeks, weeks, serviceCounts },
  };
}
