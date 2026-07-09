import type { CampaignIntelligenceProfile } from "../types/profile";

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
