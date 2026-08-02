/**
 * Enterprise Constraint Engine — Release 2.3 Final Stabilization.
 *
 * Mandatory constraints MUST NEVER be relaxed.
 * Preferred constraints may be progressively relaxed with an explicit report.
 *
 * Does not redesign Discovery architecture — hardens the existing CIP dual-pool path.
 */

import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import { creatorMatchesDiscoveryBrowseFilters } from "@/lib/creators/discovery-browse-filters";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type ConstraintTier = "mandatory" | "preferred";

export type EnterpriseConstraint = {
  key: string;
  value: string;
  label: string;
  tier: ConstraintTier;
  weight: number;
};

export type ConstraintRelaxationEvent = {
  key: string;
  value: string;
  label: string;
  reason: string;
  businessImpact: string;
};

export type EnterpriseConstraintPlan = {
  mandatory: EnterpriseConstraint[];
  preferred: EnterpriseConstraint[];
};

/** Keys that are always mandatory when present on the mapped filter set. */
export const MANDATORY_DISCOVERY_FILTER_KEYS = new Set([
  "creator_country",
  "audience_country",
  "platform",
  "language",
  "brand_safety_min",
  "blacklist",
  "legal",
]);

const PREFERRED_KEYS = new Set([
  "category",
  "niche",
  "engagement_min",
  "engagement_max",
  "follower_min",
  "follower_max",
  "content_keyword",
  "content_tag",
  "brand_fit_min",
  "creator_city",
  "audience_city",
  "audience_gender",
  "audience_age_min",
  "audience_age_max",
  "verified",
]);

function normalizeConstraintValue(key: string, value: string): string {
  const trimmed = value.trim();
  if (key === "creator_country" || key === "audience_country") {
    return normalizeCountryCode(resolveCountryCode(trimmed)) ?? trimmed.toUpperCase();
  }
  if (key === "platform") {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

/**
 * Classify CIP → Discovery mapped filters into mandatory vs preferred.
 * Language / brand safety are mandatory when present (Product rule).
 */
export function classifyEnterpriseConstraints(
  mappedFilters: DiscoveryMappedFilter[]
): EnterpriseConstraintPlan {
  const mandatory: EnterpriseConstraint[] = [];
  const preferred: EnterpriseConstraint[] = [];
  const seen = new Set<string>();

  for (const filter of mappedFilters) {
    const value = normalizeConstraintValue(filter.key, filter.value);
    if (!value) continue;
    const dedupeKey = `${filter.key}:${value.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const constraint: EnterpriseConstraint = {
      key: filter.key,
      value,
      label: filter.label,
      tier: MANDATORY_DISCOVERY_FILTER_KEYS.has(filter.key) ? "mandatory" : "preferred",
      weight: filter.weight,
    };

    if (constraint.tier === "mandatory") {
      mandatory.push(constraint);
    } else if (PREFERRED_KEYS.has(filter.key) || filter.weight < 90) {
      preferred.push({ ...constraint, tier: "preferred" });
    } else {
      preferred.push({ ...constraint, tier: "preferred" });
    }
  }

  return { mandatory, preferred };
}

function creatorMatchesCountry(
  creator: UnifiedCreatorResult,
  code: string,
  mode: "creator" | "audience"
): boolean {
  return creatorMatchesDiscoveryBrowseFilters(creator, {
    creatorCountries: mode === "creator" ? [code] : undefined,
    audienceCountries: mode === "audience" ? [code] : undefined,
  });
}

function creatorMatchesPlatform(creator: UnifiedCreatorResult, platform: string): boolean {
  const target = platform.toLowerCase();
  return creator.platforms.some((p) => p.platform?.toLowerCase() === target);
}

function creatorMatchesLanguage(creator: UnifiedCreatorResult, language: string): boolean {
  const target = language.trim().toLowerCase();
  if (!target) return true;
  const codes = (creator.language_codes ?? []).map((c) => c.toLowerCase());
  if (codes.length === 0) return false;
  return codes.some((c) => c === target || c.startsWith(target) || target.startsWith(c));
}

function creatorMatchesBrandSafety(
  creator: UnifiedCreatorResult,
  minRaw: string
): boolean {
  const min = Number(minRaw);
  if (!Number.isFinite(min)) return true;
  const score = creator.authenticity_score;
  if (score == null) return false;
  return score >= min;
}

/** Returns true when the creator satisfies every mandatory constraint. */
export function creatorSatisfiesMandatoryConstraints(
  creator: UnifiedCreatorResult,
  mandatory: EnterpriseConstraint[]
): boolean {
  if (mandatory.length === 0) return true;

  const countriesCreator = mandatory
    .filter((c) => c.key === "creator_country")
    .map((c) => c.value);
  const countriesAudience = mandatory
    .filter((c) => c.key === "audience_country")
    .map((c) => c.value);
  const platforms = mandatory.filter((c) => c.key === "platform").map((c) => c.value);
  const languages = mandatory.filter((c) => c.key === "language").map((c) => c.value);
  const brandSafety = mandatory.filter((c) => c.key === "brand_safety_min");

  if (countriesCreator.length > 0) {
    const ok = countriesCreator.some((code) =>
      creatorMatchesCountry(creator, code, "creator")
    );
    if (!ok) return false;
  }

  if (countriesAudience.length > 0) {
    const ok = countriesAudience.some((code) =>
      creatorMatchesCountry(creator, code, "audience")
    );
    if (!ok) return false;
  }

  if (platforms.length > 0) {
    const ok = platforms.some((p) => creatorMatchesPlatform(creator, p));
    if (!ok) return false;
  }

  if (languages.length > 0) {
    const ok = languages.some((lang) => creatorMatchesLanguage(creator, lang));
    if (!ok) return false;
  }

  for (const bs of brandSafety) {
    if (!creatorMatchesBrandSafety(creator, bs.value)) return false;
  }

  // blacklist / legal — reserved keys; when values appear they must match exclusion lists
  // (no silent pass). Until populated in mapping, presence of empty values is ignored.
  for (const constraint of mandatory) {
    if (constraint.key === "blacklist" || constraint.key === "legal") {
      const needle = constraint.value.toLowerCase();
      if (!needle) continue;
      const hay = [
        creator.display_name,
        creator.bio,
        ...(creator.categories ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(needle)) return false;
    }
  }

  return true;
}

function creatorMissesPreferred(
  creator: UnifiedCreatorResult,
  preferred: EnterpriseConstraint
): boolean {
  switch (preferred.key) {
    case "category":
    case "niche":
      return !creatorMatchesDiscoveryBrowseFilters(creator, {
        categories: [preferred.value],
      });
    case "engagement_min": {
      const min = Number(preferred.value);
      if (!Number.isFinite(min)) return false;
      const er =
        creator.metrics?.engagement_rate?.value ??
        creator.platforms[0]?.engagement_rate ??
        null;
      return er == null || er < min;
    }
    case "follower_min": {
      const min = Number(preferred.value);
      if (!Number.isFinite(min)) return false;
      const followers =
        creator.metrics?.followers?.value ??
        creator.platforms[0]?.follower_count ??
        null;
      return followers == null || followers < min;
    }
    default:
      return false;
  }
}

export type ApplyEnterpriseConstraintsResult = {
  creators: UnifiedCreatorResult[];
  rejectedMandatoryCount: number;
  relaxations: ConstraintRelaxationEvent[];
  mandatory: EnterpriseConstraint[];
  preferred: EnterpriseConstraint[];
};

/**
 * Hard-filter mandatory violators, then record preferred relaxations when
 * the surviving slate does not satisfy preferred constraints for all creators.
 */
export function applyEnterpriseConstraints(
  creators: UnifiedCreatorResult[],
  mappedFilters: DiscoveryMappedFilter[]
): ApplyEnterpriseConstraintsResult {
  const { mandatory, preferred } = classifyEnterpriseConstraints(mappedFilters);

  const compliant = creators.filter((creator) =>
    creatorSatisfiesMandatoryConstraints(creator, mandatory)
  );
  const rejectedMandatoryCount = creators.length - compliant.length;

  const relaxations: ConstraintRelaxationEvent[] = [];
  for (const pref of preferred) {
    const missCount = compliant.filter((c) => creatorMissesPreferred(c, pref)).length;
    if (missCount === 0) continue;
    if (missCount < compliant.length) {
      // Partial satisfaction — not a full relaxation event
      continue;
    }
    relaxations.push({
      key: pref.key,
      value: pref.value,
      label: pref.label,
      reason: `No mandatory-compliant creators satisfied preferred constraint "${pref.label}" (${pref.value}).`,
      businessImpact:
        "Recommendation quality may be weaker on this dimension; mandatory market/platform gates still hold.",
    });
  }

  return {
    creators: compliant,
    rejectedMandatoryCount,
    relaxations,
    mandatory,
    preferred,
  };
}
