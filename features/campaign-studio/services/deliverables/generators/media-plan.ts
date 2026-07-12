/**
 * Media Plan generator — deterministic, standalone deliverable.
 *
 * Input:  Campaign Object (creators + timeline + platforms + deliverables scope).
 * Output: a creator-by-creator publishing calendar — weekly & daily schedule,
 *         platform allocation, wave planning, dependencies, review & client
 *         approval milestones, and optimization windows.
 *
 * Pure and deterministic: the same Campaign Object always yields the same plan,
 * so it can be regenerated independently and diffed across versions.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { DeliverableContent, DeliverableContentSection } from "../deliverable-types";
import { resolveSlate, type SlateCreator } from "../deliverable-inputs";

const TIER_PRIORITY: Record<string, number> = {
  celebrity: 0,
  mega: 0,
  macro: 1,
  "mid-tier": 2,
  mid: 2,
  micro: 3,
  nano: 4,
};

const DEFAULT_DURATION_WEEKS = 6;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
/** Days that carry creator publishing (the rest are Stories / Boost / Monitoring). */
const CONTENT_DAY_INDEXES = [0, 1, 2, 4] as const;

export type MediaPlanDayType = "content" | "stories" | "boost" | "monitoring";

export type MediaPlanDay = {
  day: string;
  type: MediaPlanDayType;
  label: string;
  creator?: string;
  tier?: string;
  platform?: string;
};

export type MediaPlanWeek = {
  week: number;
  wave: number;
  phase: string;
  days: MediaPlanDay[];
};

export type MediaPlanWave = {
  wave: number;
  weeks: number[];
  theme: string;
};

export type MediaPlanMilestone = {
  type: "review" | "client_approval" | "optimization";
  week: number;
  label: string;
};

export type MediaPlanData = {
  durationWeeks: number;
  weeks: MediaPlanWeek[];
  waves: MediaPlanWave[];
  milestones: MediaPlanMilestone[];
  platformAllocation: Record<string, number>;
  creatorCount: number;
};

function tierRank(tier?: string): number {
  if (!tier) return 5;
  const key = tier.trim().toLowerCase();
  return TIER_PRIORITY[key] ?? 5;
}

function sortSlateByTier(slate: SlateCreator[]): SlateCreator[] {
  return [...slate].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

function waveForWeek(week: number, durationWeeks: number, waveCount: number): number {
  const perWave = Math.ceil(durationWeeks / waveCount);
  return Math.min(waveCount, Math.floor((week - 1) / perWave) + 1);
}

function phaseForWeek(week: number, durationWeeks: number): string {
  if (week === 1) return "Launch";
  if (week === durationWeeks) return "Reporting";
  if (week === durationWeeks - 1) return "Optimization";
  if (week <= Math.ceil(durationWeeks * 0.6)) return "Content Production";
  return "Publishing";
}

/**
 * Build the week→day schedule. Creators are ordered by tier and assigned
 * round-robin into the content slots across all weeks, so every creator lands on
 * the calendar and higher tiers lead each week. Non-content days carry the
 * recurring Stories / Boost / Monitoring rhythm from the standard plan.
 */
export function generateMediaPlan(campaignObject: CampaignObject): DeliverableContent {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = Math.max(1, Math.min(52, facts?.durationWeeks ?? DEFAULT_DURATION_WEEKS));
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const slate = sortSlateByTier(resolveSlate(campaignObject));
  const waveCount = durationWeeks >= 6 ? 3 : durationWeeks >= 3 ? 2 : 1;

  const platformAllocation: Record<string, number> = {};
  let contentSlotCursor = 0;
  let platformCursor = 0;

  const weeks: MediaPlanWeek[] = [];
  for (let week = 1; week <= durationWeeks; week += 1) {
    const wave = waveForWeek(week, durationWeeks, waveCount);
    const phase = phaseForWeek(week, durationWeeks);
    const days: MediaPlanDay[] = DAYS.map((day, index) => {
      if ((CONTENT_DAY_INDEXES as readonly number[]).includes(index)) {
        // Assign the next creator (round-robin) to this content slot.
        const creator = slate.length ? slate[contentSlotCursor % slate.length] : undefined;
        contentSlotCursor += 1;
        if (!creator) {
          return { day, type: "content", label: "Content publishing" };
        }
        const platform = platforms[platformCursor % platforms.length]!;
        platformCursor += 1;
        platformAllocation[platform] = (platformAllocation[platform] ?? 0) + 1;
        const format = tierRank(creator.tier) <= 1 ? "Reel" : "Post";
        return {
          day,
          type: "content",
          label: `${creator.displayName} — ${format}`,
          creator: creator.displayName,
          tier: creator.tier,
          platform,
        };
      }
      if (index === 3) return { day, type: "stories", label: "Stories & interactive polls" };
      if (index === 5) return { day, type: "boost", label: "Paid boost on top-performing content" };
      return { day, type: "monitoring", label: "Performance monitoring & community management" };
    });
    weeks.push({ week, wave, phase, days });
  }

  const waves: MediaPlanWave[] = Array.from({ length: waveCount }, (_, i) => {
    const wave = i + 1;
    const weekNumbers = weeks.filter((w) => w.wave === wave).map((w) => w.week);
    const theme =
      waveCount === 1
        ? "Full campaign flight"
        : wave === 1
          ? "Awareness & launch"
          : wave === waveCount
            ? "Conversion & closeout"
            : "Consideration & sustain";
    return { wave, weeks: weekNumbers, theme };
  });

  const milestones: MediaPlanMilestone[] = [];
  milestones.push({ type: "client_approval", week: 1, label: "Client sign-off on content & schedule before launch" });
  for (const week of weeks) {
    milestones.push({ type: "review", week: week.week, label: `Week ${week.week} content review & approvals` });
  }
  if (durationWeeks >= 3) {
    const midpoint = Math.ceil(durationWeeks / 2);
    milestones.push({ type: "client_approval", week: midpoint, label: "Mid-campaign client checkpoint" });
    milestones.push({ type: "optimization", week: durationWeeks - 1, label: "Optimization window — reallocate boost to top performers" });
  }

  const data: MediaPlanData = {
    durationWeeks,
    weeks,
    waves,
    milestones,
    platformAllocation,
    creatorCount: slate.length,
  };

  return {
    title: "Media Plan",
    summary: `${durationWeeks}-week publishing calendar across ${slate.length} creator${slate.length === 1 ? "" : "s"} and ${platforms.length} platform${platforms.length === 1 ? "" : "s"}, organized into ${waveCount} wave${waveCount === 1 ? "" : "s"}.`,
    sections: buildSections(data),
    data: data as unknown as Record<string, unknown>,
  };
}

function buildSections(data: MediaPlanData): DeliverableContentSection[] {
  const sections: DeliverableContentSection[] = [];

  sections.push({
    heading: "Waves",
    items: data.waves.map(
      (wave) => `Wave ${wave.wave} — ${wave.theme} (weeks ${wave.weeks.join(", ")})`
    ),
  });

  for (const week of data.weeks) {
    sections.push({
      heading: `Week ${week.week} — ${week.phase} (Wave ${week.wave})`,
      items: week.days.map((day) => `${day.day}: ${day.label}${day.platform ? ` · ${day.platform}` : ""}`),
    });
  }

  const allocationEntries = Object.entries(data.platformAllocation);
  if (allocationEntries.length) {
    sections.push({
      heading: "Platform Allocation",
      items: allocationEntries.map(([platform, count]) => `${platform}: ${count} scheduled posts`),
    });
  }

  sections.push({
    heading: "Milestones",
    items: data.milestones.map((milestone) => {
      const tag =
        milestone.type === "client_approval"
          ? "Client approval"
          : milestone.type === "optimization"
            ? "Optimization"
            : "Review";
      return `Week ${milestone.week} · ${tag}: ${milestone.label}`;
    }),
  });

  return sections;
}
