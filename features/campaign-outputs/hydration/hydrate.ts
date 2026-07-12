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

function emptySection() {
  return { content: "", status: "complete" as const };
}

/** A blank Campaign Object skeleton — all nine sections present, empty facts. */
export function emptyCampaignObject(options?: { id?: string; conversationId?: string; now?: string }): CampaignObject {
  const now = options?.now ?? new Date().toISOString();
  return {
    id: options?.id ?? `camp_${Date.now()}`,
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

function slateFromSeed(creators: SeedCreator[]): CreatorsSectionData {
  const selectedReasoning: VendorSelectedReasoning[] = creators.map((c) => ({
    creatorId: c.creatorId,
    displayName: c.displayName,
    whySelected: "Carried over from source",
    expectedRole: c.tier ?? "Unclassified",
    audienceMatch: c.categories?.join(", ") ?? "",
    risk: "",
    alternative: "",
    confidence: c.aiScore ? Math.min(1, c.aiScore / 100) : 0.7,
    evidence: c.brandFit != null ? `Brand fit ${c.brandFit}` : "",
    tradeoff: "",
  }));
  return {
    recommendations: {
      creatorIds: creators.map((c) => c.creatorId),
      selectedReasoning,
    },
  };
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

/**
 * Hydrate a Campaign Object from a seed. When `existing` is provided, only gaps
 * are filled — present (validated) facts and a non-empty slate are preserved.
 */
export function hydrateCampaignObject(
  seed: CampaignSeed,
  existing?: CampaignObject,
  options?: { now?: string }
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

  // Merge slate: keep an existing non-empty slate; otherwise seed it.
  const existingSlate = (base.sections.creators?.data as CreatorsSectionData | undefined)?.recommendations
    ?.creatorIds;
  let creatorsSection = base.sections.creators;
  if (existingSlate && existingSlate.length > 0) {
    if (seed.creators.length > 0) preservedFields.push("creators");
  } else if (seed.creators.length > 0) {
    creatorsSection = {
      content: "",
      data: slateFromSeed(seed.creators) as unknown as Record<string, unknown>,
      status: "complete",
    };
    hydratedFields.push("creators");
  }

  const hydrated: CampaignObject = {
    ...base,
    updatedAt: now,
    sections: { ...base.sections, creators: creatorsSection },
    meta: {
      ...base.meta,
      campaignFacts: mergedFacts,
    },
  };

  return {
    campaignObject: hydrated,
    hydratedFields,
    preservedFields,
    missing: detectMissingInformation(hydrated),
  };
}
