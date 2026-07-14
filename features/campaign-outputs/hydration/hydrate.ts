/**
 * Hydration — build/fill a Campaign Object from a normalized CampaignSeed.
 *
 * Rules:
 *  • Never recreate information that already exists.
 *  • Never overwrite validated information — an existing Campaign Object's facts
 *    and slate win; hydration only fills gaps.
 *  • Never duplicate campaign data — the Campaign Object stays the SSOT; the seed
 *    is discarded after mapping.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type {
  CreatorsSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";

import type { CampaignSeed, HydrationField, HydrationResult, SeedCreator } from "./hydration-types";
import { detectMissingInformation } from "./missing-info";
import { normalizeCreatorMatchKey, parseAggregatedServiceLabel } from "./quotation-service-types";
import {
  buildQuotationCommercialsMeta,
  mergeQuotationCommercialsContext,
  type QuotationCommercialsMeta,
} from "./quotation-commercials-meta";

function unionServiceTypes(
  ...sources: Array<string[] | undefined>
): string[] | undefined {
  const merged = [
    ...new Set(sources.flatMap((types) => types ?? []).filter((type) => type.trim())),
  ];
  return merged.length ? merged : undefined;
}

function emptySection() {
  return { content: "", status: "complete" as const };
}

/** Works in browser and Node — hydrate is used from client preview components. */
function createCampaignObjectId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** A blank Campaign Object skeleton — all nine sections present, empty facts. */
export function emptyCampaignObject(options?: { id?: string; conversationId?: string; now?: string }): CampaignObject {
  const now = options?.now ?? new Date().toISOString();
  return {
    id: options?.id ?? createCampaignObjectId(),
    conversationId: options?.conversationId,
    updatedAt: now,
    sections: {
      summary: emptySection(),
      audience: emptySection(),
      strategy: emptySection(),
      creators: emptySection(),
      budget: emptySection(),
      timeline: emptySection(),
      performance: emptySection(),
      presentation: emptySection(),
      operations: emptySection(),
    },
    meta: {
      status: "draft",
      specialistProgress: [],
    },
  };
}

function normalizeCreatorId(id: string): string {
  return id.trim().toLowerCase();
}

/** Merge quotation commercial fields (avatar, ad type, fees) into an existing slate. */
export function mergeCommercialFieldsFromSeed(
  data: CreatorsSectionData,
  seedCreators: SeedCreator[]
): CreatorsSectionData {
  if (!seedCreators.length) return data;

  const byId = new Map(seedCreators.map((c) => [normalizeCreatorId(c.creatorId), c]));

  function seedForEntry(entry: VendorSelectedReasoning): SeedCreator | undefined {
    const direct = byId.get(normalizeCreatorId(entry.creatorId));
    if (direct) return direct;
    const handle = entry.handle?.replace(/^@/, "").trim().toLowerCase();
    if (handle) {
      const byHandle = seedCreators.find(
        (s) => s.handle?.replace(/^@/, "").trim().toLowerCase() === handle
      );
      if (byHandle) return byHandle;
    }
    const name = normalizeCreatorMatchKey(entry.displayName ?? "");
    if (!name) return undefined;
    return seedCreators.find((s) => {
      const seedName = normalizeCreatorMatchKey(s.displayName);
      return seedName === name || name.startsWith(seedName) || seedName.startsWith(name);
    });
  }

  const recommendations = data.recommendations ?? { creatorIds: [], selectedReasoning: [] };
  const recs = recommendations.selectedReasoning ?? [];

  const mergedRecs: VendorSelectedReasoning[] = recs.length
    ? recs.map((entry) => {
        const seed = seedForEntry(entry);
        if (!seed) return entry;
        const mergedTypes = unionServiceTypes(
          entry.serviceTypes,
          seed.serviceTypes,
          parseAggregatedServiceLabel(seed.serviceLabel ?? "")
        );
        return {
          ...entry,
          displayName: entry.displayName?.trim() || seed.displayName,
          ...(seed.platform ? { platform: seed.platform } : {}),
          ...(seed.handle ? { handle: seed.handle } : {}),
          ...(seed.avatarUrl || entry.avatarUrl
            ? { avatarUrl: seed.avatarUrl ?? entry.avatarUrl }
            : {}),
          ...(seed.profileUrl || entry.profileUrl
            ? { profileUrl: seed.profileUrl ?? entry.profileUrl }
            : {}),
          ...(mergedTypes?.length
            ? {
                serviceTypes: mergedTypes,
                serviceLabel: mergedTypes.join(" · "),
              }
            : seed.serviceLabel
              ? { serviceLabel: seed.serviceLabel }
              : {}),
          ...(seed.quotedRevenue != null && seed.quotedRevenue > 0
            ? { quotedRevenue: seed.quotedRevenue, quotedCurrency: seed.quotedCurrency ?? "EGP" }
            : {}),
        };
      })
    : seedCreators.map((c) => ({
        creatorId: c.creatorId,
        displayName: c.displayName,
        ...(c.quotedRevenue != null && c.quotedRevenue > 0
          ? { quotedRevenue: c.quotedRevenue, quotedCurrency: c.quotedCurrency ?? "EGP" }
          : {}),
        ...(c.platform ? { platform: c.platform } : {}),
        ...(c.handle ? { handle: c.handle } : {}),
        ...(c.avatarUrl ? { avatarUrl: c.avatarUrl } : {}),
        ...(c.profileUrl ? { profileUrl: c.profileUrl } : {}),
        ...(c.serviceTypes?.length
          ? {
              serviceTypes: c.serviceTypes,
              serviceLabel: c.serviceLabel ?? c.serviceTypes.join(" · "),
            }
          : c.serviceLabel
            ? { serviceLabel: c.serviceLabel }
            : {}),
        whySelected: "Synced from quotation",
        expectedRole: c.tier ?? "Unclassified",
        audienceMatch: c.categories?.join(", ") ?? "",
        risk: "",
        alternative: "",
        confidence: 0.7,
        evidence: "",
        tradeoff: "",
      }));

  const creatorIds = [...new Set(
    (recommendations.creatorIds?.length > 0
      ? recommendations.creatorIds
      : seedCreators.map((c) => c.creatorId))
  )];

  return {
    ...data,
    recommendations: {
      ...recommendations,
      creatorIds,
      selectedReasoning: mergedRecs,
    },
  };
}

function slateFromSeed(creators: SeedCreator[]): CreatorsSectionData {
  return mergeCommercialFieldsFromSeed(
    { recommendations: { creatorIds: [], selectedReasoning: [] } },
    creators
  );
}

/** Fields on the seed that map to campaign facts (for gap-filling + provenance). */
function factsFromSeed(seed: CampaignSeed, now: string): Partial<CampaignFacts> {
  const facts: Partial<CampaignFacts> = {};
  if (seed.client) facts.clientName = seed.client;
  if (seed.brand) facts.brandName = seed.brand;
  if (seed.objective) facts.objective = seed.objective;
  if (seed.audience) facts.audience = seed.audience;
  if (seed.budget) facts.budget = seed.budget;
  if (seed.durationWeeks) facts.durationWeeks = seed.durationWeeks;
  if (seed.market?.length) facts.geography = seed.market;
  if (seed.platforms?.length) facts.platforms = seed.platforms;
  if (seed.deliverables?.length) facts.deliverables = seed.deliverables;
  if (seed.kpis?.length) facts.kpis = seed.kpis;
  facts.extractedAt = now;
  return facts;
}

/** True when a facts value is meaningfully present (validated). */
function hasFact(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function quotationContextPatchFromSeed(
  seed: CampaignSeed,
  options?: { quotationId?: string; now?: string }
): QuotationCommercialsMeta | undefined {
  if (seed.source !== "quotation") return undefined;

  const hasContext =
    seed.brand?.trim() ||
    seed.client?.trim() ||
    seed.group?.trim() ||
    seed.agencyOrDirect ||
    options?.quotationId;

  if (!hasContext) return undefined;

  return mergeQuotationCommercialsContext(undefined, {
    quotationId: options?.quotationId,
    syncedAt: options?.now,
    clientName: seed.client,
    brandName: seed.brand,
    groupName: seed.group,
    agencyOrDirect: seed.agencyOrDirect,
    agencyName:
      seed.agencyOrDirect === "agency" ? seed.agencyName ?? seed.client : undefined,
  });
}

function buildQuotationCommercialsFromSeed(
  seed: CampaignSeed,
  existing: QuotationCommercialsMeta | undefined,
  options?: { quotationId?: string; now?: string }
): QuotationCommercialsMeta | undefined {
  if (seed.source !== "quotation") return existing;

  const contextPatch = {
    quotationId: options?.quotationId,
    syncedAt: options?.now,
    clientName: seed.client,
    brandName: seed.brand,
    groupName: seed.group,
    agencyOrDirect: seed.agencyOrDirect,
    agencyName:
      seed.agencyOrDirect === "agency" ? seed.agencyName ?? seed.client : undefined,
  };

  if (seed.creators.length > 0) {
    return mergeQuotationCommercialsContext(
      buildQuotationCommercialsMeta(seed.creators, contextPatch),
      contextPatch
    );
  }

  const contextOnly = quotationContextPatchFromSeed(seed, options);
  if (!contextOnly) return existing;

  return mergeQuotationCommercialsContext(existing, contextOnly);
}

/**
 * Hydrate a Campaign Object from a seed. When `existing` is provided, only gaps
 * are filled — present (validated) facts and a non-empty slate are preserved.
 */
export function hydrateCampaignObject(
  seed: CampaignSeed,
  existing?: CampaignObject,
  options?: { now?: string; quotationId?: string }
): HydrationResult {
  const now = options?.now ?? new Date().toISOString();
  const base = existing ?? emptyCampaignObject({ now });
  const existingFacts = base.meta.campaignFacts;
  const seedFacts = factsFromSeed(seed, now);

  const hydratedFields: HydrationField[] = [];
  const preservedFields: HydrationField[] = [];

  // Merge facts: existing validated value wins; otherwise fill from the seed.
  const mergedFacts: CampaignFacts = {
    extractedAt: existingFacts?.extractedAt ?? now,
    confidence: existingFacts?.confidence ?? {},
    sources: existingFacts?.sources ?? {},
    ...existingFacts,
  };

  const factFieldMap: Array<[HydrationField, keyof CampaignFacts]> = [
    ["client", "clientName"],
    ["brand", "brandName"],
    ["objective", "objective"],
    ["audience", "audience"],
    ["budget", "budget"],
    ["durationWeeks", "durationWeeks"],
    ["market", "geography"],
    ["platforms", "platforms"],
    ["deliverables", "deliverables"],
    ["kpis", "kpis"],
  ];

  for (const [field, factKey] of factFieldMap) {
    const existingValue = existingFacts ? existingFacts[factKey] : undefined;
    const seedValue = seedFacts[factKey];
    if (hasFact(existingValue)) {
      if (hasFact(seedValue)) preservedFields.push(field);
      continue;
    }
    if (hasFact(seedValue)) {
      (mergedFacts as Record<string, unknown>)[factKey] = seedValue;
      mergedFacts.sources = { ...mergedFacts.sources, [factKey]: "inferred" };
      hydratedFields.push(field);
    }
  }

  // Merge slate: quotation sources replace the full creator slate so each ad type line is preserved.
  const existingSlate = (base.sections.creators?.data as CreatorsSectionData | undefined)?.recommendations
    ?.creatorIds;
  const replaceSlateFromQuotation = seed.source === "quotation" && seed.creators.length > 0;
  let creatorsSection = base.sections.creators;
  if (seed.creators.length > 0) {
    const baseData = (creatorsSection.data ?? {}) as CreatorsSectionData;
    const mergedData = replaceSlateFromQuotation
      ? slateFromSeed(seed.creators)
      : existingSlate && existingSlate.length > 0
        ? mergeCommercialFieldsFromSeed(baseData, seed.creators)
        : slateFromSeed(seed.creators);
    creatorsSection = {
      content: "",
      data: mergedData as unknown as Record<string, unknown>,
      status: "complete",
    };
    if (existingSlate && existingSlate.length > 0 && !replaceSlateFromQuotation) {
      preservedFields.push("creators");
    } else {
      hydratedFields.push("creators");
    }
  }

  const quotationCommercials = buildQuotationCommercialsFromSeed(
    seed,
    base.meta.quotationCommercials,
    { quotationId: options?.quotationId, now }
  );

  const hydrated: CampaignObject = {
    ...base,
    updatedAt: now,
    sections: { ...base.sections, creators: creatorsSection },
    meta: {
      ...base.meta,
      campaignFacts: mergedFacts,
      ...(quotationCommercials ? { quotationCommercials } : {}),
    },
  };

  return {
    campaignObject: hydrated,
    hydratedFields,
    preservedFields,
    missing: detectMissingInformation(hydrated),
  };
}
