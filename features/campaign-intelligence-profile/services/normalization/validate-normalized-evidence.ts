import type { CampaignIntelligenceProfile } from "../../types/profile";

import { briefMentionsCountry, isExplicitOrNormalized } from "./field-provenance";
import { countryLabel, pushIssue } from "./validators";
import type { ExtractionIssue, FieldProvenance, NormalizedCampaignEntities } from "./types";

const MIN_STRICT_CONFIDENCE = 0.65;

/** Fields that must never be populated from inferred evidence. */
const STRICT_EVIDENCE_KEYS = [
  "market.countryCode",
  "audience.countries",
  "audience.languages",
  "audience.gender",
  "audience.ageMin",
  "audience.ageMax",
  "platforms",
  "creator.followerMin",
  "creator.followerMax",
] as const;

function setEvidence(
  entities: NormalizedCampaignEntities,
  key: string,
  provenance: FieldProvenance
): void {
  entities.fieldEvidence[key] = provenance;
}

function clearStrictKey(entities: NormalizedCampaignEntities, key: string): void {
  switch (key) {
    case "market.countryCode":
      delete entities.market.countryCode;
      delete entities.market.countryLabel;
      break;
    case "audience.countries":
      entities.audience.countries = [];
      break;
    case "audience.languages":
      entities.audience.languages = [];
      break;
    case "audience.gender":
      delete entities.audience.gender;
      break;
    case "audience.ageMin":
      delete entities.audience.ageMin;
      break;
    case "audience.ageMax":
      delete entities.audience.ageMax;
      break;
    case "platforms":
      entities.platforms = [];
      break;
    case "creator.followerMin":
      delete entities.creator.followerMin;
      break;
    case "creator.followerMax":
      delete entities.creator.followerMax;
      break;
    default:
      break;
  }
  delete entities.fieldEvidence[key];
}

function hasStrictValue(entities: NormalizedCampaignEntities, key: string): boolean {
  switch (key) {
    case "market.countryCode":
      return Boolean(entities.market.countryCode);
    case "audience.countries":
      return entities.audience.countries.length > 0;
    case "audience.languages":
      return entities.audience.languages.length > 0;
    case "audience.gender":
      return entities.audience.gender != null && entities.audience.gender !== "any";
    case "audience.ageMin":
      return entities.audience.ageMin != null;
    case "audience.ageMax":
      return entities.audience.ageMax != null;
    case "platforms":
      return entities.platforms.length > 0;
    case "creator.followerMin":
      return entities.creator.followerMin != null;
    case "creator.followerMax":
      return entities.creator.followerMax != null;
    default:
      return false;
  }
}

function strictValueLabel(entities: NormalizedCampaignEntities, key: string): string {
  switch (key) {
    case "market.countryCode":
      return entities.market.countryLabel ?? entities.market.countryCode ?? "";
    case "audience.countries":
      return entities.audience.countries.map(countryLabel).join(", ");
    case "audience.languages":
      return entities.audience.languages.join(", ");
    case "audience.gender":
      return entities.audience.gender ?? "";
    case "audience.ageMin":
      return entities.audience.ageMin != null ? String(entities.audience.ageMin) : "";
    case "audience.ageMax":
      return entities.audience.ageMax != null ? String(entities.audience.ageMax) : "";
    case "platforms":
      return entities.platforms.join(", ");
    case "creator.followerMin":
      return entities.creator.followerMin != null ? String(entities.creator.followerMin) : "";
    case "creator.followerMax":
      return entities.creator.followerMax != null ? String(entities.creator.followerMax) : "";
    default:
      return "";
  }
}

function rejectStrictField(
  entities: NormalizedCampaignEntities,
  issues: ExtractionIssue[],
  key: string,
  rawValue: string,
  reason: string,
  kind: ExtractionIssue["kind"]
): void {
  if (!hasStrictValue(entities, key)) return;
  pushIssue(issues, key, rawValue, reason, "warning");
  issues[issues.length - 1]!.kind = kind;
  clearStrictKey(entities, key);
}

/**
 * Post-normalization validation: strip inferred/low-confidence strict fields,
 * block geographic expansion, and surface confirmation-required issues.
 */
export function validateNormalizedEvidence(
  profile: CampaignIntelligenceProfile,
  entities: NormalizedCampaignEntities,
  issues: ExtractionIssue[]
): { normalizedEntities: NormalizedCampaignEntities; extractionIssues: ExtractionIssue[] } {
  const nextIssues = [...issues];
  const next: NormalizedCampaignEntities = {
    ...entities,
    brand: { ...entities.brand },
    market: { ...entities.market, cities: [...entities.market.cities] },
    audience: {
      ...entities.audience,
      countries: [...entities.audience.countries],
      cities: [...entities.audience.cities],
      languages: [...entities.audience.languages],
    },
    creator: {
      ...entities.creator,
      niches: [...entities.creator.niches],
      creatorTypes: [...entities.creator.creatorTypes],
    },
    platforms: [...entities.platforms],
    categories: [...entities.categories],
    keywords: [...entities.keywords],
    fieldEvidence: { ...entities.fieldEvidence },
  };

  const briefText = profile.rawBriefExcerpt ?? "";

  for (const key of STRICT_EVIDENCE_KEYS) {
    const evidence = next.fieldEvidence[key];
    const valueLabel = strictValueLabel(next, key);

    if (!hasStrictValue(next, key)) continue;

    if (!evidence) {
      rejectStrictField(
        next,
        nextIssues,
        key,
        valueLabel,
        "Field could not be verified — please confirm in campaign requirements",
        "confirmation_required"
      );
      continue;
    }

    if (evidence.level === "inferred") {
      rejectStrictField(
        next,
        nextIssues,
        key,
        valueLabel,
        "Inferred value rejected — not saved as a campaign fact",
        "inferred_rejected"
      );
      continue;
    }

    if (evidence.confidence < MIN_STRICT_CONFIDENCE) {
      rejectStrictField(
        next,
        nextIssues,
        key,
        valueLabel,
        `Low confidence (${Math.round(evidence.confidence * 100)}%) — please confirm`,
        "confirmation_required"
      );
    }
  }

  if (briefText.trim() && next.audience.countries.length > 0) {
    const allowed = next.audience.countries.filter((code) => briefMentionsCountry(briefText, code));
    const removed = next.audience.countries.filter((code) => !allowed.includes(code));

    if (removed.length > 0) {
      for (const code of removed) {
        pushIssue(
          nextIssues,
          "audience.countries",
          countryLabel(code),
          "Country not mentioned in brief — removed to prevent geographic expansion",
          "warning"
        );
        nextIssues[nextIssues.length - 1]!.kind = "geographic_expansion";
      }
      next.audience.countries = allowed;

      if (
        next.market.countryCode &&
        !allowed.includes(next.market.countryCode) &&
        !briefMentionsCountry(briefText, next.market.countryCode)
      ) {
        pushIssue(
          nextIssues,
          "market.countryCode",
          countryLabel(next.market.countryCode),
          "Market not mentioned in brief — please confirm primary market",
          "warning"
        );
        nextIssues[nextIssues.length - 1]!.kind = "geographic_expansion";
        delete next.market.countryCode;
        delete next.market.countryLabel;
        delete next.fieldEvidence["market.countryCode"];
      } else if (!next.market.countryCode && allowed.length > 0) {
        next.market.countryCode = allowed[0];
        next.market.countryLabel = countryLabel(allowed[0]);
        setEvidence(next, "market.countryCode", {
          level: "normalized",
          confidence: next.fieldEvidence["audience.countries"]?.confidence ?? 0.8,
          sourceField: "audience.countries",
        });
      }
    }
  }

  return { normalizedEntities: next, extractionIssues: nextIssues };
}

/** Strip inferred strict fields from raw profile before persistence. */
export function stripInferredStrictFacts(
  profile: CampaignIntelligenceProfile
): CampaignIntelligenceProfile {
  const next = { ...profile };

  if (profile.sources?.geography === "inferred" || profile.sources?.geography === "default") {
    delete next.geography;
    delete next.market;
  }
  if (profile.sources?.platforms === "inferred" || profile.sources?.platforms === "default") {
    delete next.platforms;
  }
  if (profile.sources?.audience === "inferred" || profile.sources?.audience === "default") {
    delete next.audience;
    if (next.audienceDetail) {
      next.audienceDetail = { ...next.audienceDetail };
      delete next.audienceDetail.gender;
      delete next.audienceDetail.ageMin;
      delete next.audienceDetail.ageMax;
      delete next.audienceDetail.countries;
      delete next.audienceDetail.languages;
    }
  }

  return next;
}

export type EvidenceReviewRow = {
  key: string;
  label: string;
  value: string;
  provenance?: FieldProvenance;
};

export function buildEvidenceReviewRows(
  entities?: NormalizedCampaignEntities
): EvidenceReviewRow[] {
  if (!entities) return [];

  const rows: EvidenceReviewRow[] = [];
  const add = (key: string, label: string, value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    rows.push({
      key,
      label,
      value: trimmed,
      provenance: entities.fieldEvidence[key],
    });
  };

  add("brand.brandName", "Brand", entities.brand.brandName);
  add("market.countryCode", "Primary market", entities.market.countryLabel ?? entities.market.countryCode);
  add(
    "audience.countries",
    "Audience countries",
    entities.audience.countries.map(countryLabel).join(", ")
  );
  add("audience.gender", "Audience gender", entities.audience.gender);
  if (entities.audience.ageMin != null || entities.audience.ageMax != null) {
    add(
      "audience.ageMin",
      "Audience age",
      `${entities.audience.ageMin ?? "?"}–${entities.audience.ageMax ?? "?"}`
    );
  }
  add("audience.languages", "Languages", entities.audience.languages.join(", "));
  add("platforms", "Platforms", entities.platforms.join(", "));
  if (entities.creator.followerMin != null || entities.creator.followerMax != null) {
    add(
      "creator.followerMin",
      "Follower range",
      `${entities.creator.followerMin ?? "?"}–${entities.creator.followerMax ?? "?"}`
    );
  }
  add("categories", "Categories", entities.categories.join(", "));
  add("creator.niches", "Creator niches", entities.creator.niches.join(", "));
  add("keywords", "Keywords", entities.keywords.join(", "));

  return rows;
}

export { isExplicitOrNormalized, MIN_STRICT_CONFIDENCE };
