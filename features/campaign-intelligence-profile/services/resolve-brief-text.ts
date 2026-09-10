import type { CampaignIntelligenceProfile } from "../types/profile";

import type { StructuredBriefDocument } from "./structured-brief-parser/types";

export type BriefTextSource =
  | "llm_brief_text"
  | "profile_structured"
  | "parsed_text"
  | "raw_excerpt";

export type ResolvedBriefText = {
  text: string;
  source: BriefTextSource;
};

type DocumentBriefFields = {
  llm_brief_text?: string | null;
  parsed_text?: string | null;
};

/** Prefer structured LLM text over flattened parsed_text for extraction. */
export function resolveBriefTextForExtraction(input: {
  profile: CampaignIntelligenceProfile;
  document?: DocumentBriefFields | null;
}): ResolvedBriefText {
  const docLlm = input.document?.llm_brief_text?.trim();
  if (docLlm) {
    return { text: docLlm, source: "llm_brief_text" };
  }

  const profileLlm = input.profile.structuredBrief?.llmBriefText?.trim();
  if (profileLlm) {
    return { text: profileLlm, source: "profile_structured" };
  }

  const parsed = input.document?.parsed_text?.trim();
  if (parsed) {
    return { text: parsed, source: "parsed_text" };
  }

  const excerpt = input.profile.rawBriefExcerpt?.trim() ?? "";
  return { text: excerpt, source: "raw_excerpt" };
}

/**
 * How much of the brief text a profile stores as its excerpt.
 * `ensureWorkflowCampaignIntelligenceProfile` and the upload pipeline both
 * persist `briefText.slice(0, RAW_BRIEF_EXCERPT_CHARS)`.
 */
export const RAW_BRIEF_EXCERPT_CHARS = 500;

/**
 * True when this profile was already extracted from this exact brief text.
 *
 * Extraction is deterministic — the same brief produces the same profile — so
 * re-running it on text a profile was already built from cannot yield anything
 * new. It can only cost a second LLM round-trip and persist a duplicate row.
 * Compared on the stored excerpt because that is precisely what both writers
 * persist, so the comparison is exact rather than a heuristic.
 */
export function profileAlreadyExtractedFromBrief(input: {
  rawBriefExcerpt?: string | null;
  briefText: string;
}): boolean {
  const stored = input.rawBriefExcerpt?.trim();
  if (!stored) return false;
  const candidate = input.briefText.trim().slice(0, RAW_BRIEF_EXCERPT_CHARS).trim();
  if (!candidate) return false;
  return stored === candidate;
}

/** Only a document with real sections can drive the section field mapper. */
function usableStructuredDocument(
  document: StructuredBriefDocument | null | undefined
): StructuredBriefDocument | undefined {
  if (!document || !Array.isArray(document.sections) || document.sections.length === 0) {
    return undefined;
  }
  return document;
}

/**
 * Which structured document belongs to the brief text that was chosen.
 *
 * Deliverables, KPIs, the key message and the CTA are read from a document's
 * own heading + list sections, so the document handed to the pipeline must be
 * the one that produced the text. Pairing them by text source rather than
 * fetching a document independently is what keeps another brief's sections out
 * of this campaign, and keeps a typed brief — which has no document — from
 * gaining fields it never stated.
 */
export function resolveStructuredDocumentForBriefText(input: {
  source: BriefTextSource;
  /** `profile.structuredBrief.document`. */
  profileDocument?: StructuredBriefDocument | null;
  /** `campaign_intelligence_documents.structured_document`. */
  storedDocument?: StructuredBriefDocument | null;
}): StructuredBriefDocument | undefined {
  switch (input.source) {
    case "profile_structured":
      // The text came off the profile, so its document does too.
      return usableStructuredDocument(input.profileDocument);
    case "llm_brief_text":
    case "parsed_text":
      // Both are columns of the same stored document row.
      return usableStructuredDocument(input.storedDocument);
    case "raw_excerpt":
      // A 500-character excerpt is not a document and has no sections.
      return undefined;
  }
}
