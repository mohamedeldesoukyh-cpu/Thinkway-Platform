import type { SupabaseClient } from "@supabase/supabase-js";

import type { BrandMatchCandidate } from "@/lib/domains/intelligence/types";
import { loadLiveMasters, resolveClient } from "@/lib/intelligence/entity-resolution/matchers";

import {
  brandMatchesAlias,
  expandBrandSearchTerms,
  findKnownBrandsInText,
  resolveBrandWithAliases,
} from "./brand-resolution";
import type { BrandSelectRow } from "./build-brand-link-dialog-options";
import { isValidBrandName, sanitizeBrandName } from "./normalization/validators";
import type { CampaignIntelligenceProfile } from "../types/profile";

export type BrandDetectionResult = {
  candidates: BrandMatchCandidate[];
  bestMatch: BrandMatchCandidate | null;
  extractedBrandName: string | null;
  extractedClientName: string | null;
  /** True when extractedBrandName is trustworthy enough to show in the link dialog. */
  hasReliableBrandHint: boolean;
};

type ProfileBrandHints = Pick<
  CampaignIntelligenceProfile,
  "brandName" | "clientName" | "campaignName" | "rawBriefExcerpt" | "objectives"
>;

function resolveValidBrandName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const sanitized = sanitizeBrandName(raw.trim());
  return isValidBrandName(sanitized) ? sanitized : null;
}

function collectBrandSearchTerms(profile: ProfileBrandHints): string[] {
  const terms: string[] = [];

  const fromBrand = resolveValidBrandName(profile.brandName);
  if (fromBrand) terms.push(fromBrand);

  const fromClient = resolveValidBrandName(profile.clientName);
  if (fromClient) terms.push(fromClient);

  const textSources = [
    profile.campaignName,
    profile.rawBriefExcerpt,
    ...(profile.objectives ?? []),
  ].filter(Boolean) as string[];

  for (const text of textSources) {
    terms.push(...findKnownBrandsInText(text));
  }

  return expandBrandSearchTerms(
    [...new Set(terms.map((t) => t.trim()).filter(Boolean))]
  );
}

export async function detectBrandFromProfile(
  supabase: SupabaseClient,
  profile: ProfileBrandHints
): Promise<BrandDetectionResult> {
  const extractedBrandName = resolveValidBrandName(profile.brandName);
  const extractedClientName = profile.clientName?.trim() || null;
  const hasReliableBrandHint = Boolean(extractedBrandName);
  const searchTerms = collectBrandSearchTerms(profile);

  if (searchTerms.length === 0) {
    return {
      candidates: [],
      bestMatch: null,
      extractedBrandName,
      extractedClientName,
      hasReliableBrandHint,
    };
  }

  const masters = await loadLiveMasters(supabase);
  const clientResolution = resolveClient(masters, extractedClientName, null);
  const scopedClientId =
    clientResolution.resolvedClientId && clientResolution.confidence >= 0.88
      ? clientResolution.resolvedClientId
      : null;

  let brandResolution = resolveBrandWithAliases(masters, searchTerms, scopedClientId);
  if (!brandResolution.resolvedBrandId && scopedClientId) {
    brandResolution = resolveBrandWithAliases(masters, searchTerms, null);
  }

  const candidates: BrandMatchCandidate[] = masters.brands
    .filter((brand) =>
      searchTerms.some((term) => {
        if (brandMatchesAlias(term, brand.name)) return true;
        const name = brand.name.toLowerCase();
        const query = term.toLowerCase();
        return name.includes(query) || query.includes(name);
      })
    )
    .slice(0, 8)
    .map((brand) => {
      const client = masters.clients.find((c) => c.id === brand.client_id);
      const isBest = brand.id === brandResolution.resolvedBrandId;
      return {
        brandId: brand.id,
        brandName: brand.name,
        clientId: brand.client_id,
        clientName: client?.name ?? "Unknown client",
        confidence: isBest ? brandResolution.confidence : 0.5,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  let bestMatch: BrandMatchCandidate | null = null;
  if (brandResolution.resolvedBrandId && brandResolution.confidence >= 0.65) {
    const brand = masters.brands.find((b) => b.id === brandResolution.resolvedBrandId);
    const client = brand ? masters.clients.find((c) => c.id === brand.client_id) : null;
    if (brand) {
      bestMatch = {
        brandId: brand.id,
        brandName: brand.name,
        clientId: brand.client_id,
        clientName: client?.name ?? "Unknown client",
        confidence: brandResolution.confidence,
      };
    }
  }

  if (bestMatch && !candidates.some((c) => c.brandId === bestMatch!.brandId)) {
    candidates.unshift(bestMatch);
  }

  return {
    candidates,
    bestMatch,
    extractedBrandName,
    extractedClientName,
    hasReliableBrandHint,
  };
}

/** Pick a brand id from detection output, with sensible fallbacks before manual selection. */
export function pickResolvedBrandId(
  detection: BrandDetectionResult,
  explicitBrandId?: string | null,
  accessibleBrands?: BrandSelectRow[]
): string | null {
  if (explicitBrandId) return explicitBrandId;
  if (detection.bestMatch?.brandId) return detection.bestMatch.brandId;

  const [topCandidate] = detection.candidates;
  if (topCandidate) {
    if (detection.candidates.length === 1 && topCandidate.confidence >= 0.5) {
      return topCandidate.brandId;
    }
    if (detection.hasReliableBrandHint && topCandidate.confidence >= 0.6) {
      return topCandidate.brandId;
    }
  }

  if (accessibleBrands?.length) {
    return pickBrandIdFromAccessibleList(detection, accessibleBrands);
  }

  return null;
}

/** Match extracted brief hints against brands the user can actually select. */
export function pickBrandIdFromAccessibleList(
  detection: BrandDetectionResult,
  accessibleBrands: BrandSelectRow[]
): string | null {
  if (accessibleBrands.length === 1) {
    return accessibleBrands[0]!.id;
  }

  const terms = expandBrandSearchTerms(
    [
      detection.extractedBrandName,
      ...detection.candidates.map((candidate) => candidate.brandName),
    ].filter((value): value is string => Boolean(value?.trim()))
  );

  if (terms.length === 0) return null;

  const matched = accessibleBrands.filter((brand) =>
    terms.some((term) => brandMatchesAlias(term, brand.name))
  );

  if (matched.length === 1) {
    return matched[0]!.id;
  }

  return null;
}
