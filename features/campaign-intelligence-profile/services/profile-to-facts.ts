import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { validateCampaignFacts } from "@/features/campaign-director/facts/validate-campaign-facts";

import type { CampaignIntelligenceProfile } from "../types/profile";
import {
  countryLabel,
  resolveCountryCode,
} from "./normalization/validators";

/**
 * Post-validation values win over raw extraction (the CIP contract: Studio and
 * Director read validatedIntelligence first). Raw fields remain the fallback
 * for legacy rows that predate validation.
 */
function resolveClientName(profile: CampaignIntelligenceProfile): string | undefined {
  return profile.validatedIntelligence?.brand.clientName ?? profile.clientName;
}

function resolveBrandName(profile: CampaignIntelligenceProfile): string | undefined {
  return profile.validatedIntelligence?.brand.brandName ?? profile.brandName;
}

function toCleanCountryLabels(values: string[] | undefined): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of values ?? []) {
    const code = resolveCountryCode(raw);
    if (!code) continue;
    const label = countryLabel(code);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

/** Market/country: validated country label first, then raw extraction chain. */
function resolveGeography(profile: CampaignIntelligenceProfile): string[] | undefined {
  const validatedLabel = profile.validatedIntelligence?.market.countryLabel?.trim();
  const raw = toCleanCountryLabels(
    profile.geography ??
      profile.audienceDetail?.countries ??
      (profile.market ? [profile.market] : undefined)
  );

  if (!validatedLabel) return raw.length > 0 ? raw : undefined;

  const merged = [validatedLabel];
  for (const region of raw) {
    if (region.toLowerCase() !== validatedLabel.toLowerCase()) {
      merged.push(region);
    }
  }
  return merged;
}

/** Compose a display audience from structured detail when no prose audience exists. */
function composeAudienceFromDetail(
  detail: CampaignIntelligenceProfile["audienceDetail"]
): string | undefined {
  if (!detail) return undefined;

  const parts: string[] = [];
  if (detail.gender?.trim()) {
    const gender = detail.gender.trim();
    parts.push(gender.charAt(0).toUpperCase() + gender.slice(1));
  }
  if (detail.ageMin != null && detail.ageMax != null) {
    parts.push(`${detail.ageMin}–${detail.ageMax}`);
  } else if (detail.ageMin != null) {
    parts.push(`${detail.ageMin}+`);
  } else if (detail.ageMax != null) {
    parts.push(`up to ${detail.ageMax}`);
  }
  if (detail.countries?.length) parts.push(detail.countries.join(", "));
  if (detail.languages?.length) parts.push(detail.languages.join(", "));

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Bridge CIP → legacy CampaignFacts consumers (Director, Studio sections). */
export function profileToCampaignFacts(
  profile: CampaignIntelligenceProfile
): CampaignFacts {
  const facts: CampaignFacts = {
    clientName: resolveClientName(profile),
    brandName: resolveBrandName(profile),
    industry: profile.industry,
    campaignType: profile.campaignType ?? profile.campaignName,
    product: profile.products?.length ? profile.products.join(", ") : undefined,
    objective:
      profile.objective ??
      (profile.objectives?.length ? profile.objectives.join(" · ") : undefined) ??
      profile.campaignName,
    budget: profile.budget,
    durationWeeks: profile.durationWeeks,
    geography: resolveGeography(profile),
    audience: profile.audience ?? composeAudienceFromDetail(profile.audienceDetail),
    platforms: profile.platforms,
    kpis: profile.kpis,
    deliverables: profile.deliverables,
    constraints: [
      ...(profile.requirements?.mandatory ?? []),
      ...(profile.constraints ?? []),
    ].filter(Boolean),
    risks: profile.risks,
    rawBriefExcerpt: profile.rawBriefExcerpt,
    extractedAt: profile.extractedAt,
    confidence: { ...profile.confidence },
    sources: { ...profile.sources },
  };

  return validateCampaignFacts(facts);
}

export function campaignFactsToProfilePatch(
  facts: CampaignFacts
): Partial<CampaignIntelligenceProfile> {
  return {
    ...facts,
    schemaVersion: 1,
    status: "saved",
  };
}
