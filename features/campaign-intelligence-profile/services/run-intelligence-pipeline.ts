import { mapCampaignIntelligenceToDiscoverySearch } from "./discovery-search-mapping/map-campaign-intelligence";
import { extractCampaignIntelligenceProfileWithDebug } from "./extract-profile-llm";
import {
  buildEvidenceReviewRows,
  normalizeFromProfile,
} from "./normalization";
import { applyStructuredBriefFields } from "./structured-brief-parser/extract-profile-fields";
import type { BriefTextSource } from "./resolve-brief-text";
import type { StructuredBriefDocument } from "./structured-brief-parser/types";
import type { CampaignIntelligenceProfile } from "../types/profile";
import type {
  CampaignIntelligenceExtractionMode,
  CampaignIntelligencePipelineDebug,
} from "../types/pipeline-debug";
import type { LlmExtractionDebug } from "./extract-profile-llm";

export type RunCampaignIntelligencePipelineInput = {
  briefText: string;
  briefTextSource: BriefTextSource | "upload";
  structuredParserOutput?: StructuredBriefDocument;
};

export type RunCampaignIntelligencePipelineResult = {
  profile: CampaignIntelligenceProfile;
  pipelineDebug: CampaignIntelligencePipelineDebug;
};

function buildExtractionModeReason(llmDebug: LlmExtractionDebug): string {
  if (!llmDebug.heuristicFallback) {
    return "OpenAI returned valid JSON matching the extraction schema.";
  }
  if (llmDebug.parseError) {
    return `Heuristic fallback: ${llmDebug.parseError}`;
  }
  if (llmDebug.rawResponse) {
    return "Heuristic fallback after LLM response could not be applied.";
  }
  return "Heuristic fallback: OPENAI_API_KEY not configured or brief text was empty.";
}

function resolveExtractionMode(llmDebug: LlmExtractionDebug): CampaignIntelligenceExtractionMode {
  return llmDebug.heuristicFallback ? "heuristic" : "llm";
}

/** Upload / re-analyze pipeline — extract, normalize, validate, map discovery. */
export async function runCampaignIntelligencePipeline(
  input: RunCampaignIntelligencePipelineInput
): Promise<RunCampaignIntelligencePipelineResult> {
  const briefText = input.briefText.trim();
  const { profile: extracted, debug: llmDebug } =
    await extractCampaignIntelligenceProfileWithDebug(briefText);

  const enriched = applyStructuredBriefFields(extracted, input.structuredParserOutput);

  const { profile: normalizedProfile, validatedIntelligence, normalizedEntities, extractionIssues } =
    normalizeFromProfile(enriched);

  const validationAccepted = buildEvidenceReviewRows(normalizedEntities);
  const discoveryMapping = mapCampaignIntelligenceToDiscoverySearch(normalizedProfile);

  const merged: CampaignIntelligenceProfile = {
    ...normalizedProfile,
    schemaVersion: 1,
    status: "draft",
    rawBriefExcerpt: briefText.slice(0, 500),
    structuredBrief: input.structuredParserOutput
      ? {
          llmBriefText: briefText,
          document: input.structuredParserOutput,
        }
      : normalizedProfile.structuredBrief,
  };

  const pipelineDebug: CampaignIntelligencePipelineDebug = {
    capturedAt: new Date().toISOString(),
    briefTextSource: input.briefTextSource,
    parserMode: input.structuredParserOutput?.parserMode,
    structuredParserOutput: input.structuredParserOutput,
    llmPrompt: {
      system: llmDebug.systemPrompt,
      user: llmDebug.userPrompt,
      model: llmDebug.model,
    },
    rawLlmResponse: llmDebug.rawResponse,
    heuristicFallback: llmDebug.heuristicFallback,
    extractionMode: resolveExtractionMode(llmDebug),
    extractionModeReason: buildExtractionModeReason(llmDebug),
    llmParseError: llmDebug.parseError,
    extractedProfile: extracted,
    normalizedEntities,
    validation: {
      accepted: validationAccepted,
      rejected: extractionIssues,
    },
    validatedIntelligence,
    discoveryMapping,
  };

  return {
    profile: {
      ...merged,
      pipelineDebug,
    },
    pipelineDebug,
  };
}
