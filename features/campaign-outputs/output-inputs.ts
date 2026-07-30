/**
 * Output input extraction — the read side of the dependency graph.
 *
 * Every input key maps to a normalized, JSON-serializable slice of the Campaign
 * Object. The same values feed both the fingerprint (staleness detection) and
 * the generators, so an output and its "Needs Update" flag always agree on what
 * "the inputs" are. Self-contained (no Copilot imports) so the Engine has no
 * cycle with the Copilot.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  PerformanceSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputInputKey } from "./output-types";
import { resolveBriefTextForScheduling } from "./brief-media-plan-schedule";
import { parseAggregatedServiceLabel, normalizeCreatorMatchKey } from "./hydration/quotation-service-types";
import type { VendorSelectedReasoning } from "@/features/campaign-intelligence/types/section-schemas";
import { quotationCommercialsFromMeta } from "./hydration/quotation-commercials-meta";
import { marketIntelligenceFingerprintValue } from "@/features/market-intelligence/market-intelligence-config";

/** One creator on the slate, resolved from the object's own reasoning (no hydration). */
export type SlateCreator = {
  creatorId: string;
  displayName: string;
  tier?: string;
  platform?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  serviceLabel?: string;
  /** Individual quotation ad types — one media plan slot per line. */
  serviceTypes?: string[];
  quotedRevenue?: number;
  quotedCurrency?: string;
  /** Hydrated audience metrics — optional; scheduler degrades gracefully when absent. */
  followers?: number;
  engagementRate?: number;
  views?: number;
  category?: string;
  brandFit?: number;
  /** Assignment PK — authoritative operational join when known (Release 2.1). */
  campaignLineId?: string | null;
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
};

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

function mergedServiceTypes(...sources: Array<string[] | undefined>): string[] | undefined {
  const merged = [
    ...new Set(sources.flatMap((types) => types ?? []).filter((type) => type.trim())),
  ];
  return merged.length ? merged : undefined;
}

/** Collapse duplicate creator rows and union every child ad-type line. */
function mergeSelectedReasoning(
  reasoning: VendorSelectedReasoning[]
): VendorSelectedReasoning[] {
  const byId = new Map<string, VendorSelectedReasoning>();

  for (const entry of reasoning) {
    const key = normalizeId(entry.creatorId);
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, entry);
      continue;
    }

    const serviceTypes = mergedServiceTypes(
      existing.serviceTypes,
      entry.serviceTypes,
      parseAggregatedServiceLabel(existing.serviceLabel ?? ""),
      parseAggregatedServiceLabel(entry.serviceLabel ?? "")
    );

    byId.set(key, {
      ...existing,
      ...entry,
      displayName: existing.displayName?.trim() || entry.displayName,
      handle: existing.handle?.trim() || entry.handle,
      avatarUrl: existing.avatarUrl?.trim() || entry.avatarUrl,
      profileUrl: existing.profileUrl?.trim() || entry.profileUrl,
      platform: existing.platform?.trim() || entry.platform,
      serviceTypes,
      serviceLabel: serviceTypes?.length
        ? serviceTypes.join(" · ")
        : existing.serviceLabel?.trim() || entry.serviceLabel,
      quotedRevenue: Math.max(existing.quotedRevenue ?? 0, entry.quotedRevenue ?? 0) || undefined,
      quotedCurrency: existing.quotedCurrency ?? entry.quotedCurrency,
    });
  }

  return [...byId.values()];
}

function slateFromQuotationCommercials(
  campaignObject: CampaignObject
): SlateCreator[] | undefined {
  const snapshot = quotationCommercialsFromMeta(campaignObject.meta);
  if (!snapshot?.creators.length) return undefined;

  return snapshot.creators.map((creator) => ({
    creatorId: creator.creatorId,
    displayName: creator.displayName,
    tier: creator.tier,
    platform: creator.platform,
    handle: creator.handle,
    avatarUrl: creator.avatarUrl,
    profileUrl: creator.profileUrl,
    serviceLabel: creator.serviceTypes.length ? creator.serviceTypes.join(" · ") : undefined,
    serviceTypes: creator.serviceTypes.length ? creator.serviceTypes : undefined,
    quotedRevenue: creator.quotedRevenue,
    quotedCurrency: creator.quotedCurrency,
  }));
}

/** Merge missing tier (and identity fields) from a quotation-backed reference slate. */
export function enrichSlateTiersFromReference(
  slate: SlateCreator[],
  reference: SlateCreator[]
): SlateCreator[] {
  if (!reference.length || !slate.length) return slate;

  const byId = new Map<string, SlateCreator>();
  const byHandle = new Map<string, SlateCreator>();
  const byName = new Map<string, SlateCreator>();

  for (const creator of reference) {
    byId.set(normalizeId(creator.creatorId), creator);
    const handle = creator.handle?.replace(/^@/, "").trim().toLowerCase();
    if (handle) byHandle.set(handle, creator);
    const displayKey = normalizeCreatorMatchKey(creator.displayName);
    if (displayKey) byName.set(displayKey, creator);
    const shortKey = normalizeCreatorMatchKey(creator.displayName.split(" ")[0] ?? creator.displayName);
    if (shortKey) byName.set(shortKey, creator);
  }

  function resolveReference(entry: SlateCreator): SlateCreator | undefined {
    const idKey = normalizeId(entry.creatorId);
    const byIdMatch = byId.get(idKey);
    if (byIdMatch) return byIdMatch;

    const handle = entry.handle?.replace(/^@/, "").trim().toLowerCase();
    if (handle) {
      const byHandleMatch = byHandle.get(handle);
      if (byHandleMatch) return byHandleMatch;
    }

    for (const key of [
      normalizeCreatorMatchKey(entry.displayName),
      normalizeCreatorMatchKey(entry.displayName.split(" ")[0] ?? ""),
    ]) {
      if (!key) continue;
      const byNameMatch = byName.get(key);
      if (byNameMatch) return byNameMatch;
      for (const [nameKey, creator] of byName) {
        if (nameKey.startsWith(key) || key.startsWith(nameKey)) return creator;
      }
    }

    return undefined;
  }

  return slate.map((creator) => {
    const referenceCreator = resolveReference(creator);
    if (!referenceCreator) return creator;

    return {
      ...creator,
      tier: creator.tier?.trim() || referenceCreator.tier,
      handle: creator.handle?.trim() || referenceCreator.handle,
      platform: creator.platform?.trim() || referenceCreator.platform,
      avatarUrl: creator.avatarUrl?.trim() || referenceCreator.avatarUrl,
      profileUrl: creator.profileUrl?.trim() || referenceCreator.profileUrl,
    };
  });
}

/** Resolve the current creator slate as name + tier from the Campaign Object alone. */
function assignmentRefsByCreatorId(
  campaignObject: CampaignObject
): Map<
  string,
  {
    campaignLineId: string | null;
    assignmentDeliverableId: string | null;
    assignmentPostScheduleId: string | null;
  }
> {
  const creatorsData = (campaignObject.sections.creators?.data ?? {}) as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  const map = new Map<
    string,
    {
      campaignLineId: string | null;
      assignmentDeliverableId: string | null;
      assignmentPostScheduleId: string | null;
    }
  >();
  for (const entry of reasoning) {
    const key = normalizeId(entry.creatorId);
    if (!key || map.has(key)) continue;
    map.set(key, {
      campaignLineId: entry.campaignLineId?.trim() || null,
      assignmentDeliverableId: entry.assignmentDeliverableId?.trim() || null,
      assignmentPostScheduleId: entry.assignmentPostScheduleId?.trim() || null,
    });
  }
  return map;
}

function withAssignmentRefs(
  slate: SlateCreator[],
  refsByCreator: ReturnType<typeof assignmentRefsByCreatorId>
): SlateCreator[] {
  return slate.map((entry) => {
    const refs = refsByCreator.get(normalizeId(entry.creatorId));
    return {
      ...entry,
      campaignLineId: refs?.campaignLineId ?? entry.campaignLineId ?? null,
      assignmentDeliverableId:
        refs?.assignmentDeliverableId ?? entry.assignmentDeliverableId ?? null,
      assignmentPostScheduleId:
        refs?.assignmentPostScheduleId ?? entry.assignmentPostScheduleId ?? null,
    };
  });
}

export function resolveSlate(campaignObject: CampaignObject): SlateCreator[] {
  const refsByCreator = assignmentRefsByCreatorId(campaignObject);
  const fromQuotation = slateFromQuotationCommercials(campaignObject);
  if (fromQuotation?.length) {
    return withAssignmentRefs(fromQuotation, refsByCreator);
  }

  const creatorsData = (campaignObject.sections.creators?.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  const reasoning = mergeSelectedReasoning(
    creatorsData.recommendations?.selectedReasoning ?? []
  );
  const byId = new Map(reasoning.map((r) => [normalizeId(r.creatorId), r]));
  const uniqueIds = [...new Set(ids.map((id) => normalizeId(id)))];
  return uniqueIds.map((id) => {
    const entry = byId.get(id);
    const originalId = ids.find((candidate) => normalizeId(candidate) === id) ?? id;
    return {
      creatorId: originalId,
      displayName: entry?.displayName?.trim() || id,
      tier: entry?.expectedRole?.trim() || undefined,
      platform: entry?.platform?.trim() || undefined,
      handle: entry?.handle?.trim() || undefined,
      avatarUrl: entry?.avatarUrl?.trim() || undefined,
      profileUrl: entry?.profileUrl?.trim() || undefined,
      serviceLabel: entry?.serviceLabel?.trim() || undefined,
      serviceTypes: entry?.serviceTypes?.length ? entry.serviceTypes : undefined,
      quotedRevenue:
        typeof entry?.quotedRevenue === "number" && entry.quotedRevenue > 0
          ? entry.quotedRevenue
          : undefined,
      quotedCurrency: entry?.quotedCurrency?.trim() || undefined,
      campaignLineId: entry?.campaignLineId?.trim() || null,
      assignmentDeliverableId: entry?.assignmentDeliverableId?.trim() || null,
      assignmentPostScheduleId: entry?.assignmentPostScheduleId?.trim() || null,
    };
  });
}

function stringContent(
  campaignObject: CampaignObject,
  section: keyof CampaignObject["sections"]
): string {
  const content = campaignObject.sections[section]?.content;
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    try {
      return JSON.stringify(content);
    } catch {
      return "";
    }
  }
  return "";
}

export function overallScore(campaignObject: CampaignObject): number | undefined {
  const performance = campaignObject.sections.performance?.data as
    | PerformanceSectionData
    | undefined;
  return performance?.campaignScores?.overall;
}

/**
 * The normalized value for one input key. Returns plain JSON-serializable data;
 * order is normalized (ids sorted) so a fingerprint is stable across reorderings
 * that don't change the actual slate.
 */
export function resolveInputValue(
  campaignObject: CampaignObject,
  key: CampaignOutputInputKey
): unknown {
  const facts = getCampaignFacts(campaignObject);
  switch (key) {
    case "brief":
      return resolveBriefTextForScheduling(campaignObject);
    case "objective":
      return facts?.objective ?? "";
    case "audience":
      return facts?.audience ?? "";
    case "market":
      return [...(facts?.geography ?? [])].sort();
    case "platforms":
      return facts?.platforms ?? [];
    case "creators": {
      const commercials = quotationCommercialsFromMeta(campaignObject.meta);
      if (commercials?.creators.length) {
        return commercials.creators
          .map(
            (c) =>
              `${normalizeId(c.creatorId)}:${(c.tier ?? "").toLowerCase()}:${(c.serviceTypes ?? []).join("|").toLowerCase()}:${(c.avatarUrl ?? "").toLowerCase()}`
          )
          .sort();
      }
      return resolveSlate(campaignObject)
        .map(
          (c) =>
            `${normalizeId(c.creatorId)}:${(c.tier ?? "").toLowerCase()}:${(c.serviceLabel ?? "").toLowerCase()}:${(c.serviceTypes ?? []).join("|").toLowerCase()}:${(c.avatarUrl ?? "").toLowerCase()}`
        )
        .sort();
    }
    case "budget":
      return facts?.budget
        ? { amount: facts.budget.amount, currency: facts.budget.currency }
        : null;
    case "timeline":
      return {
        durationWeeks: facts?.durationWeeks ?? null,
        campaignStartDate: facts?.campaignStartDate ?? null,
        weekWeights: campaignObject.meta.mediaPlanSchedule?.weekWeights ?? null,
        assignments: (campaignObject.meta.mediaPlanSchedule?.assignments ?? [])
          .map(
            (assignment) =>
              `${assignment.creatorId}@${assignment.week}-${assignment.dayIndex}:${assignment.serviceType ?? "*"}`
          )
          .sort(),
      };
    case "kpis":
      return facts?.kpis ?? [];
    case "deliverables_scope":
      return facts?.deliverables ?? [];
    case "strategy":
      return stringContent(campaignObject, "strategy");
    case "creative_concepts":
      return stringContent(campaignObject, "strategy").slice(0, 4000);
    case "risks":
      return [...(facts?.risks ?? [])].sort();
    case "market_intelligence":
      return marketIntelligenceFingerprintValue(campaignObject);
    default:
      return null;
  }
}
