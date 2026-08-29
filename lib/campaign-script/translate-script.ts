import type { LlmProvider } from "@/features/ai/types/llm";
import { LlmProviderError } from "@/features/ai/types/llm";
import { createOpenAiProvider } from "@/features/ai/llm/openai-provider";

import type { ScriptLanguage } from "./types";
import { scriptLanguageLabel } from "./policy";

const CHUNK_MAX_CHARS = 6_000;
const TRANSLATION_MAX_TOKENS = 8_000;

export function buildScriptTranslationSystemPrompt(): string {
  return [
    "You translate influencer marketing campaign scripts between English and Arabic.",
    "Preserve the script's meaning, paragraph structure, lists, line breaks, and formatting.",
    "Do not add campaign instructions that are not in the source.",
    "Do not remove important instructions.",
    "Do not invent claims, offers, or product details.",
    "Do not change creator requirements.",
    "Preserve quantities, dates, names, URLs, hashtags, mentions, and mandatory wording unless a natural translation of surrounding prose requires it.",
    "Output only the translated script. No preamble, no quotes, no commentary.",
  ].join(" ");
}

export function buildScriptTranslationUserPrompt(input: {
  sourceLanguage: ScriptLanguage;
  targetLanguage: ScriptLanguage;
  sourceText: string;
}): string {
  const from = scriptLanguageLabel(input.sourceLanguage);
  const to = scriptLanguageLabel(input.targetLanguage);
  return `Translate the following campaign script from ${from} to ${to}.\n\n---\n${input.sourceText}\n---`;
}

export function splitScriptTranslationChunks(
  text: string,
  maxChars = CHUNK_MAX_CHARS
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trimEnd());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      pushCurrent();
      for (const piece of splitLongParagraph(paragraph, maxChars)) {
        chunks.push(piece);
      }
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars) {
      pushCurrent();
      current = paragraph;
    } else {
      current = next;
    }
  }
  pushCurrent();
  return chunks;
}

function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  const lines = paragraph.split("\n");
  const pieces: string[] = [];
  let current = "";
  for (const line of lines) {
    if (line.length > maxChars) {
      if (current) pieces.push(current);
      current = "";
      for (let i = 0; i < line.length; i += maxChars) {
        pieces.push(line.slice(i, i + maxChars));
      }
      continue;
    }
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars) {
      if (current) pieces.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export async function translateCampaignScriptText(input: {
  sourceLanguage: ScriptLanguage;
  targetLanguage: ScriptLanguage;
  sourceText: string;
  provider?: LlmProvider;
}): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const sourceText = input.sourceText.trim();
  if (!sourceText) {
    return { ok: false, message: "There is no source script to translate." };
  }

  const provider = input.provider ?? createOpenAiProvider();
  const chunks = splitScriptTranslationChunks(sourceText);
  const translated: string[] = [];

  try {
    for (const chunk of chunks) {
      const response = await provider.complete({
        messages: [
          { role: "system", content: buildScriptTranslationSystemPrompt() },
          {
            role: "user",
            content: buildScriptTranslationUserPrompt({
              sourceLanguage: input.sourceLanguage,
              targetLanguage: input.targetLanguage,
              sourceText: chunk,
            }),
          },
        ],
        temperature: 0.2,
        maxTokens: TRANSLATION_MAX_TOKENS,
      });
      if (response.stub) {
        return {
          ok: false,
          message: "Translation is not configured. Add an OpenAI API key and retry.",
        };
      }
      const text = response.content.trim();
      if (!text) {
        return { ok: false, message: "The translation service returned an empty result." };
      }
      translated.push(text);
    }
  } catch (error) {
    const message =
      error instanceof LlmProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Translation failed.";
    return { ok: false, message };
  }

  return { ok: true, text: translated.join("\n\n") };
}
