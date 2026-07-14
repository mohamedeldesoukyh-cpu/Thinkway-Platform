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
import type { SummarySectionData } from "@/features/campaign-intelligence/types/section-schemas";
import {
  briefRequiresOptionalCategories,
  detectBudgetSplitKeywords,
} from "@/features/campaign-director/services/budget-rules";

import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import { resolveSlate, type SlateCreator } from "../output-inputs";
import { parseAggregatedServiceLabel, normalizeCreatorMatchKey } from "../hydration/quotation-service-types";
import { formatMoney } from "./generator-utils";

export const MEDIA_PLAN_GENERATOR_VERSION = "3.3.5";

/** Shown beside campaign cost on media plan documents. */
export const MEDIA_PLAN_COST_VAT_DISCLAIMER = "Price excludes VAT.";

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
/** All seven days carry creator publishing in quotation-style calendars. */
const ALL_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
/** Legacy paid-media rhythm — only when brief explicitly requests amplification. */
const PAID_RHYTHM_CONTENT_INDEXES = [0, 1, 2, 4] as const;
/** Assets must be delivered this many days before the publish date. */
const ASSET_LEAD_DAYS = 3;
/** Production must start this many days before the publish date. */
const PRODUCTION_LEAD_DAYS = 7;

/** Monday on or after the given anchor date. */
function startOfCampaignWeek(anchor = new Date()): Date {
  const date = new Date(anchor);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  if (daysUntilMonday > 0) date.setDate(date.getDate() + daysUntilMonday);
  return date;
}

function resolveCampaignStartAnchor(facts: ReturnType<typeof getCampaignFacts>): Date {
  const iso = facts?.campaignStartDate?.trim();
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-").map((part) => Number(part));
    if (year && month && day) {
      return startOfCampaignWeek(new Date(year, month - 1, day, 12, 0, 0, 0));
    }
  }
  return startOfCampaignWeek();
}

/** d/M/yy — e.g. 1/7/26 */
export function formatShortCampaignDate(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function dateForSlot(start: Date, week: number, dayIndex: number): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + (week - 1) * 7 + dayIndex);
  return date;
}

export type MediaPlanDayType = "content" | "stories" | "boost" | "monitoring";

export type MediaPlanDay = {
  day: string;
  /** Short calendar date for this slot, e.g. 1/7/26 */
  dateLabel?: string;
  type: MediaPlanDayType;
  label: string;
  /** Slate creator id — used to match quotation commercial fields on enrich. */
  creatorId?: string;
  creator?: string;
  /** Truncated display name for calendar cells */
  shortName?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  /** Primary quotation ad type for this slot */
  serviceType?: string;
  /** All quoted ad types for this creator (shown on the card) */
  serviceTypes?: string[];
  tier?: string;
  platform?: string;
  /** Extra quoted deliverables packed onto the same calendar day within the campaign window. */
  additionalDeliverables?: MediaPlanAdditionalDeliverable[];
};

export type MediaPlanAdditionalDeliverable = {
  creatorId?: string;
  creator?: string;
  shortName?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  serviceType?: string;
  serviceTypes?: string[];
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
  creatorId?: string;
  shortName?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  /** Primary quoted ad type (legacy single-line rows). */
  serviceType?: string;
  /** All quoted ad types for this creator on the publish date. */
  serviceTypes?: string[];
  publishWeek: number;
  publishDay: string;
  productionStart: string;
  assetDelivery: string;
};

export type MediaPlanCampaignContext = {
  /** Legal entity (client) — distinct from brand. */
  clientName?: string;
  brandName?: string;
  groupName?: string;
  agencyName?: string;
  campaignCost?: { amount: number; currency: string };
};

/** Label for cover close page — brand with legal entity when both exist. */
export function formatMediaPlanPreparedForLabel(
  context: MediaPlanCampaignContext | undefined,
  fallbackTitle: string
): string {
  const brand = context?.brandName?.trim();
  const client = context?.clientName?.trim();
  if (brand && client) return `${brand} (${client})`;
  return brand || client || fallbackTitle;
}

export type MediaPlanData = {
  durationWeeks: number;
  /** Weeks rendered on the publishing calendar (may exceed brief duration to fit all deliverables). */
  calendarWeeks?: number;
  /** ISO date — Monday of week 1 */
  campaignStartDate: string;
  weeks: MediaPlanWeek[];
  waves: MediaPlanWave[];
  milestones: MediaPlanMilestone[];
  platformAllocation: Record<string, number>;
  dependencies: MediaPlanDependency[];
  deadlines: MediaPlanDeadline[];
  campaignContext?: MediaPlanCampaignContext;
  creatorCount: number;
  /** Quotation ad slots scheduled (one per type line). */
  postingSlotCount?: number;
  /** Quoted deliverables that did not fit on the weekly calendar grid. */
  unscheduledDeliverableCount?: number;
  /** Unique quotation ad / service types scheduled in the calendar */
  serviceTypes: string[];
  generatorVersion: string;
};

function normalizeCreatorId(id: string): string {
  return id.trim().toLowerCase();
}

type SlateCreatorLookup = {
  byId: Map<string, SlateCreator>;
  byHandle: Map<string, SlateCreator>;
  byName: Map<string, SlateCreator>;
};

function buildSlateCreatorLookup(slate: SlateCreator[]): SlateCreatorLookup {
  const byId = new Map<string, SlateCreator>();
  const byHandle = new Map<string, SlateCreator>();
  const byName = new Map<string, SlateCreator>();

  for (const creator of slate) {
    byId.set(normalizeCreatorId(creator.creatorId), creator);
    const handle = creator.handle?.replace(/^@/, "").trim().toLowerCase();
    if (handle) byHandle.set(handle, creator);
    const displayKey = normalizeCreatorMatchKey(creator.displayName);
    if (displayKey) byName.set(displayKey, creator);
    const shortKey = normalizeCreatorMatchKey(shortCreatorName(creator.displayName));
    if (shortKey) byName.set(shortKey, creator);
  }

  return { byId, byHandle, byName };
}

function findSlateCreatorInLookup(
  day: MediaPlanDay,
  lookup: SlateCreatorLookup,
  slate: SlateCreator[]
): SlateCreator | undefined {
  if (day.creatorId) {
    const byId = lookup.byId.get(normalizeCreatorId(day.creatorId));
    if (byId) return byId;
  }

  const dayHandle = day.handle?.replace(/^@/, "").trim().toLowerCase();
  if (dayHandle) {
    const byHandle = lookup.byHandle.get(dayHandle);
    if (byHandle) return byHandle;
  }

  for (const key of [
    normalizeCreatorMatchKey(day.creator ?? ""),
    normalizeCreatorMatchKey(day.shortName ?? ""),
  ]) {
    if (!key) continue;
    const byName = lookup.byName.get(key);
    if (byName) return byName;
    for (const [nameKey, creator] of lookup.byName) {
      if (nameKey.startsWith(key) || key.startsWith(nameKey)) return creator;
    }
  }

  return findSlateCreator(day, slate);
}

function findSlateCreator(day: MediaPlanDay, slate: SlateCreator[]): SlateCreator | undefined {
  if (day.creatorId) {
    const byId = slate.find((c) => normalizeCreatorId(c.creatorId) === normalizeCreatorId(day.creatorId!));
    if (byId) return byId;
  }

  const dayHandle = day.handle?.replace(/^@/, "").trim().toLowerCase();
  if (dayHandle) {
    const byHandle = slate.find(
      (c) => c.handle?.replace(/^@/, "").trim().toLowerCase() === dayHandle
    );
    if (byHandle) return byHandle;
  }

  const lookupKeys = [
    normalizeCreatorMatchKey(day.creator ?? ""),
    normalizeCreatorMatchKey(day.shortName ?? ""),
  ].filter(Boolean);

  for (const key of lookupKeys) {
    for (const creator of slate) {
      const display = normalizeCreatorMatchKey(creator.displayName);
      if (!key || !display) continue;
      if (key === display || display.startsWith(key) || key.startsWith(display)) return creator;
    }
  }

  return undefined;
}

/**
 * Patch a stored Media Plan with the live creator slate — avatars and quotation
 * ad types flow through even when the cached output predates a quotation sync.
 */
export function enrichMediaPlanFromSlate(data: MediaPlanData, slate: SlateCreator[]): MediaPlanData {
  if (!slate.length) return data;

  const lookup = buildSlateCreatorLookup(slate);

  const weeks = data.weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      const creator = findSlateCreatorInLookup(day, lookup, slate);
      if (!creator) return day;

      const platform = creator.platform ?? day.platform ?? "Instagram";
      const allTypes = serviceTypesForCreator(creator, platform);
      const shortName = day.shortName?.trim() || shortCreatorName(creator.displayName);

      return {
        ...day,
        creator: day.creator ?? creator.displayName,
        shortName,
        handle: day.handle ?? creator.handle,
        avatarUrl: creator.avatarUrl ?? day.avatarUrl,
        profileUrl: creator.profileUrl ?? day.profileUrl,
        serviceTypes: allTypes,
        serviceType: allTypes[0],
        tier: day.tier ?? creator.tier,
        platform: day.platform ?? creator.platform ?? platform,
        label:
          allTypes.length > 1
            ? `${shortName} — ${allTypes.join(", ")}`
            : `${shortName} — ${allTypes[0]}`,
      };
    }),
  }));

  const serviceTypes = [
    ...new Set(
      weeks
        .flatMap((week) =>
          week.days.flatMap((day) => day.serviceTypes ?? (day.serviceType ? [day.serviceType] : []))
        )
        .filter((type): type is string => Boolean(type?.trim()))
    ),
  ];

  const platforms = platformsFromSlate(slate, ["Instagram"]);
  const postingSlots = expandPostingSlots(slate, platforms);
  const quotationBacked = isQuotationBackedSlate(slate);
  const calendarSlots = quotationBacked ? data.durationWeeks * 7 : countCalendarContentSlots(data.weeks);

  return {
    ...data,
    weeks,
    serviceTypes,
    deadlines: enrichDeadlinesFromSlate(data.deadlines, slate),
    creatorCount: slate.length,
    postingSlotCount: postingSlots.length > 0 ? postingSlots.length : data.postingSlotCount,
    platformAllocation: buildPlatformAllocationFromPostingSlots(postingSlots),
    unscheduledDeliverableCount: computeUnscheduledDeliverableCount(
      postingSlots.length,
      calendarSlots
    ),
  };
}

function resolveCampaignCost(
  campaignObject: CampaignObject,
  slate: SlateCreator[]
): { amount: number; currency: string } | undefined {
  const facts = getCampaignFacts(campaignObject);
  if (facts?.budget && facts.budget.amount > 0) {
    return facts.budget;
  }

  const quotedTotal = slate.reduce((sum, creator) => sum + (creator.quotedRevenue ?? 0), 0);
  if (quotedTotal <= 0) return undefined;

  const currency =
    slate.find((creator) => creator.quotedCurrency?.trim())?.quotedCurrency?.trim() ??
    facts?.budget?.currency ??
    "EGP";

  return { amount: quotedTotal, currency };
}

export function resolveMediaPlanCampaignContext(
  campaignObject: CampaignObject,
  slate: SlateCreator[] = resolveSlate(campaignObject)
): MediaPlanCampaignContext {
  const facts = getCampaignFacts(campaignObject);
  const commercials = campaignObject.meta.quotationCommercials;
  const summaryContent = campaignObject.sections.summary?.content;
  const summary =
    summaryContent && typeof summaryContent === "object"
      ? (summaryContent as SummarySectionData)
      : undefined;

  const brandName = commercials?.brandName ?? facts?.brandName ?? summary?.brand;
  const clientName = commercials?.clientName ?? facts?.clientName ?? summary?.client;
  const groupName = commercials?.groupName;
  const agencyOrDirect = commercials?.agencyOrDirect;
  const agencyName =
    agencyOrDirect === "agency"
      ? commercials?.agencyName ?? facts?.clientName ?? summary?.client
      : undefined;

  return {
    clientName: clientName?.trim() || undefined,
    brandName: brandName?.trim() || undefined,
    groupName: groupName?.trim() || undefined,
    agencyName: agencyName?.trim() || undefined,
    campaignCost: resolveCampaignCost(campaignObject, slate),
  };
}

/** Merge live campaign context onto cached media plan data for preview/export. */
export function enrichMediaPlanCampaignContext(
  data: MediaPlanData,
  campaignObject: CampaignObject
): MediaPlanData {
  const fresh = resolveMediaPlanCampaignContext(campaignObject);
  const cached = data.campaignContext;
  const merged: MediaPlanCampaignContext = {
    clientName: fresh.clientName ?? cached?.clientName,
    brandName: fresh.brandName ?? cached?.brandName,
    groupName: fresh.groupName ?? cached?.groupName,
    agencyName: fresh.agencyName ?? cached?.agencyName,
    campaignCost: fresh.campaignCost ?? cached?.campaignCost,
  };

  if (
    !merged.clientName &&
    !merged.brandName &&
    !merged.groupName &&
    !merged.agencyName &&
    !merged.campaignCost
  ) {
    return data;
  }

  return { ...data, campaignContext: merged };
}

function deadlineTypes(deadline: MediaPlanDeadline): string[] {
  if (deadline.serviceTypes?.length) return deadline.serviceTypes;
  return deadline.serviceType?.trim() ? [deadline.serviceType] : [];
}

/** One row per creator per publish slot — merge duplicate lines into a single deliverables list. */
export function consolidateMediaPlanDeadlines(deadlines: MediaPlanDeadline[]): MediaPlanDeadline[] {
  const byKey = new Map<string, MediaPlanDeadline>();
  for (const deadline of deadlines) {
    const key = `${deadline.creatorId ?? deadline.creator}|${deadline.publishWeek}|${deadline.publishDay}`;
    const existing = byKey.get(key);
    if (!existing) {
      const types = deadlineTypes(deadline);
      byKey.set(key, {
        ...deadline,
        serviceTypes: types.length ? types : undefined,
        serviceType: types[0],
      });
      continue;
    }
    const mergedTypes = [...new Set([...deadlineTypes(existing), ...deadlineTypes(deadline)])];
    existing.serviceTypes = mergedTypes;
    existing.serviceType = mergedTypes[0];
  }
  return [...byKey.values()];
}

function enrichDeadlinesFromSlate(
  deadlines: MediaPlanDeadline[],
  slate: SlateCreator[]
): MediaPlanDeadline[] {
  if (!slate.length) return consolidateMediaPlanDeadlines(deadlines);
  const enriched = deadlines.map((deadline) => {
    const dayLike: MediaPlanDay = {
      day: deadline.publishDay,
      type: "content",
      label: deadline.creator,
      creator: deadline.creator,
      creatorId: deadline.creatorId,
      shortName: deadline.shortName,
      handle: deadline.handle,
      avatarUrl: deadline.avatarUrl,
      profileUrl: deadline.profileUrl,
    };
    const creator = findSlateCreator(dayLike, slate);
    if (!creator) return deadline;
    const platform = creator.platform ?? "Instagram";
    const types = deadlineTypes(deadline);
    const slateTypes = serviceTypesForCreator(creator, platform);
    return {
      ...deadline,
      creatorId: deadline.creatorId ?? creator.creatorId,
      shortName: deadline.shortName ?? shortCreatorName(creator.displayName),
      handle: deadline.handle ?? creator.handle,
      avatarUrl: creator.avatarUrl ?? deadline.avatarUrl,
      profileUrl: creator.profileUrl ?? deadline.profileUrl,
      serviceTypes: types.length ? types : slateTypes,
      serviceType: types[0] ?? slateTypes[0],
    };
  });
  return consolidateMediaPlanDeadlines(enriched);
}

function briefTextForMediaPlan(campaignObject: CampaignObject): string {
  const facts = getCampaignFacts(campaignObject);
  const strategy =
    typeof campaignObject.sections.strategy?.content === "string"
      ? campaignObject.sections.strategy.content
      : "";
  return [facts?.rawBriefExcerpt, facts?.objective, strategy].filter(Boolean).join("\n");
}

export function isQuotationBackedSlate(slate: SlateCreator[]): boolean {
  return slate.some(
    (creator) =>
      (creator.serviceTypes?.length ?? 0) > 0 ||
      (creator.quotedRevenue ?? 0) > 0 ||
      Boolean(creator.serviceLabel?.trim())
  );
}

/** Paid amplification appears only when the brief asks for it — quotation campaigns default to creator fees only. */
export function wantsPaidAmplification(campaignObject: CampaignObject, slate: SlateCreator[]): boolean {
  if (isQuotationBackedSlate(slate)) return false;
  const facts = getCampaignFacts(campaignObject);
  const briefText = briefTextForMediaPlan(campaignObject);
  if (!briefRequiresOptionalCategories(briefText, facts)) return false;
  return detectBudgetSplitKeywords(briefText, facts).some((entry) =>
    /paid|boost/i.test(entry.keyword)
  );
}

function useQuotationStyleCalendar(campaignObject: CampaignObject, slate: SlateCreator[]): boolean {
  return slate.length > 0 && (isQuotationBackedSlate(slate) || !wantsPaidAmplification(campaignObject, slate));
}

function shortCreatorName(name: string): string {
  const at = name.indexOf(" (@");
  if (at > 0) return name.slice(0, at).trim();
  const dot = name.indexOf(" • ");
  if (dot > 0) return name.slice(0, dot).trim();
  return name.length > 26 ? `${name.slice(0, 23)}…` : name;
}

function serviceTypeForCreator(creator: SlateCreator, platform: string): string {
  const format = tierRank(creator.tier) <= 1 ? "Reel" : "Post";
  return `1× ${platform} ${format}`;
}

function serviceTypesForCreator(creator: SlateCreator, platform: string): string[] {
  if (creator.serviceTypes?.length) return creator.serviceTypes;
  if (creator.serviceLabel?.trim()) {
    const parsed = parseAggregatedServiceLabel(creator.serviceLabel);
    if (parsed.length) return parsed;
  }
  return [serviceTypeForCreator(creator, platform)];
}

function platformForServiceType(serviceType: string, fallback: string): string {
  const lower = serviceType.toLowerCase();
  if (/\btt\b|tiktok|mirrored tt/.test(lower)) return "TikTok";
  if (/\bfb\b|facebook|mirrored fb/.test(lower)) return "Facebook";
  if (/\byt\b|youtube|mirrored yt/.test(lower)) return "YouTube";
  if (/\big\b|instagram|mirrored ig/.test(lower)) return "Instagram";
  return fallback;
}

type MediaPlanPostingSlot = {
  creator: SlateCreator;
  serviceType: string;
  platform: string;
};

function expandPostingSlots(slate: SlateCreator[], platforms: string[]): MediaPlanPostingSlot[] {
  const fallbackPlatform = platforms[0] ?? "Instagram";
  const slots: MediaPlanPostingSlot[] = [];
  for (const creator of slate) {
    const basePlatform = creator.platform ?? fallbackPlatform;
    for (const serviceType of serviceTypesForCreator(creator, basePlatform)) {
      slots.push({
        creator,
        serviceType,
        platform: platformForServiceType(serviceType, basePlatform),
      });
    }
  }
  return slots;
}

function platformsFromSlate(slate: SlateCreator[], fallback: string[]): string[] {
  const fromSlate = [
    ...new Set(
      slate
        .map((creator) => creator.platform?.trim())
        .filter((platform): platform is string => Boolean(platform))
    ),
  ];
  return fromSlate.length ? fromSlate : fallback;
}

/** Platform totals from quoted deliverables — not calendar cell counts. */
export function buildPlatformAllocationFromPostingSlots(
  postingSlots: MediaPlanPostingSlot[]
): Record<string, number> {
  const allocation: Record<string, number> = {};
  for (const slot of postingSlots) {
    allocation[slot.platform] = (allocation[slot.platform] ?? 0) + 1;
  }
  return allocation;
}

function countCalendarContentSlots(weeks: MediaPlanWeek[]): number {
  return weeks.reduce(
    (total, week) =>
      total + week.days.filter((day) => day.type === "content" || day.type === "stories" || day.type === "boost").length,
    0
  );
}

function computeUnscheduledDeliverableCount(
  postingSlotCount: number,
  calendarContentSlots: number
): number | undefined {
  const unscheduled = postingSlotCount - calendarContentSlots;
  return unscheduled > 0 ? unscheduled : undefined;
}

function calendarContentCapacity(
  calendarWeeks: number,
  quotationCalendar: boolean,
  includePaidRhythm: boolean
): number {
  if (quotationCalendar) return calendarWeeks * 7;
  const contentDaysPerWeek = (PAID_RHYTHM_CONTENT_INDEXES as readonly number[]).length;
  const rhythmDays = contentDaysPerWeek + (includePaidRhythm ? 2 : 0);
  return calendarWeeks * rhythmDays;
}

/** Calendar always follows the campaign brief duration — deliverables pack onto days instead. */
export function resolveCalendarWeekCount(input: {
  durationWeeks: number;
  postingSlotCount: number;
  quotationCalendar: boolean;
}): number {
  return input.durationWeeks;
}

/** Assign each creator to one calendar day — all their quoted ad types stay on that day. */
export function distributeCreatorsAcrossDays(
  slate: SlateCreator[],
  totalDays: number
): SlateCreator[][] {
  const buckets: SlateCreator[][] = Array.from({ length: totalDays }, () => []);
  if (totalDays <= 0) return buckets;
  for (let index = 0; index < slate.length; index += 1) {
    buckets[index % totalDays]!.push(slate[index]!);
  }
  return buckets;
}

function countScheduledDeliverables(weeks: MediaPlanWeek[]): number {
  return weeks.reduce(
    (total, week) =>
      total +
      week.days.reduce((dayTotal, day) => {
        if (day.type !== "content" && day.type !== "stories" && day.type !== "boost") {
          return dayTotal;
        }
        const primary = day.creatorId || day.creator ? 1 : 0;
        const additional = day.additionalDeliverables?.length ?? 0;
        return dayTotal + primary + additional;
      }, 0),
    0
  );
}

function creatorDayFields(creator: SlateCreator, platform: string, serviceType?: string) {
  const resolvedType = serviceType?.trim() || serviceTypeForCreator(creator, platform);
  return {
    creatorId: creator.creatorId,
    creator: creator.displayName,
    shortName: shortCreatorName(creator.displayName),
    handle: creator.handle,
    avatarUrl: creator.avatarUrl,
    profileUrl: creator.profileUrl,
    serviceType: resolvedType,
    tier: creator.tier,
    platform: platformForServiceType(resolvedType, creator.platform ?? platform),
  };
}

function buildCreatorDay(
  day: (typeof DAYS)[number],
  dateLabel: string,
  type: MediaPlanDayType,
  creator: SlateCreator,
  platform: string
): MediaPlanDay {
  const allTypes = serviceTypesForCreator(creator, platform);
  const fields = creatorDayFields(creator, platform, allTypes[0]);
  return {
    day,
    dateLabel,
    type,
    serviceTypes: allTypes,
    label:
      allTypes.length > 1
        ? `${fields.shortName} — ${allTypes.join(", ")}`
        : `${fields.shortName} — ${fields.serviceType}`,
    ...fields,
  };
}

function buildCreatorDayFromPostingSlot(
  day: (typeof DAYS)[number],
  dateLabel: string,
  type: MediaPlanDayType,
  slot: MediaPlanPostingSlot
): MediaPlanDay {
  const fields = creatorDayFields(slot.creator, slot.platform, slot.serviceType);
  return {
    day,
    dateLabel,
    type,
    serviceTypes: [slot.serviceType],
    label: `${fields.shortName} — ${slot.serviceType}`,
    ...fields,
  };
}

function additionalDeliverableFromCreator(
  creator: SlateCreator,
  platforms: string[]
): MediaPlanAdditionalDeliverable {
  const platform = creator.platform ?? platforms[0] ?? "Instagram";
  const allTypes = serviceTypesForCreator(creator, platform);
  const fields = creatorDayFields(creator, platform, allTypes[0]);
  return {
    creatorId: fields.creatorId,
    creator: fields.creator,
    shortName: fields.shortName,
    handle: fields.handle,
    avatarUrl: fields.avatarUrl,
    profileUrl: fields.profileUrl,
    serviceType: fields.serviceType,
    serviceTypes: allTypes,
    platform: fields.platform,
  };
}

function buildDayFromCreators(
  day: (typeof DAYS)[number],
  dateLabel: string,
  creators: SlateCreator[],
  platforms: string[],
  week: number,
  dayIndex: number,
  deadlines: MediaPlanDeadline[]
): MediaPlanDay {
  if (!creators.length) {
    return {
      day,
      dateLabel,
      type: "monitoring",
      label: "Open publishing slot",
      serviceType: "—",
    };
  }

  const [primary, ...additional] = creators;
  const primaryPlatform = primary!.platform ?? platforms[0] ?? "Instagram";
  const primaryDay = buildCreatorDay(day, dateLabel, "content", primary!, primaryPlatform);

  for (const creator of creators) {
    const platform = creator.platform ?? platforms[0] ?? "Instagram";
    const types = serviceTypesForCreator(creator, platform);
    const fields = creatorDayFields(creator, platform, types[0]);
    deadlines.push({
      creator: creator.displayName,
      creatorId: fields.creatorId,
      shortName: fields.shortName,
      handle: fields.handle,
      avatarUrl: fields.avatarUrl,
      profileUrl: fields.profileUrl,
      serviceTypes: types,
      serviceType: types[0],
      publishWeek: week,
      publishDay: day,
      productionStart: leadDate(week, dayIndex, PRODUCTION_LEAD_DAYS),
      assetDelivery: leadDate(week, dayIndex, ASSET_LEAD_DAYS),
    });
  }

  if (!additional.length) return primaryDay;

  return {
    ...primaryDay,
    additionalDeliverables: additional.map((creator) =>
      additionalDeliverableFromCreator(creator, platforms)
    ),
    label:
      additional.length > 0
        ? `${primaryDay.shortName ?? primaryDay.creator} +${additional.length} creator${additional.length === 1 ? "" : "s"}`
        : primaryDay.label,
  };
}
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
  const postingSlots = expandPostingSlots(slate, platforms);
  const quotationCalendar = useQuotationStyleCalendar(campaignObject, slate);
  const includePaidRhythm = !quotationCalendar && wantsPaidAmplification(campaignObject, slate);
  const calendarWeekCount = resolveCalendarWeekCount({
    durationWeeks,
    postingSlotCount: postingSlots.length,
    quotationCalendar,
  });
  const waveCount = durationWeeks >= 6 ? 3 : durationWeeks >= 3 ? 2 : 1;
  const campaignStart = resolveCampaignStartAnchor(facts);
  const quotationCreatorsByDay =
    quotationCalendar && slate.length > 0
      ? distributeCreatorsAcrossDays(slate, calendarWeekCount * 7)
      : null;

  const deadlines: MediaPlanDeadline[] = [];
  let contentSlotCursor = 0;
  let postingSlotCursor = 0;
  let absoluteDayIndex = 0;

  const weeks: MediaPlanWeek[] = [];
  for (let week = 1; week <= calendarWeekCount; week += 1) {
    const wave = waveForWeek(week, calendarWeekCount, waveCount);
    const phase = phaseForWeek(week, calendarWeekCount);
    const days: MediaPlanDay[] = DAYS.map((day, index) => {
      const dateLabel = formatShortCampaignDate(dateForSlot(campaignStart, week, index));

      if (quotationCalendar && quotationCreatorsByDay) {
        const dayCreators = quotationCreatorsByDay[absoluteDayIndex] ?? [];
        absoluteDayIndex += 1;
        return buildDayFromCreators(day, dateLabel, dayCreators, platforms, week, index, deadlines);
      }

      const schedulePostingSlot = (type: MediaPlanDayType = "content"): MediaPlanDay => {
        if (!postingSlots.length || postingSlotCursor >= postingSlots.length) {
          return {
            day,
            dateLabel,
            type: "monitoring",
            label: "Open publishing slot",
            serviceType: "—",
          };
        }

        const slot = postingSlots[postingSlotCursor]!;
        postingSlotCursor += 1;

        if (type === "content") {
          const fields = creatorDayFields(slot.creator, slot.platform, slot.serviceType);
          deadlines.push({
            creator: slot.creator.displayName,
            creatorId: fields.creatorId,
            shortName: fields.shortName,
            handle: fields.handle,
            avatarUrl: fields.avatarUrl,
            profileUrl: fields.profileUrl,
            serviceTypes: [slot.serviceType],
            serviceType: slot.serviceType,
            publishWeek: week,
            publishDay: day,
            productionStart: leadDate(week, index, PRODUCTION_LEAD_DAYS),
            assetDelivery: leadDate(week, index, ASSET_LEAD_DAYS),
          });
        }

        return buildCreatorDayFromPostingSlot(day, dateLabel, type, slot);
      };

      const scheduleCreator = (type: MediaPlanDayType = "content"): MediaPlanDay => {
        const slotIndex = contentSlotCursor;
        const creator = slate.length ? slate[slotIndex % slate.length] : undefined;
        contentSlotCursor += 1;
        if (!creator) {
          return { day, dateLabel, type, label: "Creator publishing slot" };
        }
        const platform = creator.platform ?? platforms[slotIndex % platforms.length]!;
        if (type === "content") {
          const types = serviceTypesForCreator(creator, platform);
          const fields = creatorDayFields(creator, platform, types[0]);
          deadlines.push({
            creator: creator.displayName,
            creatorId: fields.creatorId,
            shortName: fields.shortName,
            handle: fields.handle,
            avatarUrl: fields.avatarUrl,
            profileUrl: fields.profileUrl,
            serviceTypes: types,
            serviceType: types[0],
            publishWeek: week,
            publishDay: day,
            productionStart: leadDate(week, index, PRODUCTION_LEAD_DAYS),
            assetDelivery: leadDate(week, index, ASSET_LEAD_DAYS),
          });
        }
        return buildCreatorDay(day, dateLabel, type, creator, platform);
      };

      if ((PAID_RHYTHM_CONTENT_INDEXES as readonly number[]).includes(index)) {
        return postingSlots.length ? schedulePostingSlot("content") : scheduleCreator("content");
      }
      if (includePaidRhythm && index === 3) {
        return postingSlots.length ? schedulePostingSlot("stories") : scheduleCreator("stories");
      }
      if (includePaidRhythm && index === 5) {
        return postingSlots.length ? schedulePostingSlot("boost") : scheduleCreator("boost");
      }
      if (index === 6) {
        return { day, dateLabel, type: "monitoring", label: "Performance review", serviceType: "Reporting" };
      }
      return { day, dateLabel, type: "monitoring", label: "Performance review", serviceType: "Reporting" };
    });
    weeks.push({ week, wave, phase, days });
  }

  const platformAllocation = buildPlatformAllocationFromPostingSlots(postingSlots);
  const scheduledCreators = countScheduledDeliverables(weeks);
  const unscheduledDeliverableCount =
    slate.length > scheduledCreators
      ? slate.length - scheduledCreators
      : undefined;

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
    if (includePaidRhythm) {
      milestones.push({
        type: "amplification",
        week: week.week,
        label: `Paid amplification window (Saturday boost, Week ${week.week})`,
      });
    }
  }
  if (durationWeeks >= 3) {
    const midpoint = Math.ceil(durationWeeks / 2);
    milestones.push({ type: "client_approval", week: midpoint, label: "Mid-campaign client checkpoint" });
    if (includePaidRhythm) {
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
    } else {
      milestones.push({
        type: "optimization",
        week: durationWeeks,
        label: "Campaign reporting & performance wrap-up",
      });
    }
  }

  const packedCreatorsPerDay =
    quotationCalendar && slate.length > 0
      ? Math.ceil(slate.length / (calendarWeekCount * 7))
      : undefined;

  const data: MediaPlanData = {
    durationWeeks,
    campaignStartDate: campaignStart.toISOString().slice(0, 10),
    weeks,
    waves,
    milestones,
    platformAllocation,
    dependencies,
    deadlines: consolidateMediaPlanDeadlines(deadlines),
    campaignContext: resolveMediaPlanCampaignContext(campaignObject, slate),
    creatorCount: slate.length,
    postingSlotCount: postingSlots.length > 0 ? postingSlots.length : undefined,
    unscheduledDeliverableCount,
    serviceTypes: [
      ...new Set(
        weeks
          .flatMap((w) =>
            w.days.flatMap((d) => d.serviceTypes ?? (d.serviceType ? [d.serviceType] : []))
          )
          .filter((label): label is string => Boolean(label?.trim()))
      ),
    ],
    generatorVersion: MEDIA_PLAN_GENERATOR_VERSION,
  };

  return {
    title: "Media Plan",
    summary: quotationCalendar
      ? `${durationWeeks}-week quotation calendar — ${postingSlots.length} quoted ad slot${postingSlots.length === 1 ? "" : "s"} across ${slate.length} creator${slate.length === 1 ? "" : "s"}${
          packedCreatorsPerDay && packedCreatorsPerDay > 1
            ? ` (up to ${packedCreatorsPerDay} creators per day)`
            : ""
        }.`
      : `${durationWeeks}-week client-approval-ready publishing plan across ${slate.length} creator${slate.length === 1 ? "" : "s"} and ${platforms.length} platform${platforms.length === 1 ? "" : "s"}, organized into ${waveCount} wave${waveCount === 1 ? "" : "s"}.`,
    sections: buildSections(data),
    data: data as unknown as Record<string, unknown>,
  };
}

function buildSections(data: MediaPlanData): CampaignOutputContentSection[] {
  const sections: CampaignOutputContentSection[] = [];

  if (data.campaignContext?.campaignCost) {
    const { amount, currency } = data.campaignContext.campaignCost;
    sections.push({
      heading: "Campaign Cost",
      items: [
        `${formatMoney(amount, currency)} — ${MEDIA_PLAN_COST_VAT_DISCLAIMER}`,
      ],
    });
  }

  sections.push({
    heading: "Activation Waves",
    items: data.waves.map((wave) => `Wave ${wave.wave} — ${wave.theme} (weeks ${wave.weeks.join(", ")})`),
  });

  for (const week of data.weeks) {
    sections.push({
      heading: `Week ${week.week} — ${week.phase} (Wave ${week.wave})`,
      items: week.days.map(
        (day) =>
          `${day.day}${day.dateLabel ? ` (${day.dateLabel})` : ""}: ${day.shortName ?? day.label}${
            day.serviceType ? ` · ${day.serviceType}` : day.platform ? ` · ${day.platform}` : ""
          }`
      ),
    });
  }

  const allocationEntries = Object.entries(data.platformAllocation);
  if (allocationEntries.length) {
    const deliverableLabel =
      (data.postingSlotCount ?? 0) > 0 ? "quoted deliverables" : "scheduled posts";
    const items = allocationEntries.map(
      ([platform, count]) => `${platform}: ${count} ${deliverableLabel}`
    );
    if (data.unscheduledDeliverableCount) {
      items.push(
        `${data.unscheduledDeliverableCount} quoted deliverable${data.unscheduledDeliverableCount === 1 ? "" : "s"} could not be placed on the calendar — regenerate the Media Plan.`
      );
    }
    sections.push({
      heading: "Platform Allocation",
      items,
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
        columns: ["Creator", "Deliverables", "Publish", "Production starts", "Assets due"],
        rows: data.deadlines.map((d) => [
          d.creator,
          deadlineTypes(d).join(" · "),
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
