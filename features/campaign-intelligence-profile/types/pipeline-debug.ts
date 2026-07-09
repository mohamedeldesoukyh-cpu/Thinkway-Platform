import type { DiscoverySearchMappingResult } from "../services/discovery-search-mapping/types";
import type { ExtractionIssue } from "../services/normalization/types";
import type { EvidenceReviewRow } from "../services/normalization/validate-normalized-evidence";
import type { StructuredBriefDocument, StructuredBriefParserMode } from "../services/structured-brief-parser/types";
import type { ValidatedCampaignIntelligence } from "./validated-intelligence";
import type { CampaignIntelligenceProfile } from "./profile";

export type CampaignIntelligenceLlmPrompt = {
  system: string;
  user: string;
  model: string;
};

export type CampaignIntelligenceExtractionMode = "llm" | "heuristic";

export type CampaignIntelligencePipelineDebug = {
  capturedAt: string;
  briefTextSource: "llm_brief_text" | "profile_structured" | "parsed_text" | "raw_excerpt" | "upload";
  /** Parser path for the source document (when captured on upload). */
  parserMode?: StructuredBriefParserMode;
  structuredParserOutput?: StructuredBriefDocument;
  llmPrompt: CampaignIntelligenceLlmPrompt;
  rawLlmResponse: string | null;
  heuristicFallback: boolean;
  extractionMode?: CampaignIntelligenceExtractionMode;
  /** Human-readable reason LLM or heuristic path ran. */
  extractionModeReason?: string;
  llmParseError?: string;
  /** Profile shape immediately after LLM extraction (pre-normalize). */
  extractedProfile: CampaignIntelligenceProfile;
  normalizedEntities: CampaignIntelligenceProfile["normalizedEntities"];
  validation: {
    accepted: EvidenceReviewRow[];
    rejected: ExtractionIssue[];
  };
  validatedIntelligence?: ValidatedCampaignIntelligence;
  discoveryMapping?: DiscoverySearchMappingResult;
};
