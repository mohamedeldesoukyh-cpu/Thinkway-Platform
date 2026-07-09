import type {
  CampaignFacts,
  CampaignFactsField,
  CampaignFactsSource,
} from "@/features/campaign-director/facts/campaign-facts-types";

import type {
  ExtractionIssue,
  FieldProvenance,
  NormalizedCampaignEntities,
} from "../services/normalization/types";
import type { StructuredBriefDocument } from "../services/structured-brief-parser/types";

import type { CampaignIntelligencePipelineDebug } from "./pipeline-debug";
import type { ValidatedCampaignIntelligence } from "./validated-intelligence";

/** Release 1 — weighted criterion for Discovery AI search (in-memory until Release 2 persistence). */
export type CampaignSearchCriterion = {
  id: string;
  kind:
    | "category"
    | "niche"
    | "country"
    | "city"
    | "audience"
    | "platform"
    | "language"
    | "brand_fit"
    | "authenticity"
    | "engagement"
    | "luxury";
  label: string;
  value: string;
  weight: number;
  enabled: boolean;
  meta?: Record<string, string | number | undefined>;
};

export type CampaignIntelligenceStatus = "draft" | "saved" | "archived";

/**
 * Campaign Intelligence Profile — evolves CampaignFacts into the full SSOT.
 * Stored in campaign_intelligence_profiles.profile (jsonb).
 */
export type CampaignIntelligenceProfile = CampaignFacts & {
  schemaVersion: 1;
  status: CampaignIntelligenceStatus;
  campaignName?: string;
  market?: string;
  products?: string[];
  objectives?: string[];
  audienceDetail?: {
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    countries?: string[];
    cities?: string[];
    languages?: string[];
  };
  creatorCategories?: string[];
  creatorNiches?: string[];
  deliverables?: string[];
  toneOfVoice?: string[];
  contentStyle?: string[];
  brandSafetyLevel?: "required" | "preferred" | "none";
  marketTier?: "luxury" | "premium" | "mass";
  requirements?: {
    mandatory?: string[];
    preferred?: string[];
    negative?: string[];
    competitorMentions?: string[];
  };
  expectedCreatorCount?: number;
  /**
   * Authoritative post-validation intelligence — Discovery, Studio, and UI read ONLY this.
   * Pipeline: Upload → Extract → Normalize → Validate → validatedIntelligence → Persist.
   */
  validatedIntelligence?: ValidatedCampaignIntelligence;
  /** @deprecated Use validatedIntelligence. Kept for legacy rows during migration. */
  normalizedEntities?: NormalizedCampaignEntities;
  /** Malformed extraction values rejected during normalization (not search filters). */
  extractionIssues?: ExtractionIssue[];
  /** Per-field evidence levels for extraction review. */
  fieldProvenance?: Record<string, FieldProvenance>;
  /** Structured brief text + blocks — preferred over flattened parsed_text on re-analysis. */
  structuredBrief?: {
    llmBriefText: string;
    document?: StructuredBriefDocument;
  };
  /** Developer pipeline artifacts (upload / re-analyze). Gated in UI by debug flag. */
  pipelineDebug?: CampaignIntelligencePipelineDebug;
};

export type CampaignIntelligenceProfileRow = {
  id: string;
  created_by: string;
  conversation_id: string | null;
  brand_id: string | null;
  campaign_header_id: string | null;
  status: CampaignIntelligenceStatus;
  profile: CampaignIntelligenceProfile;
  source_document_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignIntelligenceDocumentRow = {
  id: string;
  profile_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  parse_status: string;
  parsed_text: string | null;
  llm_brief_text?: string | null;
  structured_document?: StructuredBriefDocument | null;
};

export function createEmptyCampaignIntelligenceProfile(): CampaignIntelligenceProfile {
  return {
    schemaVersion: 1,
    status: "draft",
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    objectives: [],
    creatorCategories: [],
    creatorNiches: [],
    deliverables: [],
    requirements: { mandatory: [], preferred: [], negative: [] },
  };
}

export function setProfileFieldMeta(
  profile: CampaignIntelligenceProfile,
  field: CampaignFactsField | string,
  source: CampaignFactsSource,
  confidence: number
): void {
  profile.confidence[field as CampaignFactsField] = confidence;
  profile.sources[field as CampaignFactsField] = source;
}
