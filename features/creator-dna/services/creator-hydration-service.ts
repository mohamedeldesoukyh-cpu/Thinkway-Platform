/**
 * Server-side creator hydration from Creator DNA.
 * Falls back to unified browse when DNA is absent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import {
  getUnifiedCreatorById,
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorDNAService } from "../services/creator-dna-service";
import type { CreatorDNARecord } from "../types";
import {
  mapCreatorToHydratedVendor,
  type HydratedVendor,
  type HydrationMapperOptions,
} from "@/features/campaign-studio/services/creator-hydration-mapper";
import { buildSocialProfileUrl } from "@/features/campaign-studio/services/creator-platform-utils";
import { estimateCreatorPostFee } from "@/features/campaign-studio/services/creator-fee-estimator";
import { getQuotationPriceReferencesBatch } from "@/lib/creators/quotation-price-reference";
import { STUDIO_CREATOR_HYDRATION_LIMIT } from "@/features/campaign-studio/constants/hydration-limits";
import { loadStudioEciPlanningSignals } from "@/features/campaign-studio/services/eci/load-studio-eci-signals";
import {
  formatStudioEciReason,
  lookupStudioEciSignal,
} from "@/features/campaign-studio/services/eci/project-studio-eci-signal";

type AnySupabase = SupabaseClient;

function normalizeInfluencerId(creatorId: string): string {
  const trimmed = creatorId.trim();
  if (trimmed.startsWith("inf:")) return trimmed.slice(4);
  return trimmed;
}

function persistedCampaignFitScore(
  creatorId: string,
  scores?: Record<string, number>
): number | undefined {
  if (!scores) return undefined;
  const raw = creatorId.trim();
  const bare = raw.replace(/^inf:/, "").replace(/^dis:/, "");
  return (
    scores[raw] ??
    scores[`inf:${bare}`] ??
    scores[`dis:${bare}`] ??
    scores[bare]
  );
}

export function mapDnaToHydratedVendor(
  record: CreatorDNARecord,
  index: number,
  rationale?: string,
  avgFit?: number,
  options?: HydrationMapperOptions
): HydratedVendor {
  const doc = record.document;
  const displayName = doc.identity.displayName.value ?? `Creator ${index + 1}`;
  const handle = doc.identity.handle.value ?? `@creator`;
  const platform =
    doc.identity.platform.value ??
    doc.platforms.primaryPlatform.value ??
    options?.preferredPlatforms?.[0] ??
    "instagram";
  const profileUrl =
    doc.content?.profileUrl?.value?.trim() ||
    buildSocialProfileUrl(platform, handle);
  const unifiedId = record.influencerId.startsWith("inf:")
    ? record.influencerId
    : `inf:${record.influencerId}`;
  const influencerId = record.influencerId.startsWith("inf:")
    ? record.influencerId.slice(4)
    : record.influencerId;
  const eci = lookupStudioEciSignal(options?.eciSignalsByInfluencerId, influencerId);
  const persistedFit = persistedCampaignFitScore(
    unifiedId,
    options?.campaignFitScoresByCreatorId
  );
  // Planning SSOT: ECI investment — never DNA Thinkway / brand-fit scores.
  const fitScore = eci?.investmentScore ?? persistedFit ?? avgFit ?? 60;
  const dnaFollowers = doc.metrics.followers.value;
  const reachFollowers = doc.platforms.crossPlatformReach.value;
  const followersCandidates = [dnaFollowers, reachFollowers].filter(
    (value): value is number => typeof value === "number" && value > 0
  );
  const followers =
    followersCandidates.length > 0 ? Math.max(...followersCandidates) : undefined;
  const rateCardAmount = doc.commercial.estimatedRate.value ?? null;
  const quotationRef = options?.quotationPriceByInfluencerId?.get(influencerId);
  const displayCurrency = options?.currency ?? "EGP";

  return {
    id: record.influencerId.startsWith("inf:") ? record.influencerId : `inf:${record.influencerId}`,
    displayName,
    handle,
    platform,
    avatarUrl: doc.identity.avatarUrl.value ?? undefined,
    profileUrl: profileUrl || undefined,
    followers,
    engagementRate: doc.metrics.engagementRate.value ?? undefined,
    country: doc.audience.country.value ?? undefined,
    language: doc.audience.languages.value?.slice(0, 2).join(" / ") || "Arabic / English",
    audienceSummary:
      doc.audience.interests.value?.slice(0, 2).join(", ") ??
      doc.audience.categories.value?.slice(0, 2).join(", ") ??
      "Category audience",
    thinkwayScore: eci?.investmentScore ?? undefined,
    brandFit: fitScore,
    reason: eci ? formatStudioEciReason(eci) : rationale,
    matchPercent: Math.min(98, fitScore + 5),
    eciRecommendation: eci?.recommendation,
    eciConfidencePercent: eci?.confidencePercent ?? null,
    planningSignal: eci,
    priceEstimate: estimateCreatorPostFee({
      followers,
      platform,
      currency: displayCurrency,
      rateCardAmount,
      quotationAvgCost:
        quotationRef != null &&
        (quotationRef.avg_cost_currency === displayCurrency || displayCurrency === "EGP")
          ? quotationRef.avg_cost_currency === displayCurrency
            ? quotationRef.avg_cost
            : quotationRef.avg_cost_egp
          : quotationRef?.avg_cost ?? null,
      quotationQuoteCount: quotationRef?.quote_count,
      quotationCurrency: quotationRef?.avg_cost_currency ?? displayCurrency,
    }),
    tier: resolveCreatorTierLabel({
      followers,
    }),
  };
}

export async function hydrateCreatorFromDna(
  supabase: AnySupabase,
  creatorId: string,
  index: number,
  options?: { rationale?: string; avgFitScore?: number } & HydrationMapperOptions
): Promise<{ vendor: HydratedVendor | null; source: "dna" | "unified" | "none" }> {
  const influencerId = normalizeInfluencerId(creatorId);
  const service = new CreatorDNAService(supabase);
  const dna = await service.getCreatorDNA(influencerId);

  if (dna && hasPopulatedDna(dna)) {
    try {
      return {
        vendor: mapDnaToHydratedVendor(dna, index, options?.rationale, options?.avgFitScore, options),
        source: "dna",
      };
    } catch {
      // Partial DNA documents should fall back to unified browse hydration.
    }
  }

  const unifiedId = creatorId.startsWith("inf:") ? creatorId : `inf:${influencerId}`;
  const unified: UnifiedCreatorResult | null = await getUnifiedCreatorById(supabase, unifiedId);
  if (unified) {
    return {
      vendor: mapCreatorToHydratedVendor(
        unified,
        index,
        options?.rationale,
        options?.avgFitScore,
        options
      ),
      source: "unified",
    };
  }

  return { vendor: null, source: "none" };
}

function hasPopulatedDna(record: CreatorDNARecord): boolean {
  const doc = record.document;
  return (
    doc.identity.displayName.confidence > 0 ||
    doc.metrics.followers.confidence > 0 ||
    doc.audience.categories.confidence > 0
  );
}

export async function hydrateCreatorsFromDna(
  supabase: AnySupabase,
  creatorIds: string[],
  options?: {
    rationale?: string;
    avgFitScore?: number;
    /** When false, skip ECI for this wave (phase-1 perceived slate). Default true. */
    includeEci?: boolean;
    /** When false, skip quotation price batch (phase-1). Default true. */
    includeQuotationPrices?: boolean;
  } & HydrationMapperOptions
): Promise<{ vendors: HydratedVendor[]; dnaCount: number; unifiedFallbackCount: number }> {
  const vendors: HydratedVendor[] = [];
  let dnaCount = 0;
  let unifiedFallbackCount = 0;

  const ids = creatorIds.filter(Boolean).slice(0, STUDIO_CREATOR_HYDRATION_LIMIT);
  if (ids.length === 0) {
    return { vendors, dnaCount, unifiedFallbackCount };
  }

  const includeEci = options?.includeEci !== false;
  const includeQuotationPrices = options?.includeQuotationPrices !== false;
  const influencerIds = ids.map((id) => normalizeInfluencerId(id));
  const service = new CreatorDNAService(supabase);

  const emptyEci = new Map() as Awaited<ReturnType<typeof loadStudioEciPlanningSignals>>;
  const [dnaByInfluencer, quotationPriceByInfluencerId, eciSignalsByInfluencerId] =
    await Promise.all([
      service.getCreatorDNABatch(influencerIds),
      includeQuotationPrices
        ? getQuotationPriceReferencesBatch(supabase, influencerIds)
        : Promise.resolve(undefined),
      includeEci
        ? loadStudioEciPlanningSignals(supabase, ids).catch(() => emptyEci)
        : Promise.resolve(emptyEci),
    ]);

  const {
    includeEci: _includeEci,
    includeQuotationPrices: _includeQuotationPrices,
    rationale: _rationale,
    avgFitScore: _avgFitScore,
    ...mapperRest
  } = options ?? {};

  const hydrationOptions: HydrationMapperOptions = {
    ...mapperRest,
    ...(quotationPriceByInfluencerId
      ? { quotationPriceByInfluencerId }
      : {}),
    eciSignalsByInfluencerId,
  };

  const unifiedFallbackIds: Array<{ id: string; index: number }> = [];

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index]!;
    const influencerId = influencerIds[index]!;
    const dna = dnaByInfluencer.get(influencerId) ?? null;

    if (dna && hasPopulatedDna(dna)) {
      try {
        vendors.push(
          mapDnaToHydratedVendor(dna, index, options?.rationale, options?.avgFitScore, hydrationOptions)
        );
        dnaCount += 1;
        continue;
      } catch {
        // Partial DNA documents should fall back to unified browse hydration.
      }
    }

    unifiedFallbackIds.push({ id, index });
  }

  if (unifiedFallbackIds.length > 0) {
    const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
      unifiedIds: unifiedFallbackIds.map(({ id }) =>
        id.startsWith("inf:") || id.startsWith("dis:") ? id : `inf:${normalizeInfluencerId(id)}`
      ),
      influencerIds: unifiedFallbackIds.map(({ id }) => normalizeInfluencerId(id)),
    });

    for (const { id, index } of unifiedFallbackIds) {
      const unifiedId = id.startsWith("inf:") || id.startsWith("dis:") ? id : `inf:${normalizeInfluencerId(id)}`;
      const unified = resolveCreatorFromRefLookup(lookup, {
        unified_id: unifiedId,
        influencer_id: normalizeInfluencerId(id),
      });
      if (!unified) continue;

      vendors.push(
        mapCreatorToHydratedVendor(
          unified,
          index,
          options?.rationale,
          options?.avgFitScore,
          hydrationOptions
        )
      );
      unifiedFallbackCount += 1;
    }
  }

  return { vendors, dnaCount, unifiedFallbackCount };
}
