import type { CampaignFactsSource } from "@/features/campaign-director/facts/campaign-facts-types";

import type { CampaignIntelligenceProfile } from "../../types/profile";

import { countryLabel } from "./validators";
import type { EvidenceLevel, FieldProvenance } from "./types";

const COUNTRY_TEXT_ALIASES: Record<string, string[]> = {
  AE: ["uae", "united arab emirates", "dubai", "abu dhabi"],
  SA: ["ksa", "saudi arabia", "saudi"],
  EG: ["egypt", "egyptian"],
  QA: ["qatar"],
  KW: ["kuwait"],
  JO: ["jordan"],
  LB: ["lebanon"],
  US: ["united states", "usa", "u.s."],
  GB: ["united kingdom", "uk", "britain"],
  FR: ["france"],
  DE: ["germany"],
  IN: ["india"],
};

export function sourceToEvidenceLevel(source?: CampaignFactsSource): EvidenceLevel {
  if (source === "brief") return "extracted";
  return "inferred";
}

export function provenanceFromSource(
  source: CampaignFactsSource,
  confidence: number
): FieldProvenance {
  return {
    level: sourceToEvidenceLevel(source),
    confidence,
  };
}

/** Build field-level provenance from legacy CampaignFacts sources/confidence maps. */
export function buildFieldProvenanceFromProfile(
  profile: CampaignIntelligenceProfile
): Record<string, FieldProvenance> {
  if (profile.fieldProvenance && Object.keys(profile.fieldProvenance).length > 0) {
    return { ...profile.fieldProvenance };
  }

  const provenance: Record<string, FieldProvenance> = {};
  const add = (key: string, source?: CampaignFactsSource, confidence?: number) => {
    if (!source || confidence == null) return;
    provenance[key] = provenanceFromSource(source, confidence);
  };

  const sources = profile.sources ?? {};
  const confidence = profile.confidence ?? {};

  for (const [key, source] of Object.entries(sources)) {
    add(key, source, confidence[key as keyof typeof confidence] ?? 0.7);
  }

  if (profile.audienceDetail?.gender) {
    add("audienceDetail.gender", sources.audience ?? "brief", confidence.audience ?? 0.8);
  }
  if (profile.audienceDetail?.ageMin != null || profile.audienceDetail?.ageMax != null) {
    add("audienceDetail.age", sources.audience ?? "brief", confidence.audience ?? 0.8);
  }
  if (profile.audienceDetail?.countries?.length) {
    add(
      "audienceDetail.countries",
      sources.geography ?? sources.audience ?? "brief",
      confidence.geography ?? confidence.audience ?? 0.8
    );
  }
  if (profile.audienceDetail?.languages?.length) {
    add("audienceDetail.languages", "brief", 0.8);
  }
  if (profile.market) {
    add("market", sources.geography ?? "brief", confidence.geography ?? 0.85);
  }
  if (profile.creatorCategories?.length) {
    add("creatorCategories", "brief", 0.85);
  }
  if (profile.creatorNiches?.length) {
    add("creatorNiches", "brief", 0.85);
  }

  return provenance;
}

export function getFieldProvenance(
  profile: CampaignIntelligenceProfile,
  field: string
): FieldProvenance | undefined {
  return buildFieldProvenanceFromProfile(profile)[field];
}

export function isExplicitOrNormalized(provenance?: FieldProvenance): boolean {
  return provenance?.level === "extracted" || provenance?.level === "normalized";
}

export function briefMentionsCountry(briefText: string, countryCode: string): boolean {
  const lower = briefText.toLowerCase();
  const label = countryLabel(countryCode).toLowerCase();
  if (lower.includes(label)) return true;
  if (lower.includes(countryCode.toLowerCase())) return true;
  return (COUNTRY_TEXT_ALIASES[countryCode] ?? []).some((alias) => lower.includes(alias));
}

export function attachLlmFieldProvenance(
  profile: CampaignIntelligenceProfile,
  extractedFields: string[],
  fieldConfidence?: Record<string, number>
): CampaignIntelligenceProfile {
  const fieldProvenance: Record<string, FieldProvenance> = {
    ...profile.fieldProvenance,
  };

  for (const field of extractedFields) {
    fieldProvenance[field] = {
      level: "extracted",
      confidence: fieldConfidence?.[field] ?? 0.85,
    };
  }

  if (profile.industry) {
    fieldProvenance.industry = { level: "inferred", confidence: 0.65 };
  }

  return { ...profile, fieldProvenance };
}

export function userConfirmedProvenance(): FieldProvenance {
  return { level: "extracted", confidence: 1 };
}
