import { z } from "zod";

import {
  CLIENT_CATEGORY_TAXONOMY,
  isValidClientCategoryPair,
} from "@/lib/clients/client-category-taxonomy";

const AI_MODEL = "gpt-4o-mini";
const AI_TIMEOUT_MS = 15_000;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export type AiClientCategoryClassification = {
  categorySlug: string;
  subcategorySlug: string;
  confidence: number;
  reasoning?: string;
};

const aiResponseSchema = z.object({
  categorySlug: z.string(),
  subcategorySlug: z.string(),
  confidence: z.union([
    z.number().min(0).max(100),
    z.enum(["high", "medium", "low"]),
  ]),
  reasoning: z.string().optional(),
});

function normalizeAiConfidence(value: number | "high" | "medium" | "low"): number {
  if (typeof value === "number") {
    return Math.min(95, Math.max(70, Math.round(value)));
  }
  switch (value) {
    case "high":
      return 90;
    case "medium":
      return 80;
    default:
      return 72;
  }
}

const TAXONOMY_PROMPT = JSON.stringify(
  CLIENT_CATEGORY_TAXONOMY.map((category) => ({
    categorySlug: category.slug,
    categoryLabel: category.label,
    subcategories: category.subcategories.map((subcategory) => ({
      subcategorySlug: subcategory.slug,
      subcategoryLabel: subcategory.label,
    })),
  }))
);

export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function classifyClientCategoryWithAi(input: {
  name: string;
  country?: string | null;
  website?: string | null;
  webSnippets?: string[];
}): Promise<AiClientCategoryClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const companyName = input.name.trim();

  if (!apiKey || companyName.length < 3) {
    return null;
  }

  const userPayload: Record<string, unknown> = {
    companyName,
    country: input.country?.trim() || undefined,
    website: input.website?.trim() || undefined,
  };

  if (input.webSnippets?.length) {
    userPayload.webSearchSnippets = input.webSnippets.slice(0, 10);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You classify companies into the Thinkway client category taxonomy for influencer marketing operations.

Return ONLY valid JSON with this shape:
{ "categorySlug": string, "subcategorySlug": string, "confidence": number, "reasoning": string }

Rules:
- Pick categorySlug and subcategorySlug ONLY from the taxonomy below. Never invent slugs.
- confidence is 70-95 (integer). Use 85+ when web snippets clearly identify industry/products/services.
- Base classification on industry, products, and services from webSearchSnippets — not company name alone.
- If uncertain, use 70-78 confidence.
- Automotive manufacturers (e.g. BYD, Tesla) → retail_ecommerce with general_trading or consumer_electronics as appropriate.
- Media agencies, ad networks, and MCNs (multi-channel networks) → marketing_advertising_media_agencies.
- Use webSearchSnippets when provided to disambiguate unknown brands.

Taxonomy:
${TAXONOMY_PROMPT}`,
          },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(
        "[classify-client-category-ai] OpenAI request failed:",
        response.status
      );
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return null;
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return null;
    }

    const parsed = aiResponseSchema.safeParse(json);
    if (!parsed.success) {
      return null;
    }

    const { categorySlug, subcategorySlug, confidence, reasoning } = parsed.data;
    if (!isValidClientCategoryPair(categorySlug, subcategorySlug)) {
      console.warn(
        "[classify-client-category-ai] Rejected hallucinated taxonomy pair:",
        categorySlug,
        subcategorySlug
      );
      return null;
    }

    return {
      categorySlug,
      subcategorySlug,
      confidence: normalizeAiConfidence(confidence),
      reasoning,
    };
  } catch (error) {
    console.warn(
      "[classify-client-category-ai] AI classification failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
