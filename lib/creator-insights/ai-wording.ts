import { createOpenAiProvider } from "@/features/ai/llm/openai-provider";

import { applyStalePrefix, deterministicCopy, type RecommendationCopy } from "./copy";
import type { DetectedCreatorInsight } from "./types";

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

export function allowedFactNumbers(facts: DetectedCreatorInsight["facts"]): Set<string> {
  const allowed = new Set<string>();
  for (const value of Object.values(facts)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      allowed.add(normalizeNumberToken(value));
      allowed.add(normalizeNumberToken(Math.round(value)));
      if (value <= 1) allowed.add(normalizeNumberToken(value * 100));
    }
    if (typeof value === "string") {
      for (const match of value.match(NUMBER_RE) ?? []) {
        allowed.add(normalizeNumberToken(Number(match)));
      }
    }
  }
  return allowed;
}

export function normalizeNumberToken(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}

/** Reject wording that introduces numbers not present in the structured facts. */
export function wordingIntroducesUnknownNumbers(
  copy: RecommendationCopy,
  facts: DetectedCreatorInsight["facts"]
): boolean {
  const allowed = allowedFactNumbers(facts);
  const text = `${copy.title} ${copy.explanation} ${copy.recommendation}`;
  for (const match of text.match(NUMBER_RE) ?? []) {
    const token = normalizeNumberToken(Number(match));
    if (!token) continue;
    if (allowed.has(token)) continue;
    const asInt = normalizeNumberToken(Math.round(Number(match)));
    if (allowed.has(asInt)) continue;
    return true;
  }
  return false;
}

export function parseWordingJson(raw: string): RecommendationCopy | null {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
    const recommendation =
      typeof parsed.recommendation === "string" ? parsed.recommendation.trim() : "";
    if (!title || !explanation || !recommendation) return null;
    return { title, explanation, recommendation };
  } catch {
    return null;
  }
}

export async function maybeAiWording(
  insight: DetectedCreatorInsight,
  stale: boolean
): Promise<{ copy: RecommendationCopy; source: "deterministic" | "ai" }> {
  const fallback = deterministicCopy(insight);
  const copy = {
    ...fallback,
    explanation: applyStalePrefix(fallback.explanation, stale && insight.type !== "data_enrichment"),
  };
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { copy, source: "deterministic" };
  }
  try {
    const provider = createOpenAiProvider();
    const response = await provider.complete({
      temperature: 0.2,
      maxTokens: 280,
      messages: [
        {
          role: "system",
          content:
            "Rewrite the structured facts into three short creator-facing strings. Do not invent metrics, percentages, or sample sizes. Use only numbers present in the facts JSON. Do not mention AI. Return JSON only: {\"title\",\"explanation\",\"recommendation\"}.",
        },
        {
          role: "user",
          content: JSON.stringify({
            type: insight.type,
            confidence: insight.confidence,
            facts: insight.facts,
            deterministic: fallback,
          }),
        },
      ],
    });
    if (response.stub) return { copy, source: "deterministic" };
    const parsed = parseWordingJson(response.content);
    if (!parsed) return { copy, source: "deterministic" };
    if (wordingIntroducesUnknownNumbers(parsed, insight.facts)) {
      return { copy, source: "deterministic" };
    }
    return {
      copy: {
        ...parsed,
        explanation: applyStalePrefix(
          parsed.explanation,
          stale && insight.type !== "data_enrichment"
        ),
      },
      source: "ai",
    };
  } catch {
    return { copy, source: "deterministic" };
  }
}
