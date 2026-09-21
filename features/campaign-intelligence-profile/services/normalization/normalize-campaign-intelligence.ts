import { normalizeInfluencerTier } from "@/lib/creators/influencer-tier";
import type { CampaignIntelligenceProfile } from "../../types/profile";
import type { DiscoveryCampaignRequirements } from "../discovery-campaign-requirements";

import {
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
  isValidClientName,
  recoverLabeledEntityFromText,
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
    excerpt: raw?.excerpt,
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
    excerpt: raw?.excerpt,
  };
}

export function normalizeRequirementLanguage(raw: string): string | null {
  const aliases: Record<string, string> = { arabic: "ar", english: "en", french: "fr", spanish: "es", german: "de", turkish: "tr", hindi: "hi", urdu: "ur", العربية: "ar", عربي: "ar" };
  const value = raw.trim().toLowerCase();
  return aliases[value] ?? (/^[a-z]{2}$/.test(value) ? value : null);
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
  let brandName =
    sanitizedBrand && isValidBrandName(sanitizedBrand) ? sanitizedBrand : undefined;
  const sanitizedClient = rawClient ? sanitizeBrandName(rawClient) : undefined;
  let clientName =
    sanitizedClient && isValidClientName(sanitizedClient) ? sanitizedClient : undefined;
  if (rawClient && !clientName) {
    pushIssue(
      issues,
      "clientName",
      rawClient,
      "Rejected as sentence fragment or invalid client name",
      "warning"
    );
    issues[issues.length - 1]!.kind = "malformed";
  }

  // Explicitly labeled entities in the brief text are authoritative — recover
  // them when extraction missed or mangled the value (never infer over them).
  const briefText = [profile.structuredBrief?.llmBriefText, profile.rawBriefExcerpt]
    .filter(Boolean)
    .join("\n");
  let clientRecovered = false;
  let brandRecovered = false;
  if (!clientName && briefText) {
    const recovered = recoverLabeledEntityFromText(briefText, "client");
    if (recovered) {
      clientName = recovered;
      clientRecovered = true;
    }
  }
  if (!brandName && briefText) {
    const recovered = recoverLabeledEntityFromText(briefText, "brand");
    if (recovered) {
      brandName = recovered;
      brandRecovered = true;
    }
  }
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
      brandRecovered
        ? { level: "normalized", confidence: 0.9, sourceField: "structuredBrief.brand" }
        : rawBrand !== brandName
          ? normalizedProvenance(profile, "brandName")
          : extractedProvenance(profile, "brandName")
    );
  }
  if (clientName) {
    normalized.brand.clientName = clientName;
    setEvidence(
      normalized,
      "brand.clientName",
      clientRecovered
        ? { level: "normalized", confidence: 0.9, sourceField: "structuredBrief.client" }
        : rawClient !== clientName
          ? normalizedProvenance(profile, "clientName")
          : extractedProvenance(profile, "clientName")
    );
  }

  // Market and audience are independent; neither implies creator requirements.
  for (const raw of [profile.market, ...(profile.geography ?? [])]) {
    if (raw && !resolveCountryCode(raw)) pushIssue(issues, "market", raw, "Could not resolve campaign market", "warning");
  }
  const marketRaw = [profile.market, ...(profile.geography ?? [])].find(v => v && resolveCountryCode(v));
  if (marketRaw) {
    const code = resolveCountryCode(marketRaw);
    const provenance = extractedProvenance(profile, profile.market ? "market" : "geography");
    if (code && provenance.level !== "inferred") {
      normalized.market.countryCode = code;
      normalized.market.countryLabel = countryLabel(code);
      setEvidence(normalized, "market.countryCode", provenance);
    }
  }
  for (const raw of profile.audienceDetail?.countries ?? []) {
    const code = resolveCountryCode(raw);
    const provenance = extractedProvenance(profile, "audienceDetail.countries");
    if (code && provenance.level !== "inferred") {
      if (!normalized.audience.countries.includes(code)) normalized.audience.countries.push(code);
      setEvidence(normalized, "audience.countries", provenance);
    }
  }
  for (const [field, rawValues, target, resolve] of [
    ["creatorRequirements.countries", profile.creatorRequirements?.countries, "countries", resolveCountryCode],
    ["creatorRequirements.languages", profile.creatorRequirements?.languages, "languages", normalizeRequirementLanguage],
    ["contentLanguages", profile.contentLanguages, "contentLanguages", normalizeRequirementLanguage],
    ["creatorRequirements.tiers", profile.creatorRequirements?.tiers, "tiers", (v: string) => normalizeInfluencerTier(v)?.toLowerCase() ?? null],
  ] as const) {
    if (!rawValues?.length) continue;
    const provenance = getFieldProvenance(profile, field);
    if (!provenance || provenance.level === "inferred" || provenance.confidence < 0.65 || !provenance.excerpt) {
      pushIssue(issues, field, rawValues.join(", "), "Explicit requirement evidence needed — review before search", "warning");
      continue;
    }
    const accepted = rawValues.map(resolve).filter((v): v is string => Boolean(v));
    normalized.creator[target] = [...new Set(accepted)];
    setEvidence(normalized, `creator.${target}`, { ...provenance, sourceField: field });
    if (accepted.length !== rawValues.length) pushIssue(issues, field, rawValues.join(", "), "Unrecognized requirement value — review before search", "warning");
  }
  const creatorGender = profile.creatorRequirements?.gender;
  const genderEvidence = getFieldProvenance(profile, "creatorRequirements.gender");
  if (creatorGender && genderEvidence?.excerpt && genderEvidence.level !== "inferred" && genderEvidence.confidence >= 0.65) {
    normalized.creator.gender = normalizeGender(creatorGender) ?? undefined;
    setEvidence(normalized, "creator.gender", genderEvidence);
  }
  const er = profile.creatorRequirements?.engagementMin;
  const erEvidence = getFieldProvenance(profile, "creatorRequirements.engagementMin");
  if (er != null && Number.isFinite(er) && er >= 0 && er <= 100 && erEvidence?.excerpt && erEvidence.level !== "inferred" && erEvidence.confidence >= 0.65) {
    normalized.creator.engagementMin = er;
    setEvidence(normalized, "creator.engagementMin", erEvidence);
  }

  for (const city of profile.audienceDetail?.cities ?? []) {
    if (isValidCity(city)) {
      normalized.audience.cities.push(city.trim());
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
    ...(profile.keywords ?? []),
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
  if (profile.fieldProvenance?.keywords) setEvidence(normalized, "keywords", profile.fieldProvenance.keywords);

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
