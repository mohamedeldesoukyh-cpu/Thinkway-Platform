import { z } from "zod";

import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { getValidatedIntelligence } from "@/features/campaign-intelligence-profile/services/get-validated-intelligence";
import { resolveBriefTextForExtraction } from "@/features/campaign-intelligence-profile/services/resolve-brief-text";
import { getCreatorIntelligenceMode } from "@/lib/creator-intelligence/flags";
import { resolveCreatorIntelligence } from "@/lib/creator-intelligence/resolver";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export const CAMPAIGN_FIT_RERANK_MODEL = "gpt-4o-mini";
export const CAMPAIGN_FIT_RERANK_TOP_N = 40;
const AI_TIMEOUT_MS = 45_000;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MAX_BRIEF_CHARS = 24_000;

const rerankResponseSchema = z.object({
  rankings: z.array(
    z.object({
      id: z.string(),
      fitScore: z.number().min(0).max(100),
    })
  ),
});

export type CampaignFitRerankResult = {
  creatorIds: string[];
  fitScores: Record<string, number>;
  usedLlm: boolean;
  error?: string;
};

const SYSTEM_PROMPT = `You rank influencer creators for a specific marketing campaign.

Rules:
- Return JSON only: { "rankings": [{ "id": "<creator id>", "fitScore": 0-100 }, ...] }
- Include EVERY creator id from the input list exactly once.
- fitScore reflects holistic campaign fit (brief + validated intelligence + creator profile).
- Higher score = stronger fit. Use the full 0–100 range.
- Do not invent creators or ids.`;

function buildValidatedIntelligenceSummary(profile: CampaignIntelligenceProfile): string {
  const validated = getValidatedIntelligence(profile);
  if (!validated) return "";

  return JSON.stringify(
    {
      brand: validated.brand,
      market: validated.market,
      audience: validated.audience,
      creatorRequirements: validated.creator,
      platforms: validated.platforms,
      categories: validated.categories,
      keywords: validated.keywords,
      brandSafety: validated.brandSafety,
    },
    null,
    2
  );
}

function resolveBriefTextFromProfile(profile: CampaignIntelligenceProfile, override?: string): string {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) return trimmedOverride.slice(0, MAX_BRIEF_CHARS);

  const resolved = resolveBriefTextForExtraction({ profile });
  if (resolved.text.trim()) return resolved.text.slice(0, MAX_BRIEF_CHARS);

  const fallback = [
    profile.objective,
    ...(profile.objectives ?? []),
    profile.audience,
    profile.brandName ? `Brand: ${profile.brandName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return fallback.slice(0, MAX_BRIEF_CHARS);
}

function buildCreatorSummaries(creators: UnifiedCreatorResult[]): string {
  // Creator Intelligence rollout: in "on" mode the LLM reranker reasons over
  // RESOLVED intelligence (categories with source, tier, topics) instead of
  // raw stored tags, which for discovery rows are crawl provenance.
  const useIntelligence = getCreatorIntelligenceMode() === "on";
  const summaries = creators.map((creator) => {
    const primary =
      creator.platforms.find((p) => p.follower_count != null) ?? creator.platforms[0];
    const intelligence = useIntelligence ? resolveCreatorIntelligence(creator) : null;
    return {
      id: creator.unified_id,
      displayName: creator.display_name,
      bio: creator.bio?.slice(0, 280) ?? null,
      ...(intelligence
        ? {
            categories: intelligence.categories.value,
            categorySource: intelligence.categories.source,
            creatorTier: intelligence.creatorType.value,
            topics: intelligence.topics.value.slice(0, 8),
          }
        : {
            categories: creator.categories,
            browseCategoryTags: creator.browse_category_tags ?? [],
          }),
      aiCategory: creator.ai_category,
      aiNiche: creator.ai_niche,
      platform: primary?.platform ?? null,
      handle: primary?.handle ?? null,
      followers: creator.metrics.followers.value ?? primary?.follower_count ?? null,
      engagementRate: creator.metrics.engagement_rate.value ?? primary?.engagement_rate ?? null,
      country: creator.country_code ?? creator.estimated_country,
      campaignRelevanceScore: creator.campaign_relevance_score ?? null,
      dnaCompleteness: creator.dna_completeness ?? null,
      thinkwayScore: creator.thinkway_score,
    };
  });

  return JSON.stringify(summaries, null, 2);
}

function applyRerankOrder(
  creators: UnifiedCreatorResult[],
  fitScores: Record<string, number>
): UnifiedCreatorResult[] {
  const byId = new Map(creators.map((c) => [c.unified_id, c]));
  const rankedIds = Object.entries(fitScores)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const seen = new Set<string>();
  const ordered: UnifiedCreatorResult[] = [];

  for (const id of rankedIds) {
    const creator = byId.get(id);
    if (!creator || seen.has(id)) continue;
    seen.add(id);
    ordered.push({
      ...creator,
      campaign_relevance_score: fitScores[id] ?? creator.campaign_relevance_score ?? null,
    });
  }

  for (const creator of creators) {
    if (seen.has(creator.unified_id)) continue;
    ordered.push(creator);
  }

  return ordered;
}

/** LLM re-rank top-N creators by holistic campaign fit. Falls back to input order on error. */
export async function rerankCreatorsByCampaignFit(
  creators: UnifiedCreatorResult[],
  profile: CampaignIntelligenceProfile,
  options?: { topN?: number; briefText?: string }
): Promise<{ creators: UnifiedCreatorResult[]; rerank: CampaignFitRerankResult }> {
  const topN = options?.topN ?? CAMPAIGN_FIT_RERANK_TOP_N;
  const head = creators.slice(0, topN);
  const tail = creators.slice(topN);

  const fallback: CampaignFitRerankResult = {
    creatorIds: creators.map((c) => c.unified_id),
    fitScores: Object.fromEntries(
      head.map((c) => [c.unified_id, c.campaign_relevance_score ?? 0])
    ),
    usedLlm: false,
  };

  if (head.length <= 1) {
    return { creators, rerank: fallback };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { creators, rerank: { ...fallback, error: "no_api_key" } };
  }

  const briefText = resolveBriefTextFromProfile(profile, options?.briefText);
  const intelligenceSummary = buildValidatedIntelligenceSummary(profile);
  const creatorSummaries = buildCreatorSummaries(head);

  const userPrompt = [
    "## Campaign brief",
    briefText || "(No full brief text — use validated intelligence summary.)",
    "",
    "## Validated campaign intelligence",
    intelligenceSummary || "(No validated intelligence summary.)",
    "",
    "## Creators to rank (return all ids)",
    creatorSummaries,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CAMPAIGN_FIT_RERANK_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        creators,
        rerank: { ...fallback, error: `HTTP ${response.status}` },
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return { creators, rerank: { ...fallback, error: "empty_response" } };
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      return { creators, rerank: { ...fallback, error: "invalid_json" } };
    }

    const parsed = rerankResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { creators, rerank: { ...fallback, error: "schema_validation_failed" } };
    }

    const inputIds = new Set(head.map((c) => c.unified_id));
    const fitScores: Record<string, number> = {};
    for (const entry of parsed.data.rankings) {
      if (!inputIds.has(entry.id)) continue;
      fitScores[entry.id] = Math.round(entry.fitScore);
    }

    if (Object.keys(fitScores).length === 0) {
      return { creators, rerank: { ...fallback, error: "no_valid_rankings" } };
    }

    for (const creator of head) {
      if (fitScores[creator.unified_id] == null) {
        fitScores[creator.unified_id] = creator.campaign_relevance_score ?? 0;
      }
    }

    const rerankedHead = applyRerankOrder(head, fitScores);
    return {
      creators: [...rerankedHead, ...tail],
      rerank: {
        creatorIds: [...rerankedHead, ...tail].map((c) => c.unified_id),
        fitScores,
        usedLlm: true,
      },
    };
  } catch (error) {
    return {
      creators,
      rerank: {
        ...fallback,
        error: error instanceof Error ? error.message : "llm_request_failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
