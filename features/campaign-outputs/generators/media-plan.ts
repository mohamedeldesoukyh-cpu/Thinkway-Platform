/**
 * Media Plan generator — a dedicated, agency-grade Campaign Output.
 *
 * The Media Plan is NOT the campaign timeline. It is a client-approval-ready
 * publishing plan derived from the Campaign Object (creators + timeline +
 * platforms + deliverables scope): weekly & daily calendar, creator-by-creator
 * schedule, platform allocation, activation waves, review & client approval
 * milestones, optimization & paid amplification windows, contingency windows,
 * creator dependencies, and internal production / asset delivery deadlines.
 *
 * Pure and deterministic: the same Campaign Object always yields the same plan,
 * so it can be regenerated independently and diffed across versions.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import { resolveSlate, type SlateCreator } from "../output-inputs";

export const MEDIA_PLAN_GENERATOR_VERSION = "1.0.0";

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
/** Assets must be delivered this many days before the publish date. */
const ASSET_LEAD_DAYS = 3;
/** Production must start this many days before the publish date. */
const PRODUCTION_LEAD_DAYS = 7;

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

export type MediaPlanWave = { wave: number; weeks: number[]; theme: string };

export type MediaPlanMilestone = {
  type: "review" | "client_approval" | "optimization" | "amplification" | "contingency";
  week: number;
  label: string;
};

export type MediaPlanDependency = { creator: string; dependsOn: string; note: string };

export type MediaPlanDeadline = {
  creator: string;
  publishWeek: number;
  publishDay: string;
  productionStart: string;
  assetDelivery: string;
};

export type MediaPlanData = {
  durationWeeks: number;
  weeks: MediaPlanWeek[];
  waves: MediaPlanWave[];
  milestones: MediaPlanMilestone[];
  platformAllocation: Record<string, number>;
  dependencies: MediaPlanDependency[];
  deadlines: MediaPlanDeadline[];
  creatorCount: number;
  generatorVersion: string;
};

function tierRank(tier?: string): number {
  if (!tier) return 5;
  return TIER_PRIORITY[tier.trim().toLowerCase()] ?? 5;
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

/** "Week 2 · Tuesday" minus N days, expressed as a readable production/asset date. */
function leadDate(week: number, dayIndex: number, leadDays: number): string {
  const absoluteDay = (week - 1) * 7 + dayIndex; // 0-based day across the campaign
  const target = absoluteDay - leadDays;
  if (target < 0) return "Pre-campaign (before Week 1)";
  const w = Math.floor(target / 7) + 1;
  const d = DAYS[target % 7]!;
  return `Week ${w} · ${d}`;
}

export function generateMediaPlan(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = Math.max(1, Math.min(52, facts?.durationWeeks ?? DEFAULT_DURATION_WEEKS));
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const slate = sortSlateByTier(resolveSlate(campaignObject));
  const waveCount = durationWeeks >= 6 ? 3 : durationWeeks >= 3 ? 2 : 1;

  const platformAllocation: Record<string, number> = {};
  const deadlines: MediaPlanDeadline[] = [];
  let contentSlotCursor = 0;
  let platformCursor = 0;

  const weeks: MediaPlanWeek[] = [];
  for (let week = 1; week <= durationWeeks; week += 1) {
    const wave = waveForWeek(week, durationWeeks, waveCount);
    const phase = phaseForWeek(week, durationWeeks);
    const days: MediaPlanDay[] = DAYS.map((day, index) => {
      if ((CONTENT_DAY_INDEXES as readonly number[]).includes(index)) {
        const creator = slate.length ? slate[contentSlotCursor % slate.length] : undefined;
        contentSlotCursor += 1;
        if (!creator) return { day, type: "content", label: "Content publishing" };
        const platform = platforms[platformCursor % platforms.length]!;
        platformCursor += 1;
        platformAllocation[platform] = (platformAllocation[platform] ?? 0) + 1;
        const format = tierRank(creator.tier) <= 1 ? "Reel" : "Post";
        deadlines.push({
          creator: creator.displayName,
          publishWeek: week,
          publishDay: day,
          productionStart: leadDate(week, index, PRODUCTION_LEAD_DAYS),
          assetDelivery: leadDate(week, index, ASSET_LEAD_DAYS),
        });
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

  // Creator dependencies: higher-tier creators lead; the next tier follows their launch.
  const dependencies: MediaPlanDependency[] = [];
  for (let i = 1; i < slate.length; i += 1) {
    const current = slate[i]!;
    const lead = slate[i - 1]!;
    if (tierRank(current.tier) > tierRank(lead.tier)) {
      dependencies.push({
        creator: current.displayName,
        dependsOn: lead.displayName,
        note: `${current.displayName} activates after ${lead.displayName}'s content sets the narrative`,
      });
    }
  }

  const milestones: MediaPlanMilestone[] = [];
  milestones.push({
    type: "client_approval",
    week: 1,
    label: "Client sign-off on content & schedule before launch",
  });
  for (const week of weeks) {
    milestones.push({ type: "review", week: week.week, label: `Week ${week.week} content review & approvals` });
    milestones.push({ type: "amplification", week: week.week, label: `Paid amplification window (Saturday boost, Week ${week.week})` });
  }
  if (durationWeeks >= 3) {
    const midpoint = Math.ceil(durationWeeks / 2);
    milestones.push({ type: "client_approval", week: midpoint, label: "Mid-campaign client checkpoint" });
    milestones.push({
      type: "optimization",
      week: durationWeeks - 1,
      label: "Optimization window — reallocate boost to top performers",
    });
    milestones.push({
      type: "contingency",
      week: durationWeeks,
      label: "Contingency buffer for reshoots / rescheduled posts",
    });
  }

  const data: MediaPlanData = {
    durationWeeks,
    weeks,
    waves,
    milestones,
    platformAllocation,
    dependencies,
    deadlines,
    creatorCount: slate.length,
    generatorVersion: MEDIA_PLAN_GENERATOR_VERSION,
  };

  return {
    title: "Media Plan",
    summary: `${durationWeeks}-week client-approval-ready publishing plan across ${slate.length} creator${slate.length === 1 ? "" : "s"} and ${platforms.length} platform${platforms.length === 1 ? "" : "s"}, organized into ${waveCount} wave${waveCount === 1 ? "" : "s"}.`,
    sections: buildSections(data),
    data: data as unknown as Record<string, unknown>,
  };
}

function buildSections(data: MediaPlanData): CampaignOutputContentSection[] {
  const sections: CampaignOutputContentSection[] = [];

  sections.push({
    heading: "Activation Waves",
    items: data.waves.map((wave) => `Wave ${wave.wave} — ${wave.theme} (weeks ${wave.weeks.join(", ")})`),
  });

  for (const week of data.weeks) {
    sections.push({
      heading: `Week ${week.week} — ${week.phase} (Wave ${week.wave})`,
      items: week.days.map(
        (day) => `${day.day}: ${day.label}${day.platform ? ` · ${day.platform}` : ""}`
      ),
    });
  }

  const allocationEntries = Object.entries(data.platformAllocation);
  if (allocationEntries.length) {
    sections.push({
      heading: "Platform Allocation",
      items: allocationEntries.map(([platform, count]) => `${platform}: ${count} scheduled posts`),
    });
  }

  if (data.dependencies.length) {
    sections.push({
      heading: "Creator Dependencies",
      items: data.dependencies.map((dep) => dep.note),
    });
  }

  if (data.deadlines.length) {
    sections.push({
      heading: "Production & Asset Delivery Deadlines",
      table: {
        columns: ["Creator", "Publish", "Production starts", "Assets due"],
        rows: data.deadlines.map((d) => [
          d.creator,
          `Week ${d.publishWeek} · ${d.publishDay}`,
          d.productionStart,
          d.assetDelivery,
        ]),
      },
    });
  }

  sections.push({
    heading: "Milestones & Windows",
    items: data.milestones.map((milestone) => {
      const tag: Record<MediaPlanMilestone["type"], string> = {
        client_approval: "Client approval",
        optimization: "Optimization",
        amplification: "Amplification",
        contingency: "Contingency",
        review: "Review",
      };
      return `Week ${milestone.week} · ${tag[milestone.type]}: ${milestone.label}`;
    }),
  });

  return sections;
}
