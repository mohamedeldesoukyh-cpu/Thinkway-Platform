import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  generateMediaPlan,
  type MediaPlanData,
} from "@/features/campaign-outputs/generators/media-plan";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";
import {
  isTimelineSectionData,
  type TimelineSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import type { QuotationTentativeScheduleFields } from "./quotation-types";

const WEEKDAY_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export type CreatorTentativeScheduleBundle = {
  /** Earliest content deadline for the creator across platforms. */
  primary: QuotationTentativeScheduleFields;
  /** First content deadline per canonical platform key. */
  byPlatform: Record<string, QuotationTentativeScheduleFields>;
};

/** Normalized unified id or display name → tentative schedule bundle. */
export type ScheduleByCreatorKey = Map<string, CreatorTentativeScheduleBundle>;

export function normalizeCreatorScheduleKey(value: string): string {
  return normalizeCreatorId(value).trim().toLowerCase();
}

function readTimelineData(campaignObject: CampaignObject): TimelineSectionData | null {
  const content = campaignObject.sections.timeline?.content;
  if (isTimelineSectionData(content)) return content;
  const data = campaignObject.sections.timeline?.data;
  if (isTimelineSectionData(data)) return data;
  return null;
}

/** Resolve week-1 Monday anchor for calendar dates. */
export function resolveCampaignPlanAnchorStartDate(input: {
  anchorStartDate?: string | null;
  campaignObject: CampaignObject;
  issueDate?: string | null;
}): string | null {
  const explicit = input.anchorStartDate?.trim().slice(0, 10);
  if (explicit) return explicit;

  const facts = getCampaignFacts(input.campaignObject);
  const timeline = readTimelineData(input.campaignObject);
  const goLiveWeek = timeline?.goLiveWeek;
  const durationWeeks = timeline?.durationWeeks ?? facts?.durationWeeks;

  const issue = input.issueDate?.trim().slice(0, 10);
  if (issue && goLiveWeek != null && goLiveWeek > 1) {
    const shifted = addDaysIso(issue, (goLiveWeek - 1) * 7);
    return shifted;
  }
  if (issue) return issue;

  if (durationWeeks != null) {
    return new Date().toISOString().slice(0, 10);
  }

  return null;
}

function addDaysIso(base: string, days: number): string {
  const date = new Date(`${base}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveTentativePostingDate(
  anchorStartDate: string | null | undefined,
  publishWeek: number,
  publishDay: string
): string | null {
  if (!anchorStartDate?.trim()) return null;
  const dayIndex = WEEKDAY_INDEX[publishDay.trim().toLowerCase()];
  if (dayIndex == null) return null;
  const offsetDays = (publishWeek - 1) * 7 + dayIndex;
  return addDaysIso(anchorStartDate.trim().slice(0, 10), offsetDays);
}

export function buildTentativeScheduleLabel(publishWeek: number, publishDay: string): string {
  return `Week ${publishWeek} · ${publishDay}`;
}

function buildScheduleFields(
  publishWeek: number,
  publishDay: string,
  anchorStartDate: string | null
): QuotationTentativeScheduleFields {
  return {
    tentative_posting_label: buildTentativeScheduleLabel(publishWeek, publishDay),
    tentative_posting_date: resolveTentativePostingDate(
      anchorStartDate,
      publishWeek,
      publishDay
    ),
    planned_week: publishWeek,
    planned_day: publishDay,
    schedule_source: "campaign_plan",
  };
}

function isEarlierSchedule(
  candidate: QuotationTentativeScheduleFields,
  current: QuotationTentativeScheduleFields | undefined
): boolean {
  if (!current?.planned_week) return true;
  const candidateWeek = candidate.planned_week ?? Number.MAX_SAFE_INTEGER;
  const currentWeek = current.planned_week ?? Number.MAX_SAFE_INTEGER;
  if (candidateWeek !== currentWeek) return candidateWeek < currentWeek;
  const candidateDay = WEEKDAY_INDEX[(candidate.planned_day ?? "").toLowerCase()] ?? 99;
  const currentDay = WEEKDAY_INDEX[(current.planned_day ?? "").toLowerCase()] ?? 99;
  return candidateDay < currentDay;
}

function indexMediaPlanPlatforms(data: MediaPlanData): Map<string, string> {
  const map = new Map<string, string>();
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (!day.creator || !day.platform) continue;
      const key = `${normalizeCreatorScheduleKey(day.creator)}|${week.week}|${day.day}`;
      map.set(key, day.platform);
    }
  }
  return map;
}

/**
 * Extract tentative posting schedule entries from an approved Campaign Plan snapshot.
 * Uses Media Plan deadlines and Timeline duration/go-live hints for calendar anchoring.
 */
export function extractTentativeScheduleFromCampaignPlan(
  campaignObject: CampaignObject,
  options?: { anchorStartDate?: string | null; issueDate?: string | null }
): ScheduleByCreatorKey {
  const anchorStartDate = resolveCampaignPlanAnchorStartDate({
    anchorStartDate: options?.anchorStartDate,
    campaignObject,
    issueDate: options?.issueDate,
  });

  const mediaPlanContent = generateMediaPlan(campaignObject);
  const data = mediaPlanContent.data as MediaPlanData;
  const platformBySlot = indexMediaPlanPlatforms(data);
  const slate = resolveSlate(campaignObject);

  const bundlesByCreatorId = new Map<string, CreatorTentativeScheduleBundle>();

  for (const deadline of data.deadlines) {
    const displayKey = normalizeCreatorScheduleKey(deadline.creator);
    const slotKey = `${displayKey}|${deadline.publishWeek}|${deadline.publishDay}`;
    const platform = platformBySlot.get(slotKey);
    const fields = buildScheduleFields(
      deadline.publishWeek,
      deadline.publishDay,
      anchorStartDate
    );

    const slateMatch = slate.find(
      (entry) => normalizeCreatorScheduleKey(entry.displayName) === displayKey
    );
    const creatorIdKey = slateMatch
      ? normalizeCreatorScheduleKey(slateMatch.creatorId)
      : displayKey;

    let bundle = bundlesByCreatorId.get(creatorIdKey);
    if (!bundle) {
      bundle = { primary: fields, byPlatform: {} };
      bundlesByCreatorId.set(creatorIdKey, bundle);
    } else if (isEarlierSchedule(fields, bundle.primary)) {
      bundle.primary = fields;
    }

    if (platform) {
      const platformKey = canonicalPlatformKey(platform);
      const existing = bundle.byPlatform[platformKey];
      if (!existing || isEarlierSchedule(fields, existing)) {
        bundle.byPlatform[platformKey] = fields;
      }
    }
  }

  const scheduleByCreatorKey: ScheduleByCreatorKey = new Map();
  for (const entry of slate) {
    const idKey = normalizeCreatorScheduleKey(entry.creatorId);
    const bundle = bundlesByCreatorId.get(idKey);
    if (!bundle) continue;
    scheduleByCreatorKey.set(idKey, bundle);
    scheduleByCreatorKey.set(normalizeCreatorScheduleKey(entry.displayName), bundle);
  }

  for (const [creatorIdKey, bundle] of bundlesByCreatorId) {
    if (!scheduleByCreatorKey.has(creatorIdKey)) {
      scheduleByCreatorKey.set(creatorIdKey, bundle);
    }
  }

  return scheduleByCreatorKey;
}
