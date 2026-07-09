import { z } from "zod";

import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { validateCampaignFacts } from "@/features/campaign-director/facts/validate-campaign-facts";

import {
  createEmptyCampaignIntelligenceProfile,
  setProfileFieldMeta,
  type CampaignIntelligenceProfile,
} from "../types/profile";
import { attachLlmFieldProvenance } from "./normalization/field-provenance";

export const CIP_EXTRACTION_MODEL = "gpt-4o-mini";
const AI_MODEL = CIP_EXTRACTION_MODEL;
const AI_TIMEOUT_MS = 45_000;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MAX_BRIEF_CHARS = 24_000;

const extractionSchema = z.object({
  brandName: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  campaignName: z.string().nullable().optional(),
  market: z.string().nullable().optional(),
  campaignType: z.string().nullable().optional(),
  marketTier: z.enum(["luxury", "premium", "mass"]).nullable().optional(),
  objective: z.string().nullable().optional(),
  objectives: z.array(z.string()).nullable().optional(),
  products: z.array(z.string()).nullable().optional(),
  audience: z.string().nullable().optional(),
  audienceDetail: z
    .object({
      gender: z.string().nullable().optional(),
      ageMin: z.number().nullable().optional(),
      ageMax: z.number().nullable().optional(),
      countries: z.array(z.string()).nullable().optional(),
      cities: z.array(z.string()).nullable().optional(),
      languages: z.array(z.string()).nullable().optional(),
    })
    .nullable()
    .optional(),
  geography: z.array(z.string()).nullable().optional(),
  platforms: z.array(z.string()).nullable().optional(),
  creatorCategories: z.array(z.string()).nullable().optional(),
  creatorNiches: z.array(z.string()).nullable().optional(),
  budget: z
    .object({
      amount: z.number(),
      currency: z.string(),
    })
    .nullable()
    .optional(),
  durationWeeks: z.number().nullable().optional(),
  deliverables: z.array(z.string()).nullable().optional(),
  kpis: z.array(z.string()).nullable().optional(),
  toneOfVoice: z.array(z.string()).nullable().optional(),
  contentStyle: z.array(z.string()).nullable().optional(),
  brandSafetyLevel: z.enum(["required", "preferred", "none"]).nullable().optional(),
  requirements: z
    .object({
      mandatory: z.array(z.string()).nullable().optional(),
      preferred: z.array(z.string()).nullable().optional(),
      negative: z.array(z.string()).nullable().optional(),
      competitorMentions: z.array(z.string()).nullable().optional(),
    })
    .nullable()
    .optional(),
  constraints: z.array(z.string()).nullable().optional(),
  risks: z.array(z.string()).nullable().optional(),
  expectedCreatorCount: z.number().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  followerRange: z
    .object({
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  fieldConfidence: z.record(z.string(), z.number()).nullable().optional(),
});

export const CIP_EXTRACTION_SYSTEM_PROMPT = `You are a campaign brief parser. Extract ONLY values explicitly stated in the brief.

Rules:
- Return JSON only. No markdown or commentary.
- Use null for missing fields — never guess, infer, or expand geography.
- Use empty arrays ONLY when the brief explicitly lists an empty set.
- Do NOT infer countries from industry, brand, or language. Only extract countries named in the brief.
- Do NOT merge adjacent table cells — each field is separate (e.g. brand "L'Oréal Paris" is NOT "L'Oréal ParisMarket").
- Platforms: instagram, tiktok, youtube, twitter (lowercase).
- creatorCategories: searchable creator categories only (Beauty, Fashion, etc.) — NOT field labels like "Audience".
- Put follower ranges in followerRange, not creatorCategories.
- Put content keywords in keywords array.
- fieldConfidence: per-field extraction confidence 0–1 (how certain you are the value appears in the brief).
- confidence reflects extraction certainty only — not business importance.`;

const SYSTEM_PROMPT = CIP_EXTRACTION_SYSTEM_PROMPT;

export type LlmExtractionDebug = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  rawResponse: string | null;
  heuristicFallback: boolean;
  parseError?: string;
};

export function buildLlmExtractionPrompts(briefText: string): {
  systemPrompt: string;
  userPrompt: string;
  model: string;
} {
  const trimmed = briefText.trim();
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Structured campaign brief:\n\n${trimmed.slice(0, MAX_BRIEF_CHARS)}`,
    model: AI_MODEL,
  };
}

export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function heuristicExtract(briefText: string): CampaignIntelligenceProfile {
  const facts = validateCampaignFacts(extractCampaignFacts({ rawMessage: briefText }));
  const profile = createEmptyCampaignIntelligenceProfile();

  profile.brandName = facts.brandName;
  profile.clientName = facts.clientName;
  profile.industry = facts.industry ?? detectIndustryFromBrief(briefText);
  profile.campaignType = facts.campaignType;
  profile.objective = facts.objective;
  profile.objectives = facts.objective ? [facts.objective] : [];
  profile.audience = facts.audience;
  profile.geography = facts.geography;
  profile.market = facts.geography?.[0];
  profile.platforms = facts.platforms?.map((p) => p.toLowerCase());
  profile.budget = facts.budget;
  profile.durationWeeks = facts.durationWeeks;
  profile.kpis = facts.kpis;
  profile.constraints = facts.constraints;
  profile.risks = facts.risks;
  profile.rawBriefExcerpt = briefText.slice(0, 500);
  profile.extractedAt = facts.extractedAt;
  profile.confidence = { ...facts.confidence };
  profile.sources = { ...facts.sources };

  if (facts.audience) {
    profile.audienceDetail = {
      countries: facts.geography ?? [],
    };
  }

  return profile;
}

function applyExtractedData(
  data: z.infer<typeof extractionSchema>,
  briefText: string
): CampaignIntelligenceProfile {
  const profile = createEmptyCampaignIntelligenceProfile();

  profile.brandName = data.brandName ?? undefined;
  profile.clientName = data.clientName ?? undefined;
  profile.campaignName = data.campaignName ?? undefined;
  profile.market = data.market ?? undefined;
  profile.campaignType = data.campaignType ?? undefined;
  profile.marketTier = data.marketTier ?? undefined;
  profile.objective = data.objective ?? undefined;
  profile.objectives = data.objectives ?? (data.objective ? [data.objective] : undefined);
  profile.products = data.products ?? undefined;
  profile.audience = data.audience ?? undefined;
  profile.audienceDetail = data.audienceDetail
    ? {
        gender: data.audienceDetail.gender ?? undefined,
        ageMin: data.audienceDetail.ageMin ?? undefined,
        ageMax: data.audienceDetail.ageMax ?? undefined,
        countries: data.audienceDetail.countries ?? undefined,
        cities: data.audienceDetail.cities ?? undefined,
        languages: data.audienceDetail.languages ?? undefined,
      }
    : undefined;
  profile.geography = data.geography ?? data.audienceDetail?.countries ?? undefined;
  profile.platforms = data.platforms ?? undefined;
  profile.creatorCategories = data.creatorCategories ?? undefined;
  profile.creatorNiches = data.creatorNiches ?? undefined;
  profile.budget = data.budget ?? undefined;
  profile.durationWeeks = data.durationWeeks ?? undefined;
  profile.deliverables = data.deliverables ?? undefined;
  profile.kpis = data.kpis ?? undefined;
  profile.toneOfVoice = data.toneOfVoice ?? undefined;
  profile.contentStyle = data.contentStyle ?? undefined;
  profile.brandSafetyLevel = data.brandSafetyLevel ?? undefined;
  profile.requirements = data.requirements
    ? {
        mandatory: data.requirements.mandatory ?? undefined,
        preferred: data.requirements.preferred ?? undefined,
        negative: data.requirements.negative ?? undefined,
        competitorMentions: data.requirements.competitorMentions ?? undefined,
      }
    : undefined;
  profile.constraints = data.constraints ?? profile.requirements?.mandatory;
  profile.risks = data.risks ?? undefined;
  profile.expectedCreatorCount = data.expectedCreatorCount ?? undefined;
  profile.industry = detectIndustryFromBrief(briefText);
  profile.rawBriefExcerpt = briefText.slice(0, 500);
  profile.extractedAt = new Date().toISOString();

  if (data.keywords?.length) {
    profile.products = [...(profile.products ?? []), ...data.keywords];
  }

  if (data.followerRange?.min != null || data.followerRange?.max != null) {
    const min = data.followerRange.min;
    const max = data.followerRange.max;
    const label =
      min != null && max != null
        ? `${min}-${max} followers`
        : min != null
          ? `${min}+ followers`
          : `up to ${max} followers`;
    profile.creatorCategories = [...(profile.creatorCategories ?? []), label];
  }

  const fieldConfidence = data.fieldConfidence ?? {};
  for (const field of [
    "brandName",
    "clientName",
    "objective",
    "audience",
    "budget",
    "platforms",
    "geography",
  ] as const) {
    if (profile[field] != null) {
      const conf = fieldConfidence[field] ?? 0.85;
      setProfileFieldMeta(profile, field, "brief", conf);
    }
  }

  if (data.market) {
    setProfileFieldMeta(profile, "geography", "brief", fieldConfidence.market ?? 0.85);
  }
  if (data.audienceDetail) {
    setProfileFieldMeta(profile, "audience", "brief", fieldConfidence.audience ?? 0.85);
  }

  const extractedFieldKeys = [
    data.brandName ? "brandName" : "",
    data.clientName ? "clientName" : "",
    data.market ? "market" : "",
    data.campaignName ? "campaignName" : "",
    data.audience ? "audience" : "",
    data.geography?.length ? "geography" : "",
    data.audienceDetail?.countries?.length ? "audienceDetail.countries" : "",
    data.audienceDetail?.gender ? "audienceDetail.gender" : "",
    data.audienceDetail?.ageMin != null || data.audienceDetail?.ageMax != null
      ? "audienceDetail.age"
      : "",
    data.audienceDetail?.languages?.length ? "audienceDetail.languages" : "",
    data.platforms?.length ? "platforms" : "",
    data.creatorCategories?.length ? "creatorCategories" : "",
    data.creatorNiches?.length ? "creatorNiches" : "",
    data.keywords?.length ? "keywords" : "",
  ].filter(Boolean) as string[];

  return attachLlmFieldProvenance(
    validateCampaignFacts(profile) as CampaignIntelligenceProfile,
    extractedFieldKeys,
    fieldConfidence
  );
}

export async function extractCampaignIntelligenceProfileWithDebug(
  briefText: string
): Promise<{ profile: CampaignIntelligenceProfile; debug: LlmExtractionDebug }> {
  const trimmed = briefText.trim();
  const prompts = buildLlmExtractionPrompts(trimmed);
  const baseDebug: LlmExtractionDebug = {
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    model: prompts.model,
    rawResponse: null,
    heuristicFallback: false,
  };

  if (!trimmed) {
    return {
      profile: createEmptyCampaignIntelligenceProfile(),
      debug: { ...baseDebug, heuristicFallback: true },
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      profile: heuristicExtract(trimmed),
      debug: { ...baseDebug, heuristicFallback: true },
    };
  }

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
        model: AI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompts.systemPrompt },
          { role: "user", content: prompts.userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        profile: heuristicExtract(trimmed),
        debug: { ...baseDebug, heuristicFallback: true, parseError: `HTTP ${response.status}` },
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return {
        profile: heuristicExtract(trimmed),
        debug: { ...baseDebug, heuristicFallback: true, parseError: "Empty LLM response" },
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (error) {
      return {
        profile: heuristicExtract(trimmed),
        debug: {
          ...baseDebug,
          rawResponse: content,
          heuristicFallback: true,
          parseError: error instanceof Error ? error.message : "Invalid JSON",
        },
      };
    }

    const parsed = extractionSchema.safeParse(json);
    if (!parsed.success) {
      return {
        profile: heuristicExtract(trimmed),
        debug: {
          ...baseDebug,
          rawResponse: content,
          heuristicFallback: true,
          parseError: "Schema validation failed",
        },
      };
    }

    return {
      profile: applyExtractedData(parsed.data, trimmed),
      debug: { ...baseDebug, rawResponse: content, heuristicFallback: false },
    };
  } catch (error) {
    return {
      profile: heuristicExtract(trimmed),
      debug: {
        ...baseDebug,
        heuristicFallback: true,
        parseError: error instanceof Error ? error.message : "LLM request failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractCampaignIntelligenceProfile(
  briefText: string
): Promise<CampaignIntelligenceProfile> {
  const { profile } = await extractCampaignIntelligenceProfileWithDebug(briefText);
  return profile;
}
