import type { CampaignIntelligenceProfile } from "../../types/profile";
import type { DiscoveryCampaignRequirements } from "../discovery-campaign-requirements";

import {
  buildFieldProvenanceFromProfile,
  getFieldProvenance,
  userConfirmedProvenance,
} from "./field-provenance";
import {
  canonicalizeCategory,
  countryLabel,
  isValidCategory,
  isValidCity,
  isValidKeyword,
  isValidNiche,
  normalizeGender,
  normalizePlatform,
  parseFollowerRange,
  pushIssue,
  resolveCountryCode,
  sanitizeBrandName,
  isValidBrandName,
} from "./validators";
import {
  createEmptyNormalizedEntities,
  type BrandSafetyLevel,
  type EvidenceLevel,
  type ExtractionIssue,
  type FieldProvenance,
  type NormalizedCampaignEntities,
} from "./types";

function normalizeBrandSafety(raw?: string): BrandSafetyLevel {
  if (raw === "required" || raw === "preferred" || raw === "none") return raw;
  return "none";
}

function setEvidence(
  entities: NormalizedCampaignEntities,
  key: string,
  provenance: FieldProvenance
): void {
  entities.fieldEvidence[key] = provenance;
}

function normalizedProvenance(
  profile: CampaignIntelligenceProfile,
  sourceField: string,
  confidence?: number
): FieldProvenance {
  const raw = getFieldProvenance(profile, sourceField);
  const baseConfidence = confidence ?? raw?.confidence ?? 0.85;
  const level: EvidenceLevel =
    raw?.level === "inferred" ? "inferred" : raw ? "normalized" : "extracted";
  return {
    level: level === "inferred" ? "inferred" : "normalized",
    confidence: level === "inferred" ? baseConfidence : Math.min(0.95, baseConfidence + 0.05),
    sourceField,
  };
}

function extractedProvenance(
  profile: CampaignIntelligenceProfile,
  sourceField: string
): FieldProvenance {
  const raw = getFieldProvenance(profile, sourceField);
  return {
    level: raw?.level === "inferred" ? "inferred" : "extracted",
    confidence: raw?.confidence ?? 0.85,
    sourceField,
  };
}

function collectExplicitCountryCandidates(
  profile: CampaignIntelligenceProfile
): Array<{ value: string; field: string; provenance: FieldProvenance }> {
  buildFieldProvenanceFromProfile(profile);
  const candidates: Array<{ value: string; field: string; provenance: FieldProvenance }> = [];

  const push = (value: string | undefined, field: string) => {
    if (!value?.trim()) return;
    const provenance = extractedProvenance(profile, field);
    if (provenance.level === "inferred") return;
    candidates.push({ value: value.trim(), field, provenance });
  };

  push(profile.market, "market");
  for (const g of profile.geography ?? []) {
    candidates.push({
      value: g,
      field: "geography",
      provenance: extractedProvenance(profile, "geography"),
    });
  }
  for (const c of profile.audienceDetail?.countries ?? []) {
    candidates.push({
      value: c,
      field: "audienceDetail.countries",
      provenance: extractedProvenance(profile, "audienceDetail.countries"),
    });
  }

  return candidates.filter((c) => c.provenance.level !== "inferred");
}

/**
 * Normalize raw extracted CIP fields into canonical searchable entities.
 * Rejected values are reported via extractionIssues — never passed to Discovery.
 */
export function normalizeCampaignIntelligence(
  profile: CampaignIntelligenceProfile
): { normalizedEntities: NormalizedCampaignEntities; extractionIssues: ExtractionIssue[] } {
  const issues: ExtractionIssue[] = [];
  const normalized = createEmptyNormalizedEntities();

  const rawBrand = profile.brandName?.trim();
  const rawClient = profile.clientName?.trim();
  const sanitizedBrand = rawBrand ? sanitizeBrandName(rawBrand) : undefined;
  const brandName =
    sanitizedBrand && isValidBrandName(sanitizedBrand) ? sanitizedBrand : undefined;
  const clientName = rawClient ? sanitizeBrandName(rawClient) : undefined;
  if (rawBrand && brandName && brandName !== rawBrand) {
    pushIssue(
      issues,
      "brandName",
      rawBrand,
      "Removed field-label text merged into brand name",
      "warning"
    );
    issues[issues.length - 1]!.kind = "malformed";
  }
  if (rawBrand && !brandName) {
    pushIssue(
      issues,
      "brandName",
      rawBrand,
      "Rejected as sentence fragment or invalid brand name",
      "warning"
    );
    issues[issues.length - 1]!.kind = "malformed";
  }
  if (brandName) {
    normalized.brand.brandName = brandName;
    setEvidence(
      normalized,
      "brand.brandName",
      rawBrand !== brandName
        ? normalizedProvenance(profile, "brandName")
        : extractedProvenance(profile, "brandName")
    );
  }
  if (clientName) {
    normalized.brand.clientName = clientName;
    setEvidence(normalized, "brand.clientName", extractedProvenance(profile, "clientName"));
  }

  const resolvedCountries = new Map<string, { raw: string; provenance: FieldProvenance }>();
  for (const { value, field, provenance } of collectExplicitCountryCandidates(profile)) {
    const code = resolveCountryCode(value);
    if (code) {
      const existing = resolvedCountries.get(code);
      if (!existing || provenance.confidence > existing.provenance.confidence) {
        resolvedCountries.set(code, { raw: value, provenance: normalizedProvenance(profile, field) });
      }
    } else {
      pushIssue(issues, field, value, "Could not resolve to a valid country code");
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  const countryCodes = [...resolvedCountries.keys()];
  if (countryCodes.length > 0) {
    normalized.audience.countries = [...countryCodes];
    const primary = resolvedCountries.get(countryCodes[0])!;
    normalized.market.countryCode = countryCodes[0];
    normalized.market.countryLabel = countryLabel(countryCodes[0]);
    setEvidence(normalized, "market.countryCode", primary.provenance);
    setEvidence(normalized, "audience.countries", {
      level: "normalized",
      confidence: Math.max(...[...resolvedCountries.values()].map((v) => v.provenance.confidence)),
      sourceField: "geography",
    });
  }

  if (profile.market?.trim()) {
    const marketCode = resolveCountryCode(profile.market);
    const marketProv = extractedProvenance(profile, "market");
    if (marketCode && marketProv.level !== "inferred") {
      normalized.market.countryCode = marketCode;
      normalized.market.countryLabel = countryLabel(marketCode);
      setEvidence(normalized, "market.countryCode", normalizedProvenance(profile, "market"));
      if (!normalized.audience.countries.includes(marketCode)) {
        normalized.audience.countries.unshift(marketCode);
      }
    }
  }

  for (const city of profile.audienceDetail?.cities ?? []) {
    if (isValidCity(city)) {
      normalized.audience.cities.push(city.trim());
      if (!normalized.market.cities.includes(city.trim())) {
        normalized.market.cities.push(city.trim());
      }
    } else {
      pushIssue(issues, "audienceDetail.cities", city, "Invalid city name");
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  if (profile.audienceDetail?.gender) {
    const genderProv = extractedProvenance(profile, "audienceDetail.gender");
    const gender = normalizeGender(profile.audienceDetail.gender);
    if (gender && genderProv.level !== "inferred") {
      normalized.audience.gender = gender;
      setEvidence(normalized, "audience.gender", normalizedProvenance(profile, "audienceDetail.gender"));
    } else if (genderProv.level === "inferred") {
      pushIssue(
        issues,
        "audienceDetail.gender",
        profile.audienceDetail.gender,
        "Inferred gender rejected — please confirm",
        "warning"
      );
      issues[issues.length - 1]!.kind = "inferred_rejected";
    } else {
      pushIssue(
        issues,
        "audienceDetail.gender",
        profile.audienceDetail.gender,
        "Gender must be female, male, or any"
      );
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  const ageProv = extractedProvenance(profile, "audienceDetail.age");
  if (ageProv.level !== "inferred") {
    if (profile.audienceDetail?.ageMin != null && profile.audienceDetail.ageMin >= 13) {
      normalized.audience.ageMin = profile.audienceDetail.ageMin;
      setEvidence(normalized, "audience.ageMin", normalizedProvenance(profile, "audienceDetail.age"));
    }
    if (profile.audienceDetail?.ageMax != null && profile.audienceDetail.ageMax <= 80) {
      normalized.audience.ageMax = profile.audienceDetail.ageMax;
      setEvidence(normalized, "audience.ageMax", normalizedProvenance(profile, "audienceDetail.age"));
    }
  }

  for (const lang of profile.audienceDetail?.languages ?? []) {
    const trimmed = lang.trim();
    const langProv = extractedProvenance(profile, "audienceDetail.languages");
    if (langProv.level === "inferred") continue;
    if (trimmed.length >= 2 && trimmed.length <= 40) {
      normalized.audience.languages.push(trimmed);
      setEvidence(normalized, "audience.languages", normalizedProvenance(profile, "audienceDetail.languages"));
    } else if (trimmed) {
      pushIssue(issues, "audienceDetail.languages", lang, "Invalid language code or name");
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  const platformProv = extractedProvenance(profile, "platforms");
  if (platformProv.level !== "inferred") {
    for (const raw of profile.platforms ?? []) {
      const platform = normalizePlatform(raw);
      if (platform && !normalized.platforms.includes(platform)) {
        normalized.platforms.push(platform);
      } else if (raw.trim()) {
        pushIssue(
          issues,
          "platforms",
          raw,
          "Unsupported platform; use instagram, tiktok, youtube, or twitter"
        );
        issues[issues.length - 1]!.kind = "malformed";
      }
    }
    if (normalized.platforms.length > 0) {
      setEvidence(normalized, "platforms", normalizedProvenance(profile, "platforms"));
    }
  } else if ((profile.platforms ?? []).length > 0) {
    pushIssue(
      issues,
      "platforms",
      (profile.platforms ?? []).join(", "),
      "Inferred platforms rejected — please confirm",
      "warning"
    );
    issues[issues.length - 1]!.kind = "inferred_rejected";
  }

  for (const raw of profile.creatorCategories ?? []) {
    const range = parseFollowerRange(raw);
    if (range) {
      const catProv = extractedProvenance(profile, "creatorCategories");
      if (catProv.level !== "inferred") {
        if (range.min != null) {
          normalized.creator.followerMin = range.min;
          setEvidence(normalized, "creator.followerMin", normalizedProvenance(profile, "creatorCategories"));
        }
        if (range.max != null) {
          normalized.creator.followerMax = range.max;
          setEvidence(normalized, "creator.followerMax", normalizedProvenance(profile, "creatorCategories"));
        }
      }
      continue;
    }
    if (/follower/i.test(raw)) {
      pushIssue(issues, "creatorCategories", raw, "Could not parse follower range");
      issues[issues.length - 1]!.kind = "malformed";
      continue;
    }
    const category = canonicalizeCategory(raw);
    if (category) {
      if (!normalized.categories.includes(category)) normalized.categories.push(category);
    } else {
      pushIssue(issues, "creatorCategories", raw, "Invalid category — not a searchable creator category");
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  for (const raw of profile.creatorNiches ?? []) {
    if (parseFollowerRange(raw)) continue;
    if (isValidNiche(raw)) {
      const niche = raw.trim();
      if (!normalized.creator.niches.includes(niche)) normalized.creator.niches.push(niche);
    } else if (isValidCategory(raw)) {
      const category = canonicalizeCategory(raw);
      if (category && !normalized.categories.includes(category)) normalized.categories.push(category);
    } else {
      pushIssue(issues, "creatorNiches", raw, "Invalid niche or category value");
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  const keywordCandidates = [
    ...(profile.products ?? []),
    ...(profile.contentStyle ?? []),
    ...normalized.creator.niches.filter((n) => n.split(/\s+/).length <= 3),
  ];
  for (const raw of keywordCandidates) {
    if (isValidKeyword(raw) && !normalized.keywords.includes(raw.trim())) {
      normalized.keywords.push(raw.trim());
    } else if (raw.trim() && !isValidNiche(raw)) {
      pushIssue(issues, "keywords", raw, "Invalid keyword", "warning");
      issues[issues.length - 1]!.kind = "malformed";
    }
  }

  normalized.brandSafety = normalizeBrandSafety(profile.brandSafetyLevel);

  return { normalizedEntities: normalized, extractionIssues: issues };
}

/** Build normalized entities from Discovery requirements form edits (user-confirmed). */
export function normalizedEntitiesFromDiscoveryRequirements(
  req: DiscoveryCampaignRequirements
): NormalizedCampaignEntities {
  const normalized = createEmptyNormalizedEntities();
  const confirmed = userConfirmedProvenance();

  if (req.brandName.trim()) {
    normalized.brand.brandName = req.brandName.trim();
    setEvidence(normalized, "brand.brandName", confirmed);
  }
  if (req.clientName.trim()) {
    normalized.brand.clientName = req.clientName.trim();
    setEvidence(normalized, "brand.clientName", confirmed);
  }

  if (req.marketCountry) {
    const code = resolveCountryCode(req.marketCountry);
    if (code) {
      normalized.market.countryCode = code;
      normalized.market.countryLabel = countryLabel(code);
      setEvidence(normalized, "market.countryCode", confirmed);
    }
  }

  for (const raw of req.audienceCountries) {
    const code = resolveCountryCode(raw);
    if (code && !normalized.audience.countries.includes(code)) {
      normalized.audience.countries.push(code);
    }
  }
  if (normalized.audience.countries.length > 0) {
    setEvidence(normalized, "audience.countries", confirmed);
  }
  if (
    normalized.market.countryCode &&
    !normalized.audience.countries.includes(normalized.market.countryCode)
  ) {
    normalized.audience.countries.unshift(normalized.market.countryCode);
  }

  const gender = req.audienceGender ? normalizeGender(req.audienceGender) : null;
  if (gender && gender !== "any") {
    normalized.audience.gender = gender;
    setEvidence(normalized, "audience.gender", confirmed);
  }

  if (req.audienceAgeMin) {
    normalized.audience.ageMin = Number(req.audienceAgeMin);
    setEvidence(normalized, "audience.ageMin", confirmed);
  }
  if (req.audienceAgeMax) {
    normalized.audience.ageMax = Number(req.audienceAgeMax);
    setEvidence(normalized, "audience.ageMax", confirmed);
  }

  for (const raw of req.platforms) {
    const platform = normalizePlatform(raw);
    if (platform && !normalized.platforms.includes(platform)) normalized.platforms.push(platform);
  }
  if (normalized.platforms.length > 0) setEvidence(normalized, "platforms", confirmed);

  for (const raw of req.categories) {
    const category = canonicalizeCategory(raw);
    if (category && !normalized.categories.includes(category)) normalized.categories.push(category);
  }

  for (const raw of req.creatorNiches) {
    if (isValidNiche(raw) && !normalized.creator.niches.includes(raw.trim())) {
      normalized.creator.niches.push(raw.trim());
    }
  }

  if (req.followerMin) {
    normalized.creator.followerMin = Number(req.followerMin);
    setEvidence(normalized, "creator.followerMin", confirmed);
  }
  if (req.followerMax) {
    normalized.creator.followerMax = Number(req.followerMax);
    setEvidence(normalized, "creator.followerMax", confirmed);
  }

  for (const raw of req.keywords) {
    if (isValidKeyword(raw) && !normalized.keywords.includes(raw.trim())) {
      normalized.keywords.push(raw.trim());
    }
  }

  return normalized;
}
