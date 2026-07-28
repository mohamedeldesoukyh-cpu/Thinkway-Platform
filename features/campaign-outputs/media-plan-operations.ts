/**
 * Calendar- and quotation-driven operations data for Media Plan documents.
 * Waves, milestones, week phases, and planning-mode overview — no generic placeholders.
 */

import type { SlateCreator } from "./output-inputs";
import { countCalendarActivationsPerWeek } from "./media-plan-calendar-slate";
import { CAMPAIGN_MOMENT_LABELS, dominantMomentForWeek } from "./media-plan-moments";
import { formatTierCountSummary, countTiers } from "./media-plan-strategy-narrative";
import { canonicalPlatformLabel, mergePlatformAllocation } from "./platform-allocation";
import { sortedPlatforms } from "./media-plan-strategy-narrative";
import type {
  MediaPlanCampaignContext,
  MediaPlanDeadline,
  MediaPlanMilestone,
  MediaPlanWave,
  MediaPlanWeek,
} from "./generators/media-plan";

export type MediaPlanDocumentMode = "planning" | "strategy";

const DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

/** Planning = quotation/shortlist only; strategy = brief + quotation. */
export function resolveMediaPlanDocumentMode(hasBrief: boolean): MediaPlanDocumentMode {
  return hasBrief ? "strategy" : "planning";
}

function dayIndexForName(dayName: string): number {
  const index = DAYS.findIndex((day) => day === dayName);
  return index >= 0 ? index : 0;
}

/** Format a calendar date relative to campaign start (week 1 Saturday). */
export function formatLeadDateLabel(
  campaignStartIso: string,
  publishWeek: number,
  publishDay: string,
  leadDays: number
): string {
  const [year, month, day] = campaignStartIso.split("-").map((part) => Number(part));
  if (!year || !month || !day) return `Week ${publishWeek} · ${publishDay}`;

  const start = new Date(year, month - 1, day, 12, 0, 0, 0);
  const publish = new Date(start);
  publish.setDate(publish.getDate() + (publishWeek - 1) * 7 + dayIndexForName(publishDay));
  publish.setDate(publish.getDate() - leadDays);

  const publishDayNum = publish.getDate();
  const publishMonth = publish.getMonth() + 1;
  const publishYear = String(publish.getFullYear()).slice(-2);
  return `${publishDayNum}/${publishMonth}/${publishYear}`;
}

/** Derive a phase label for each calendar week from scheduled activations. */
export function deriveWeekPhasesFromCalendar(
  weeks: MediaPlanWeek[],
  durationWeeks: number
): string[] {
  const activityCounts = countCalendarActivationsPerWeek(weeks);
  const maxCount = Math.max(...activityCounts, 1);

  return weeks.map((week, index) => {
    const count = activityCounts[index] ?? 0;
    if (count === 0) {
      return week.week === durationWeeks ? "Wrap-up" : "Buffer";
    }

    const moment = dominantMomentForWeek(week.week, durationWeeks);
    const basePhase = CAMPAIGN_MOMENT_LABELS[moment];

    if (index === 0 && count >= maxCount * 0.7) return "Launch";
    if (week.week === durationWeeks) return count > 0 ? "Wrap-up" : basePhase;
    if (count >= maxCount * 0.85) return index === 0 ? "Launch" : "Amplify";
    if (count <= maxCount * 0.35) return "Maintain";
    return basePhase;
  });
}

/** Apply calendar-derived phase labels onto week rows. */
export function applyWeekPhasesFromCalendar(
  weeks: MediaPlanWeek[],
  durationWeeks: number
): MediaPlanWeek[] {
  const phases = deriveWeekPhasesFromCalendar(weeks, durationWeeks);
  return weeks.map((week, index) => ({
    ...week,
    phase: phases[index] ?? week.phase,
  }));
}

function countUniqueCreatorsInWeek(week: MediaPlanWeek): number {
  const creators = new Set<string>();
  for (const day of week.days) {
    if (day.type !== "content" && day.type !== "stories" && day.type !== "boost") continue;
    const key = day.creatorId?.trim() || day.creator?.trim();
    if (key) creators.add(key.toLowerCase());
    for (const extra of day.additionalDeliverables ?? []) {
      if (extra.isMirror || extra.isCompanion) continue;
      const extraKey = extra.creatorId?.trim() || extra.creator?.trim();
      if (extraKey) creators.add(extraKey.toLowerCase());
    }
  }
  return creators.size;
}

/** Group consecutive weeks with the same phase into activation waves. */
export function buildActivationWavesFromCalendar(
  weeks: MediaPlanWeek[],
  durationWeeks: number
): MediaPlanWave[] {
  if (!weeks.length) return [];

  const phases = deriveWeekPhasesFromCalendar(weeks, durationWeeks);
  const activityCounts = countCalendarActivationsPerWeek(weeks);
  const waves: MediaPlanWave[] = [];

  let wavePhase = phases[0]!;
  let waveWeeks: number[] = [];
  let activationCount = 0;
  let creatorCount = 0;

  function flushWave() {
    if (!waveWeeks.length) return;
    const creatorTotal = waveWeeks.reduce(
      (sum, weekNum) => sum + countUniqueCreatorsInWeek(weeks[weekNum - 1]!),
      0
    );
    const span =
      waveWeeks.length > 1
        ? `Weeks ${waveWeeks[0]}–${waveWeeks[waveWeeks.length - 1]}`
        : `Week ${waveWeeks[0]}`;
    waves.push({
      wave: waves.length + 1,
      weeks: [...waveWeeks],
      theme: `${wavePhase} — ${activationCount} activation${activationCount === 1 ? "" : "s"}, ${creatorTotal} creator${creatorTotal === 1 ? "" : "s"} (${span})`,
      creatorCount: creatorTotal || creatorCount,
      activationCount,
    });
    waveWeeks = [];
    activationCount = 0;
    creatorCount = 0;
  }

  for (let index = 0; index < weeks.length; index += 1) {
    const week = weeks[index]!;
    const phase = phases[index]!;

    if (waveWeeks.length && phase !== wavePhase) {
      flushWave();
      wavePhase = phase;
    }

    waveWeeks.push(week.week);
    activationCount += activityCounts[index] ?? 0;
    creatorCount += countUniqueCreatorsInWeek(week);
  }

  flushWave();
  return waves;
}

function deadlinesByPublishOrder(deadlines: MediaPlanDeadline[]): MediaPlanDeadline[] {
  return [...deadlines].sort((a, b) => {
    if (a.publishWeek !== b.publishWeek) return a.publishWeek - b.publishWeek;
    return dayIndexForName(a.publishDay) - dayIndexForName(b.publishDay);
  });
}

/** Milestones derived from production deadlines and publishing schedule — not generic review strings. */
export function buildMilestonesFromSchedule(input: {
  deadlines: MediaPlanDeadline[];
  weeks: MediaPlanWeek[];
  durationWeeks: number;
  campaignStartDate: string;
  includePaidRhythm: boolean;
}): MediaPlanMilestone[] {
  const milestones: MediaPlanMilestone[] = [];
  const sorted = deadlinesByPublishOrder(input.deadlines);

  if (sorted.length) {
    const first = sorted[0]!;
    milestones.push({
      type: "client_approval",
      week: 1,
      label: `Client sign-off on content & schedule before first publish (Week ${first.publishWeek} · ${first.publishDay})`,
    });
  } else {
    milestones.push({
      type: "client_approval",
      week: 1,
      label: "Client sign-off on content & schedule before launch",
    });
  }

  const productionByPublishWeek = new Map<number, MediaPlanDeadline[]>();
  const assetByPublishWeek = new Map<number, MediaPlanDeadline[]>();
  for (const deadline of sorted) {
    productionByPublishWeek.set(deadline.publishWeek, [
      ...(productionByPublishWeek.get(deadline.publishWeek) ?? []),
      deadline,
    ]);
    assetByPublishWeek.set(deadline.publishWeek, [
      ...(assetByPublishWeek.get(deadline.publishWeek) ?? []),
      deadline,
    ]);
  }

  for (const [week, rows] of [...productionByPublishWeek.entries()].sort(([a], [b]) => a - b)) {
    const creators = new Set(rows.map((row) => row.creator));
    const earliest = rows.reduce((min, row) => (row.productionStart < min ? row.productionStart : min), rows[0]!.productionStart);
    milestones.push({
      type: "review",
      week,
      label: `Production starts for ${creators.size} creator${creators.size === 1 ? "" : "s"} — ${rows.length} deliverable${rows.length === 1 ? "" : "s"} (from ${earliest})`,
    });
  }

  for (const [week, rows] of [...assetByPublishWeek.entries()].sort(([a], [b]) => a - b)) {
    const latestAsset = rows.reduce((max, row) => (row.assetDelivery > max ? row.assetDelivery : max), rows[0]!.assetDelivery);
    milestones.push({
      type: "review",
      week,
      label: `${rows.length} asset delivery deadline${rows.length === 1 ? "" : "s"} before Week ${week} publish (due ${latestAsset})`,
    });
  }

  const publishWeeks = new Map<number, number>();
  for (const deadline of sorted) {
    publishWeeks.set(deadline.publishWeek, (publishWeeks.get(deadline.publishWeek) ?? 0) + 1);
  }
  for (const [week, count] of [...publishWeeks.entries()].sort(([a], [b]) => a - b)) {
    const phase = input.weeks[week - 1]?.phase ?? "Publishing";
    milestones.push({
      type: "optimization",
      week,
      label: `${phase} window — ${count} publish slot${count === 1 ? "" : "s"} scheduled`,
    });
  }

  if (input.durationWeeks >= 3) {
    const midpoint = Math.ceil(input.durationWeeks / 2);
    const midPublish = publishWeeks.get(midpoint) ?? 0;
    if (midPublish > 0) {
      milestones.push({
        type: "client_approval",
        week: midpoint,
        label: `Mid-campaign checkpoint — ${midPublish} activation${midPublish === 1 ? "" : "s"} in Week ${midpoint}`,
      });
    }
  }

  if (input.includePaidRhythm) {
    for (const week of input.weeks) {
      milestones.push({
        type: "amplification",
        week: week.week,
        label: `Paid amplification window (Saturday boost, Week ${week.week})`,
      });
    }
    milestones.push({
      type: "contingency",
      week: input.durationWeeks,
      label: "Contingency buffer for reshoots / rescheduled posts",
    });
  } else if (sorted.length) {
    const last = sorted[sorted.length - 1]!;
    milestones.push({
      type: "optimization",
      week: input.durationWeeks,
      label: `Campaign wrap-up & reporting after final publish (Week ${last.publishWeek} · ${last.publishDay})`,
    });
  }

  return milestones;
}

/** Factual campaign overview for planning mode (quotation only, no brief). */
export function buildCampaignOverviewFromQuotation(input: {
  slate: SlateCreator[];
  platformAllocation: Record<string, number>;
  durationWeeks: number;
  postingSlotCount?: number;
  campaignContext?: MediaPlanCampaignContext;
}): string {
  const deliverableCount = input.postingSlotCount ?? Object.values(input.platformAllocation).reduce((s, c) => s + c, 0);
  const creatorCount = input.slate.length;
  const ranked = sortedPlatforms(input.platformAllocation);
  const platformNote = ranked.length
    ? ranked.map((entry) => `${entry.platform} (${entry.count} deliverable${entry.count === 1 ? "" : "s"}, ${entry.percentage}%)`).join(", ")
    : "platform mix pending quotation confirmation";

  const brand = input.campaignContext?.brandName?.trim();
  const client = input.campaignContext?.clientName?.trim();
  const subject = brand && client ? `${brand} (${client})` : brand || client || "This campaign";

  const tierSummary = creatorCount ? formatTierCountSummary(countTiers(input.slate)) : "";

  const parts = [
    `${subject} is structured as a ${input.durationWeeks}-week influencer publishing plan covering ${deliverableCount} quoted deliverable${deliverableCount === 1 ? "" : "s"} across ${creatorCount} creator${creatorCount === 1 ? "" : "s"}.`,
    `Platform allocation from the quotation: ${platformNote}.`,
  ];

  if (tierSummary) {
    parts.push(`Creator mix: ${tierSummary}.`);
  }

  return parts.join(" ");
}

/** Summarize brief objective, audience, and KPIs in 2–3 sentences (not verbatim copy). */
export function buildBriefObjectiveSummary(input: {
  objective?: string;
  audience?: string;
  kpis?: string[];
  durationWeeks: number;
}): string | undefined {
  const objective = input.objective?.trim();
  const audience = input.audience?.trim();
  const kpis = input.kpis?.filter((kpi) => kpi.trim()) ?? [];

  if (!objective && !audience && !kpis.length) return undefined;

  const sentences: string[] = [];

  if (objective && audience) {
    sentences.push(
      `This ${input.durationWeeks}-week campaign aims to ${objective.charAt(0).toLowerCase() + objective.slice(1).replace(/\.$/, "")} among ${audience}.`
    );
  } else if (objective) {
    sentences.push(
      `This ${input.durationWeeks}-week campaign aims to ${objective.charAt(0).toLowerCase() + objective.slice(1).replace(/\.$/, "")}.`
    );
  } else if (audience) {
    sentences.push(`The campaign targets ${audience} over a ${input.durationWeeks}-week publishing flight.`);
  }

  if (kpis.length) {
    const kpiList = kpis.slice(0, 3).join(", ");
    sentences.push(`Success will be measured against ${kpiList}${kpis.length > 3 ? ", and additional KPIs" : ""}.`);
  }

  return sentences.slice(0, 3).join(" ");
}

/** Count every quotation line by platform — includes mirrors and cross-posts. */
export function buildPlatformAllocationFromQuotation(
  slate: SlateCreator[],
  platforms: string[],
  expandRaw: (slate: SlateCreator[], platforms: string[]) => Array<{ platform: string }>
): Record<string, number> {
  const allocation: Record<string, number> = {};
  for (const deliverable of expandRaw(slate, platforms)) {
    const label = canonicalPlatformLabel(deliverable.platform);
    allocation[label] = (allocation[label] ?? 0) + 1;
  }
  return mergePlatformAllocation(allocation);
}
