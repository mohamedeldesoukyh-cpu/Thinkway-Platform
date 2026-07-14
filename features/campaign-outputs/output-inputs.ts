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
import { parseAggregatedServiceLabel } from "./hydration/quotation-service-types";
import type { VendorSelectedReasoning } from "@/features/campaign-intelligence/types/section-schemas";
import { quotationCommercialsFromMeta } from "./hydration/quotation-commercials-meta";

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

/** Resolve the current creator slate as name + tier from the Campaign Object alone. */
export function resolveSlate(campaignObject: CampaignObject): SlateCreator[] {
  const fromQuotation = slateFromQuotationCommercials(campaignObject);
  if (fromQuotation?.length) return fromQuotation;

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
    default:
      return null;
  }
}
