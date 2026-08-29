import type { DetectedScriptLanguage, ScriptLanguage } from "./types";

const ARABIC_LETTER = /[\u0600-\u06FF]/g;
const LATIN_LETTER = /[A-Za-z]/g;

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

export function detectScriptLanguage(text: string): DetectedScriptLanguage {
  const arabicLetterCount = countMatches(text, ARABIC_LETTER);
  const latinLetterCount = countMatches(text, LATIN_LETTER);
  const total = arabicLetterCount + latinLetterCount;

  if (total === 0) {
    return {
      language: "en",
      mixed: false,
      confidence: "low",
      arabicLetterCount,
      latinLetterCount,
    };
  }

  const arabicShare = arabicLetterCount / total;
  const latinShare = latinLetterCount / total;
  const mixed =
    arabicLetterCount >= 12 &&
    latinLetterCount >= 12 &&
    arabicShare >= 0.25 &&
    latinShare >= 0.25;

  if (arabicShare >= 0.55 || (arabicLetterCount >= 8 && arabicLetterCount >= latinLetterCount)) {
    return {
      language: "ar",
      mixed,
      confidence: mixed ? "low" : arabicShare >= 0.75 ? "high" : "low",
      arabicLetterCount,
      latinLetterCount,
    };
  }

  return {
    language: "en",
    mixed,
    confidence: mixed ? "low" : latinShare >= 0.75 ? "high" : "low",
    arabicLetterCount,
    latinLetterCount,
  };
}

export const SCRIPT_REPLACE_BOTH_LANGUAGES_CONFIRM =
  "This will replace the current script content in both languages. Continue?";

export type MergeExtractedScriptTextInput = {
  extractedText: string;
  sourceLanguage: ScriptLanguage;
  existingBodyEn?: string;
  existingBodyAr?: string;
  replaceBothLanguages?: boolean;
};

/** Replace-all helper: source field filled, the other language emptied. */
export function applyExtractedText(
  text: string,
  sourceLanguage: ScriptLanguage
): { bodyEn: string; bodyAr: string } {
  return mergeExtractedScriptText({
    extractedText: text,
    sourceLanguage,
    replaceBothLanguages: true,
  });
}

/**
 * Default upload: update only the source-language body and preserve the other.
 * replaceBothLanguages empties the non-source body (explicit replace-all only).
 */
export function mergeExtractedScriptText(input: MergeExtractedScriptTextInput): {
  bodyEn: string;
  bodyAr: string;
} {
  const extracted = input.extractedText.trim();
  if (input.replaceBothLanguages) {
    if (input.sourceLanguage === "ar") {
      return { bodyEn: "", bodyAr: extracted };
    }
    return { bodyEn: extracted, bodyAr: "" };
  }
  if (input.sourceLanguage === "ar") {
    return {
      bodyEn: input.existingBodyEn ?? "",
      bodyAr: extracted,
    };
  }
  return {
    bodyEn: extracted,
    bodyAr: input.existingBodyAr ?? "",
  };
}

export function scriptHasContentToReplace(bodyEn: string, bodyAr: string): boolean {
  return Boolean(bodyEn.trim() || bodyAr.trim());
}

export function isScriptLanguage(value: string | null | undefined): value is ScriptLanguage {
  return value === "en" || value === "ar";
}
