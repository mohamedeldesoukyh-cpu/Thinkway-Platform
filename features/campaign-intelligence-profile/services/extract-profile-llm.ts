import { z } from "zod";

import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import { deriveCreatorCategoriesFromBrief } from "@/features/campaign-studio/services/derive-creator-categories";
import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { validateCampaignFacts } from "@/features/campaign-director/facts/validate-campaign-facts";

import {
  createEmptyCampaignIntelligenceProfile,
  setProfileFieldMeta,
  type CampaignIntelligenceProfile,
} from "../types/profile";
import { attachLlmFieldProvenance } from "./normalization/field-provenance";
import {
  isValidBrandName,
  isValidClientName,
  resolveCountryCode,
  sanitizeBrandName,
  countryLabel,
} from "./normalization/validators";

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
- creatorCategories: Discovery content verticals only (Beauty, Fashion, Sports, Lifestyle, Entertainment, Tech). NEVER copy the client's industry (Finance, Banking, Telecom, Insurance). A bank or credit-card brief that asks for mass awareness or a sports-event mix (e.g. LaLiga) is Sports / Lifestyle / Entertainment, not Finance.
- Only treat creators as finance/education specialists when the brief explicitly asks for finance educators or personal-finance influencers.
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

/**
 * Coerce common LLM shape drift before Zod validation.
 * Models often emit `brand` / numeric `budget` even when the prompt asks for
 * `brandName` / `{ amount, currency }` — rejecting that discards explicit
 * market/category evidence and falls back to a weaker heuristic.
 */
export function coerceLlmExtractionJson(
  json: unknown,
  briefText: string
): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = { ...(json as Record<string, unknown>) };

  if (o.brandName == null && typeof o.brand === "string") {
    o.brandName = o.brand;
  }

  if (typeof o.budget === "number" && Number.isFinite(o.budget)) {
    const currencyMatch = briefText.match(/\b(AED|EGP|SAR|USD|EUR|GBP)\b/i);
    o.budget = {
      amount: o.budget,
      currency: (currencyMatch?.[1] ?? "USD").toUpperCase(),
    };
  }

  if (!Array.isArray(o.geography) && typeof o.market === "string" && o.market.trim()) {
    o.geography = [o.market.trim()];
  }

  if (o.fieldConfidence && typeof o.fieldConfidence === "object" && !Array.isArray(o.fieldConfidence)) {
    const fc = { ...(o.fieldConfidence as Record<string, number>) };
    if (fc.brandName == null && typeof fc.brand === "number") {
      fc.brandName = fc.brand;
    }
    o.fieldConfidence = fc;
  }

  return o;
}

function hasProfileValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Copy heuristic fields that were taken from the brief itself onto an LLM
 * profile that left them empty. Never copies inferred/default values
 * (invented platforms, synthesized audience, default objective).
 */
export function fillBriefSourcedHeuristicGaps(
  profile: CampaignIntelligenceProfile,
  briefText: string
): CampaignIntelligenceProfile {
  const heuristic = heuristicExtract(briefText);
  const next: CampaignIntelligenceProfile = { ...profile };

  const take = (
    key: keyof CampaignIntelligenceProfile,
    sourceKey: keyof NonNullable<CampaignIntelligenceProfile["sources"]>
  ) => {
    if (hasProfileValue(next[key])) return;
    if (heuristic.sources?.[sourceKey] !== "brief") return;
    if (!hasProfileValue(heuristic[key])) return;
    (next as Record<string, unknown>)[key as string] = heuristic[key];
    setProfileFieldMeta(
      next,
      sourceKey,
      "brief",
      heuristic.confidence?.[sourceKey] ?? 0.85
    );
  };

  take("brandName", "brandName");
  take("clientName", "clientName");
  take("objective", "objective");
  take("audience", "audience");
  take("geography", "geography");
  take("budget", "budget");
  take("durationWeeks", "durationWeeks");
  take("platforms", "platforms");
  take("deliverables", "deliverables");

  if (!next.campaignName?.trim() && heuristic.campaignName?.trim()) {
    next.campaignName = heuristic.campaignName;
  }
  if ((!next.products || next.products.length === 0) && heuristic.products?.length) {
    next.products = heuristic.products;
  }

  if (!next.market?.trim() && next.geography?.[0] && heuristic.sources?.geography === "brief") {
    next.market = next.geography[0];
  }
  if ((!next.objectives || next.objectives.length === 0) && next.objective?.trim()) {
    next.objectives = [next.objective];
  }

  if (next.platforms?.length) {
    const mentioned = next.platforms.filter((platform) =>
      new RegExp(`\\b${platform.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(briefText)
    );
    if (mentioned.length === 0) {
      delete next.platforms;
      if (next.sources) delete next.sources.platforms;
    } else {
      next.platforms = mentioned;
    }
  }

  return next;
}

function heuristicExtract(briefText: string): CampaignIntelligenceProfile {
  const facts = validateCampaignFacts(extractCampaignFacts({ rawMessage: briefText }));
  const profile = createEmptyCampaignIntelligenceProfile();

  profile.brandName = facts.brandName;
  profile.clientName = facts.clientName;
  profile.campaignName = facts.product;
  profile.products = facts.product ? [facts.product] : undefined;
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

  const derivedCategories = deriveCreatorCategoriesFromBrief({
    briefText,
    objective: facts.objective,
    audience: facts.audience,
    campaignName: facts.product,
    products: facts.product ? [facts.product] : undefined,
  });
  if (derivedCategories.length > 0) {
    profile.creatorCategories = derivedCategories;
  }

  if (facts.audience) {
    profile.audienceDetail = {
      countries: facts.geography ?? [],
    };
  }

  return profile;
}

function cleanGeoEntities(values: string[] | null | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const code = resolveCountryCode(raw);
    if (!code) continue;
    const label = countryLabel(code);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels.length > 0 ? labels : undefined;
}

function applyExtractedData(
  data: z.infer<typeof extractionSchema>,
  briefText: string
): CampaignIntelligenceProfile {
  const profile = createEmptyCampaignIntelligenceProfile();

  const brandCandidate = data.brandName ? sanitizeBrandName(data.brandName) : "";
  profile.brandName =
    brandCandidate && isValidBrandName(brandCandidate) ? brandCandidate : undefined;
  const clientCandidate = data.clientName ? sanitizeBrandName(data.clientName) : "";
  profile.clientName =
    clientCandidate && isValidClientName(clientCandidate) ? clientCandidate : undefined;
  profile.campaignName = data.campaignName ?? undefined;
  const marketCode = data.market ? resolveCountryCode(data.market) : null;
  profile.market = marketCode ? countryLabel(marketCode) : undefined;
  profile.campaignType = data.campaignType ?? undefined;
  profile.marketTier = data.marketTier ?? undefined;
  profile.objective = data.objective ?? undefined;
  profile.objectives = data.objectives ?? (data.objective ? [data.objective] : undefined);
  profile.products = data.products ?? undefined;
  profile.audience = data.audience ?? undefined;
  const audienceCountries = cleanGeoEntities(data.audienceDetail?.countries);
  profile.audienceDetail = data.audienceDetail
    ? {
        gender: data.audienceDetail.gender ?? undefined,
        ageMin: data.audienceDetail.ageMin ?? undefined,
        ageMax: data.audienceDetail.ageMax ?? undefined,
        countries: audienceCountries,
        cities: data.audienceDetail.cities ?? undefined,
        languages: data.audienceDetail.languages ?? undefined,
      }
    : undefined;
  profile.geography =
    cleanGeoEntities(data.geography) ??
    audienceCountries ??
    (profile.market ? [profile.market] : undefined);
  profile.platforms = data.platforms ?? undefined;
  profile.creatorCategories = deriveCreatorCategoriesFromBrief({
    briefText,
    objective: data.objective ?? data.objectives?.join(" "),
    audience: data.audience ?? undefined,
    campaignName: data.campaignName ?? undefined,
    products: data.products ?? undefined,
    existingCategories: data.creatorCategories ?? undefined,
  });
  if (profile.creatorCategories.length === 0) profile.creatorCategories = undefined;
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

  if (profile.market) {
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

    const coerced = coerceLlmExtractionJson(json, trimmed);
    const parsed = extractionSchema.safeParse(coerced);
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
