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
import { resolveMediaPlanWeekWeights } from "../brief-media-plan-schedule";
import { buildMediaPlanStrategySummary, refreshMediaPlanStrategySummaryForDisplay, type MediaPlanStrategySummary } from "../media-plan-strategy-summary";
import { mediaPlanScheduleFromMeta } from "../media-plan-schedule";
import {
  buildMarketSchedulingContext,
  resolveMarketIntelligenceConfig,
} from "@/features/market-intelligence";
import {
  distributeDeliverablesToDays,
  expandSchedulableDeliverables,
  countSchedulableActivations,
  type ScheduledDeliverablePlacement,
  type SchedulableDeliverable,
} from "../media-plan-scheduler";
import { formatActivationServiceLabel } from "../media-plan-deliverable-classification";
import { resolveBriefTextForScheduling } from "../brief-media-plan-schedule";
import { hasCampaignBriefText } from "../brief-media-plan-schedule";
import {
  applyWeekPhasesFromCalendar,
  buildActivationWavesFromCalendar,
  buildBriefObjectiveSummary,
  buildCampaignOverviewFromQuotation,
  buildMilestonesFromSchedule,
  buildPlatformAllocationFromQuotation,
  formatLeadDateLabel,
  resolveMediaPlanDocumentMode,
  type MediaPlanDocumentMode,
} from "../media-plan-operations";
import { expandRawSchedulableDeliverables } from "../media-plan-scheduler";
import { canonicalPlatformLabel, mergePlatformAllocation } from "../platform-allocation";
import {
  PUBLISHING_CALENDAR_DAYS,
  parseIsoCampaignDate,
  resolveBusinessCampaignEndIso,
  resolvePublishingCalendarRange,
  resolveScheduledStartDate,
  startOfPublishingWeek,
  toIsoCampaignDate,
} from "@/features/campaign-outputs/media-plan-week-start";
import {
  enforceMediaPlanCampaignWindow,
  resolveCampaignWindowFromMediaPlan,
} from "@/features/campaign-outputs/media-plan-campaign-window";
import { formatMoney } from "./generator-utils";

export const MEDIA_PLAN_GENERATOR_VERSION = "3.9.0";

/** Shown beside campaign cost on media plan documents. */
export const MEDIA_PLAN_COST_VAT_DISCLAIMER = "Price excludes VAT.";
export const MEDIA_PLAN_USAGE_RIGHTS_DISCLAIMER =
  "Usage rights are not included in quoted prices and are granted upon request.";
/** Combined pricing footnote for media plan previews and exports. */
export const MEDIA_PLAN_PRICING_DISCLAIMER = `${MEDIA_PLAN_COST_VAT_DISCLAIMER} ${MEDIA_PLAN_USAGE_RIGHTS_DISCLAIMER}`;

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
/** Publishing Calendar columns — Saturday→Friday (SSOT). */
const DAYS = PUBLISHING_CALENDAR_DAYS;
/** All seven days carry creator publishing in quotation-style calendars. */
const ALL_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
/**
 * Legacy paid-media rhythm on Sat–Fri columns:
 * Mon/Tue/Wed/Fri content (indexes 2,3,4,6); Thu stories (5); Sat boost (0); Sun monitor (1).
 */
const PAID_RHYTHM_CONTENT_INDEXES = [2, 3, 4, 6] as const;
const PAID_RHYTHM_STORIES_INDEX = 5;
const PAID_RHYTHM_BOOST_INDEX = 0;
const PAID_RHYTHM_MONITOR_INDEX = 1;
/** Assets must be delivered this many days before the publish date. */
const ASSET_LEAD_DAYS = 3;
/** Production must start this many days before the publish date. */
const PRODUCTION_LEAD_DAYS = 7;

function resolveRequestedStartIso(facts: ReturnType<typeof getCampaignFacts>): string | null {
  const iso =
    facts?.requestedStartDate?.trim() ||
    facts?.campaignStartDate?.trim() ||
    null;
  return iso && parseIsoCampaignDate(iso) ? iso : null;
}

/**
 * Publishing Calendar grid anchor: Saturday of the week containing the campaign start.
 * Business start remains `requestedIso` (may be mid-week).
 */
function resolveCampaignStartAnchor(facts: ReturnType<typeof getCampaignFacts>): {
  requestedIso: string | null;
  scheduled: Date;
  scheduledIso: string;
} {
  const requestedIso = resolveRequestedStartIso(facts);
  if (requestedIso) {
    const scheduledIso = resolveScheduledStartDate(requestedIso) ?? requestedIso;
    const scheduled = parseIsoCampaignDate(scheduledIso) ?? startOfPublishingWeek();
    return {
      requestedIso,
      scheduled,
      scheduledIso,
    };
  }
  const scheduled = startOfPublishingWeek();
  return {
    requestedIso: null,
    scheduled,
    scheduledIso: toIsoCampaignDate(scheduled),
  };
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
  tier?: string;
  platform?: string;
  /** True when this line is a mirrored cross-post on the same activation day. */
  isMirror?: boolean;
  /** True when this line is a story/support companion on the same activation day. */
  isCompanion?: boolean;
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
  /** Unique creators scheduled in this wave. */
  creatorCount?: number;
  /** Primary activations in this wave. */
  activationCount?: number;
};

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
  /** Business duration fact (weeks) — does not redefine calendar week boundaries. */
  durationWeeks: number;
  /** Count of Saturday–Friday weeks rendered on the Publishing Calendar. */
  calendarWeeks?: number;
  /**
   * ISO date — Saturday that opens Publishing Calendar Week 1
   * (Saturday of the week containing the campaign start).
   */
  campaignStartDate: string;
  /** ISO date — user-requested / business campaign start (may be mid-week). */
  requestedStartDate?: string;
  /** ISO date — Saturday grid anchor; same as {@link campaignStartDate}. */
  scheduledStartDate?: string;
  /** ISO date — inclusive business campaign end (may be mid-week). */
  campaignEndDate?: string;
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
  /** Client-facing strategy summary for document preview and exports. */
  strategySummary?: MediaPlanStrategySummary;
  /** Planning = quotation only; strategy = brief + quotation. */
  planMode?: MediaPlanDocumentMode;
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

  function enrichCalendarEntry<
    T extends {
      creatorId?: string;
      creator?: string;
      shortName?: string;
      handle?: string;
      avatarUrl?: string;
      profileUrl?: string;
      tier?: string;
      platform?: string;
      serviceType?: string;
      serviceTypes?: string[];
    },
  >(entry: T, fallbackPlatform?: string): T {
    const creator = findSlateCreatorInLookup(entry as unknown as MediaPlanDay, lookup, slate);
    if (!creator) return entry;

    const platform = creator.platform ?? entry.platform ?? fallbackPlatform ?? "Instagram";
    const allTypes = serviceTypesForCreator(creator, platform);
    const shortName = entry.shortName?.trim() || shortCreatorName(creator.displayName);

    return {
      ...entry,
      creator: entry.creator ?? creator.displayName,
      shortName,
      handle: entry.handle ?? creator.handle,
      avatarUrl: creator.avatarUrl ?? entry.avatarUrl,
      profileUrl: creator.profileUrl ?? entry.profileUrl,
      serviceTypes: allTypes.length ? allTypes : entry.serviceTypes,
      serviceType: allTypes[0] ?? entry.serviceType,
      tier: entry.tier ?? creator.tier,
      platform: entry.platform ?? creator.platform ?? platform,
    };
  }

  const weeks = data.weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      const creator = findSlateCreatorInLookup(day, lookup, slate);
      const platform = creator?.platform ?? day.platform ?? "Instagram";
      const enrichedDay = enrichCalendarEntry(day, platform);
      const allTypes =
        enrichedDay.serviceTypes ??
        (enrichedDay.serviceType ? [enrichedDay.serviceType] : serviceTypesForCreator(creator ?? { creatorId: "", displayName: "" }, platform));
      const shortName = enrichedDay.shortName?.trim() || shortCreatorName(enrichedDay.creator ?? "");

      return {
        ...enrichedDay,
        label:
          creator && allTypes.length
            ? allTypes.length > 1
              ? `${shortName} — ${allTypes.join(", ")}`
              : `${shortName} — ${allTypes[0]}`
            : day.label,
        additionalDeliverables: day.additionalDeliverables?.map((extra) =>
          enrichCalendarEntry(extra, platform)
        ),
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

  const platforms = platformsFromSlate(slate, data.platformAllocation ? Object.keys(data.platformAllocation) : ["Instagram"]);
  const activationCount = activationCountForSlate(slate, platforms);
  const platformAllocation = buildPlatformAllocationFromQuotation(slate, platforms, expandRawSchedulableDeliverables);

  const rebuiltDeadlines = data.campaignStartDate
    ? rebuildMediaPlanDeadlinesFromWeeks(weeks, data.campaignStartDate)
    : data.deadlines;

  return {
    ...data,
    weeks,
    serviceTypes,
    deadlines: enrichDeadlinesFromSlate(rebuiltDeadlines, slate),
    creatorCount: slate.length,
    postingSlotCount: activationCount > 0 ? activationCount : data.postingSlotCount,
    platformAllocation,
    unscheduledDeliverableCount: computeUnscheduledDeliverableCount(
      activationCount,
      countScheduledDeliverables(weeks)
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

type DeadlineCalendarEntry = {
  creatorId?: string;
  creator?: string;
  shortName?: string;
  handle?: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  serviceType?: string;
  serviceTypes?: string[];
};

function entryServiceTypes(entry: DeadlineCalendarEntry): string[] {
  if (entry.serviceTypes?.length) return entry.serviceTypes.filter((type) => type.trim());
  return entry.serviceType?.trim() ? [entry.serviceType] : [];
}

/**
 * Rebuild asset/production deadlines from the live publishing calendar so schedule
 * moves never leave the deadlines table on stale publish dates.
 */
export function rebuildMediaPlanDeadlinesFromWeeks(
  weeks: MediaPlanWeek[],
  campaignStartIso: string
): MediaPlanDeadline[] {
  const rows: MediaPlanDeadline[] = [];

  for (const week of weeks) {
    week.days.forEach((day, dayIndex) => {
      const publishDay = day.day?.trim() || DAYS[dayIndex] || "Monday";

      const pushEntry = (entry: DeadlineCalendarEntry) => {
        const creator = entry.creator?.trim();
        if (!creator && !entry.creatorId) return;
        const types = entryServiceTypes(entry);
        rows.push({
          creator: creator || entry.shortName || "Creator",
          creatorId: entry.creatorId,
          shortName: entry.shortName,
          handle: entry.handle,
          avatarUrl: entry.avatarUrl ?? undefined,
          profileUrl: entry.profileUrl ?? undefined,
          serviceTypes: types.length ? types : undefined,
          serviceType: types[0],
          publishWeek: week.week,
          publishDay,
          productionStart: formatLeadDateLabel(
            campaignStartIso,
            week.week,
            publishDay,
            PRODUCTION_LEAD_DAYS
          ),
          assetDelivery: formatLeadDateLabel(
            campaignStartIso,
            week.week,
            publishDay,
            ASSET_LEAD_DAYS
          ),
        });
      };

      if (day.creator || day.creatorId) {
        pushEntry(day);
      }

      for (const extra of day.additionalDeliverables ?? []) {
        if (extra.isMirror || extra.isCompanion) continue;
        pushEntry(extra);
      }
    });
  }

  return consolidateMediaPlanDeadlines(rows);
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
  return expandSchedulableDeliverables(slate, platforms).map((deliverable) => ({
    creator: deliverable.creator,
    serviceType: deliverable.serviceType,
    platform: deliverable.platform,
  }));
}

function activationCountForSlate(slate: SlateCreator[], platforms: string[]): number {
  return countSchedulableActivations(slate, platforms);
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
    const label = canonicalPlatformLabel(slot.platform);
    allocation[label] = (allocation[label] ?? 0) + 1;
  }
  return mergePlatformAllocation(allocation);
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

/**
 * Publishing Calendar week count from the overlapping Saturday–Friday range.
 * Falls back to durationWeeks only when a date range cannot be resolved.
 */
export function resolveCalendarWeekCount(input: {
  durationWeeks: number;
  postingSlotCount: number;
  quotationCalendar: boolean;
  campaignStartIso?: string | null;
  campaignEndIso?: string | null;
}): number {
  const startIso = input.campaignStartIso?.trim();
  if (startIso) {
    const endIso =
      input.campaignEndIso?.trim() ||
      resolveBusinessCampaignEndIso({
        campaignStartIso: startIso,
        durationWeeks: input.durationWeeks,
      });
    if (endIso) {
      const range = resolvePublishingCalendarRange(startIso, endIso);
      if (range?.weeks.length) return range.weeks.length;
    }
  }
  return Math.max(1, input.durationWeeks);
}

/** True when a calendar day has no scheduled creator content (blank day — client-facing). */
export function isMediaPlanOpenPublishingSlot(day: MediaPlanDay): boolean {
  return (
    !day.creator &&
    !day.creatorId &&
    !(day.additionalDeliverables?.length) &&
    (day.label === "Open publishing slot" ||
      day.label === "Creator publishing slot" ||
      !day.label?.trim())
  );
}

/** Blank calendar cell — no filler copy; empty days are intentional. */
function buildEmptyCalendarDay(day: (typeof DAYS)[number], dateLabel: string): MediaPlanDay {
  return {
    day,
    dateLabel,
    type: "monitoring",
    label: "",
    serviceType: "",
  };
}

/** @deprecated Use distributeDeliverablesToDays — kept for legacy tests. */
export function distributeCreatorsAcrossDays(
  slate: SlateCreator[],
  totalDays: number,
  options?: { durationWeeks?: number; weekWeights?: number[] }
): SlateCreator[][] {
  const buckets = distributeDeliverablesToDays(slate, totalDays, {
    durationWeeks: Math.max(1, options?.durationWeeks ?? Math.ceil(totalDays / 7)),
    weekWeights: options?.weekWeights,
    platforms: ["Instagram"],
  });
  return buckets.map((bucket) => bucket.placements.map((placement) => placement.deliverable.creator));
}

function countScheduledDeliverables(weeks: MediaPlanWeek[]): number {
  return weeks.reduce(
    (total, week) =>
      total +
      week.days.reduce((dayTotal, day) => {
        if (day.type !== "content" && day.type !== "stories" && day.type !== "boost") {
          return dayTotal;
        }
        let dayCount = 0;
        if (day.creatorId || day.creator) dayCount += 1;
        dayCount +=
          day.additionalDeliverables?.filter((entry) => !entry.isMirror && !entry.isCompanion).length ?? 0;
        return dayTotal + dayCount;
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

function additionalDeliverableFromCompanion(
  companion: SchedulableDeliverable["attachedCompanions"][number]
): MediaPlanAdditionalDeliverable {
  const fields = creatorDayFields(companion.creator, companion.platform, companion.serviceType);
  return {
    creatorId: fields.creatorId,
    creator: fields.creator,
    shortName: fields.shortName,
    handle: fields.handle,
    avatarUrl: fields.avatarUrl,
    profileUrl: fields.profileUrl,
    serviceType: fields.serviceType,
    serviceTypes: [companion.serviceType],
    tier: fields.tier,
    platform: fields.platform,
    isCompanion: true,
  };
}

function additionalDeliverableFromMirror(
  mirror: SchedulableDeliverable["attachedMirrors"][number]
): MediaPlanAdditionalDeliverable {
  const fields = creatorDayFields(mirror.creator, mirror.platform, mirror.serviceType);
  const displayType = formatActivationServiceLabel(mirror.serviceType, mirror.role, true);
  return {
    creatorId: fields.creatorId,
    creator: fields.creator,
    shortName: fields.shortName,
    handle: fields.handle,
    avatarUrl: fields.avatarUrl,
    profileUrl: fields.profileUrl,
    serviceType: displayType,
    serviceTypes: [displayType],
    tier: fields.tier,
    platform: fields.platform,
    isMirror: true,
  };
}

function additionalDeliverableFromPlacement(
  placement: ScheduledDeliverablePlacement
): MediaPlanAdditionalDeliverable {
  const fields = creatorDayFields(
    placement.deliverable.creator,
    placement.deliverable.platform,
    placement.deliverable.serviceType
  );
  return {
    creatorId: fields.creatorId,
    creator: fields.creator,
    shortName: fields.shortName,
    handle: fields.handle,
    avatarUrl: fields.avatarUrl,
    profileUrl: fields.profileUrl,
    serviceType: fields.serviceType,
    serviceTypes: [placement.deliverable.serviceType],
    tier: fields.tier,
    platform: fields.platform,
  };
}

function activationLabel(
  primaryType: string,
  mirrors: SchedulableDeliverable["attachedMirrors"],
  companions: SchedulableDeliverable["attachedCompanions"] = []
): string {
  const originalLabel = formatActivationServiceLabel(primaryType, "hero");
  const parts = [originalLabel];
  for (const companion of companions) {
    parts.push(companion.serviceType);
  }
  if (!mirrors.length) return parts.join(" + ");
  const mirrorLabels = mirrors.map((mirror) =>
    formatActivationServiceLabel(mirror.serviceType, mirror.role, true)
  );
  return `${parts.join(" + ")} ↔ ${mirrorLabels.join(" ↔ ")}`;
}

function buildDayFromPlacements(
  day: (typeof DAYS)[number],
  dateLabel: string,
  placements: ScheduledDeliverablePlacement[]
): MediaPlanDay {
  if (!placements.length) {
    return buildEmptyCalendarDay(day, dateLabel);
  }

  const [primaryPlacement, ...additionalPlacements] = placements;
  const primary = primaryPlacement!.deliverable;
  const mirrors = primary.attachedMirrors ?? [];
  const companions = primary.attachedCompanions ?? [];
  const primaryDisplayType = formatActivationServiceLabel(primary.serviceType, primary.role);
  const fields = creatorDayFields(primary.creator, primary.platform, primaryDisplayType);
  const shortName = fields.shortName ?? shortCreatorName(primary.creator.displayName);
  const allTypes = [
    primaryDisplayType,
    ...companions.map((companion) => companion.serviceType),
    ...mirrors.map((mirror) => formatActivationServiceLabel(mirror.serviceType, mirror.role, true)),
  ];

  const primaryDay: MediaPlanDay = {
    day,
    dateLabel,
    type: "content",
    serviceTypes: allTypes,
    label: `${shortName} — ${activationLabel(primary.serviceType, mirrors, companions)}`,
    ...fields,
  };

  const bundledExtras: MediaPlanAdditionalDeliverable[] = [
    ...companions.map(additionalDeliverableFromCompanion),
    ...mirrors.map(additionalDeliverableFromMirror),
    ...additionalPlacements.map(additionalDeliverableFromPlacement),
    ...additionalPlacements.flatMap((placement) =>
      (placement.deliverable.attachedMirrors ?? []).map(additionalDeliverableFromMirror)
    ),
  ];

  if (!bundledExtras.length) return primaryDay;

  return {
    ...primaryDay,
    additionalDeliverables: bundledExtras,
    label:
      bundledExtras.length > 0 && additionalPlacements.length > 0
        ? `${shortName} +${additionalPlacements.length} creator${additionalPlacements.length === 1 ? "" : "s"}`
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

export function generateMediaPlan(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = Math.max(1, Math.min(52, facts?.durationWeeks ?? DEFAULT_DURATION_WEEKS));
  const slate = sortSlateByTier(resolveSlate(campaignObject));
  const platforms = platformsFromSlate(slate, facts?.platforms?.length ? facts.platforms : ["Instagram"]);
  const postingSlots = expandPostingSlots(slate, platforms);
  const activationCount = activationCountForSlate(slate, platforms);
  const quotationCalendar = useQuotationStyleCalendar(campaignObject, slate);
  const includePaidRhythm = !quotationCalendar && wantsPaidAmplification(campaignObject, slate);
  const startAnchor = resolveCampaignStartAnchor(facts);
  const requestedStartIso = startAnchor.requestedIso;
  const businessStartIso = requestedStartIso ?? startAnchor.scheduledIso;
  const businessEndIso = resolveBusinessCampaignEndIso({
    campaignStartIso: businessStartIso,
    campaignEndIso: (facts as { campaignEndDate?: string } | undefined)?.campaignEndDate,
    durationWeeks,
  });
  const publishingRange =
    businessEndIso != null
      ? resolvePublishingCalendarRange(businessStartIso, businessEndIso)
      : null;
  const calendarWeekCount = resolveCalendarWeekCount({
    durationWeeks,
    postingSlotCount: activationCount,
    quotationCalendar,
    campaignStartIso: businessStartIso,
    campaignEndIso: businessEndIso,
  });
  const campaignStart = publishingRange?.gridStartSaturday ?? startAnchor.scheduled;
  const campaignStartIso = publishingRange?.gridStartIso ?? startAnchor.scheduledIso;
  const campaignEndIso = businessEndIso ?? undefined;
  const schedule = mediaPlanScheduleFromMeta(campaignObject.meta);
  const weekWeights = resolveMediaPlanWeekWeights(campaignObject, calendarWeekCount);
  const briefText = resolveBriefTextForScheduling(campaignObject);
  const hasBrief = hasCampaignBriefText(campaignObject);
  const planMode = resolveMediaPlanDocumentMode(hasBrief);
  const marketConfig = resolveMarketIntelligenceConfig(campaignObject, briefText);
  const marketContext = buildMarketSchedulingContext({
    campaignStartDate: campaignStart,
    durationWeeks: calendarWeekCount,
    config: marketConfig,
  });
  const deliverableBucketsByDay =
    quotationCalendar && slate.length > 0
      ? distributeDeliverablesToDays(slate, calendarWeekCount * 7, {
          durationWeeks: calendarWeekCount,
          weekWeights,
          assignments: schedule?.assignments,
          platforms,
          briefText,
          campaignObjective: facts?.objective,
          priorityWeights: schedule?.priorityWeights,
          marketContext,
        })
      : null;

  let contentSlotCursor = 0;
  let postingSlotCursor = 0;
  let absoluteDayIndex = 0;

  const weeks: MediaPlanWeek[] = [];
  for (let week = 1; week <= calendarWeekCount; week += 1) {
    const days: MediaPlanDay[] = DAYS.map((day, index) => {
      const dateLabel = formatShortCampaignDate(dateForSlot(campaignStart, week, index));

      if (quotationCalendar && deliverableBucketsByDay) {
        const bucket = deliverableBucketsByDay[absoluteDayIndex] ?? { placements: [] };
        absoluteDayIndex += 1;
        return buildDayFromPlacements(day, dateLabel, bucket.placements);
      }

      const schedulePostingSlot = (type: MediaPlanDayType = "content"): MediaPlanDay => {
        if (!postingSlots.length || postingSlotCursor >= postingSlots.length) {
          return buildEmptyCalendarDay(day, dateLabel);
        }

        const slot = postingSlots[postingSlotCursor]!;
        postingSlotCursor += 1;
        return buildCreatorDayFromPostingSlot(day, dateLabel, type, slot);
      };

      const scheduleCreator = (type: MediaPlanDayType = "content"): MediaPlanDay => {
        const slotIndex = contentSlotCursor;
        const creator = slate.length ? slate[slotIndex % slate.length] : undefined;
        contentSlotCursor += 1;
        if (!creator) {
          return buildEmptyCalendarDay(day, dateLabel);
        }
        const platform = creator.platform ?? platforms[slotIndex % platforms.length]!;
        return buildCreatorDay(day, dateLabel, type, creator, platform);
      };

      if ((PAID_RHYTHM_CONTENT_INDEXES as readonly number[]).includes(index)) {
        return postingSlots.length ? schedulePostingSlot("content") : scheduleCreator("content");
      }
      if (includePaidRhythm && index === PAID_RHYTHM_STORIES_INDEX) {
        return postingSlots.length ? schedulePostingSlot("stories") : scheduleCreator("stories");
      }
      if (includePaidRhythm && index === PAID_RHYTHM_BOOST_INDEX) {
        return postingSlots.length ? schedulePostingSlot("boost") : scheduleCreator("boost");
      }
      if (index === PAID_RHYTHM_MONITOR_INDEX || index === 6) {
        return { day, dateLabel, type: "monitoring", label: "Performance review", serviceType: "Reporting" };
      }
      return { day, dateLabel, type: "monitoring", label: "Performance review", serviceType: "Reporting" };
    });
    weeks.push({ week, wave: week, phase: "", days });
  }

  const phasedWeeks = applyWeekPhasesFromCalendar(weeks, calendarWeekCount);
  const waves = planMode === "strategy"
    ? buildActivationWavesFromCalendar(phasedWeeks, calendarWeekCount)
    : [];
  const calendarWeeks = phasedWeeks.map((week) => ({
    ...week,
    wave: waves.find((wave) => wave.weeks.includes(week.week))?.wave ?? week.week,
  }));

  const platformAllocation = buildPlatformAllocationFromQuotation(
    slate,
    platforms,
    expandRawSchedulableDeliverables
  );
  const scheduledDeliverables = countScheduledDeliverables(calendarWeeks);
  // Always derive deadlines from the final calendar so publish dates stay aligned
  // with day placements (including after interactive schedule moves).
  const consolidatedDeadlines = rebuildMediaPlanDeadlinesFromWeeks(
    calendarWeeks,
    campaignStartIso
  );
  const unscheduledDeliverableCount = computeUnscheduledDeliverableCount(
    activationCount,
    scheduledDeliverables
  );

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

  const milestones = buildMilestonesFromSchedule({
    deadlines: consolidatedDeadlines,
    weeks: calendarWeeks,
    durationWeeks,
    campaignStartDate: campaignStartIso,
    includePaidRhythm,
  });

  const packedDeliverablesPerDay =
    quotationCalendar && activationCount > 0
      ? Math.ceil(activationCount / (calendarWeekCount * 7))
      : undefined;

  const draftData: MediaPlanData = {
    durationWeeks,
    calendarWeeks: calendarWeekCount,
    campaignStartDate: campaignStartIso,
    requestedStartDate: requestedStartIso ?? businessStartIso,
    scheduledStartDate: campaignStartIso,
    campaignEndDate: campaignEndIso,
    weeks: calendarWeeks,
    waves,
    milestones,
    platformAllocation,
    dependencies,
    deadlines: consolidatedDeadlines,
    campaignContext: resolveMediaPlanCampaignContext(campaignObject, slate),
    creatorCount: slate.length,
    postingSlotCount: activationCount > 0 ? activationCount : undefined,
    unscheduledDeliverableCount,
    serviceTypes: [
      ...new Set(
        calendarWeeks
          .flatMap((w) =>
            w.days.flatMap((d) => d.serviceTypes ?? (d.serviceType ? [d.serviceType] : []))
          )
          .filter((label): label is string => Boolean(label?.trim()))
      ),
    ],
    strategySummary: undefined,
    planMode,
    generatorVersion: MEDIA_PLAN_GENERATOR_VERSION,
  };

  // Hard constraint: no creator/deliverable slots outside Campaign Start–End.
  const data = resolveCampaignWindowFromMediaPlan(draftData)
    ? enforceMediaPlanCampaignWindow(draftData)
    : draftData;

  data.strategySummary = refreshMediaPlanStrategySummaryForDisplay(
    buildMediaPlanStrategySummary(campaignObject, {
      platformAllocation,
      planMode,
      serviceTypes: data.serviceTypes,
    }),
    {
      weeks: data.weeks,
      durationWeeks,
      platformAllocation,
      referenceSlate: slate,
    }
  );
  data.deadlines = rebuildMediaPlanDeadlinesFromWeeks(
    data.weeks,
    data.scheduledStartDate ?? data.campaignStartDate
  );
  data.serviceTypes = [
    ...new Set(
      data.weeks
        .flatMap((w) =>
          w.days.flatMap((d) => d.serviceTypes ?? (d.serviceType ? [d.serviceType] : []))
        )
        .filter((label): label is string => Boolean(label?.trim()))
    ),
  ];

  const platformCount = Object.keys(platformAllocation).length;
  return {
    title: "Media Plan",
    summary: planMode === "planning"
      ? `${durationWeeks}-week publishing plan — ${activationCount} quoted deliverable${activationCount === 1 ? "" : "s"} across ${slate.length} creator${slate.length === 1 ? "" : "s"} on ${platformCount} platform${platformCount === 1 ? "" : "s"}.`
      : quotationCalendar
        ? `${durationWeeks}-week strategy-driven calendar — ${activationCount} activation${activationCount === 1 ? "" : "s"} across ${slate.length} creator${slate.length === 1 ? "" : "s"}${
            packedDeliverablesPerDay && packedDeliverablesPerDay > 1
              ? ` (up to ${packedDeliverablesPerDay} activations per day)`
              : ""
          }.`
        : `${durationWeeks}-week client-approval-ready publishing plan across ${slate.length} creator${slate.length === 1 ? "" : "s"} and ${platformCount} platform${platformCount === 1 ? "" : "s"}.`,
    sections: buildMediaPlanSections(data),
    data: data as unknown as Record<string, unknown>,
  };
}

/** Rebuild section views from structured Media Plan data (no slate regeneration). */
export function buildMediaPlanSections(data: MediaPlanData): CampaignOutputContentSection[] {
  const sections: CampaignOutputContentSection[] = [];

  if (data.campaignContext?.campaignCost) {
    const { amount, currency } = data.campaignContext.campaignCost;
    sections.push({
      heading: "Campaign Cost",
      items: [
        `${formatMoney(amount, currency)} — ${MEDIA_PLAN_PRICING_DISCLAIMER}`,
      ],
    });
  }

  if (data.planMode !== "planning" && data.waves.length) {
    sections.push({
      heading: "Activation Waves",
      items: data.waves.map((wave) => `Wave ${wave.wave} — ${wave.theme} (weeks ${wave.weeks.join(", ")})`),
    });
  }

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

/** Renderable output content from structured data — preserves title/summary when patching. */
export function mediaPlanContentFromData(
  data: MediaPlanData,
  previous?: Pick<CampaignOutputContent, "title" | "summary">
): CampaignOutputContent {
  return {
    title: previous?.title ?? "Media Plan",
    summary: previous?.summary,
    sections: buildMediaPlanSections(data),
    data: data as unknown as Record<string, unknown>,
  };
}

/** Narrow unknown output payload to Media Plan data when structure looks valid. */
export function asMediaPlanData(value: unknown): MediaPlanData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as MediaPlanData;
  if (typeof data.campaignStartDate !== "string" || !Array.isArray(data.weeks)) return null;
  return data;
}
