import {
  detectCurrencyFromSources,
  parseAudienceFromText,
  parseBrandFromText,
  parseBudgetTotalFromText,
  parseDurationFromText,
  parseMarketFromText,
  parseObjectiveFromText,
} from "@/features/campaign-studio/components/sections/shared/format-utils";
import {
  detectIndustryFromBrief,
  getIndustryProfile,
  resolveClientFromBrief,
} from "@/features/campaign-studio/services/industry-intelligence";
import { parseDurationWeeks } from "@/features/campaign-studio/services/timeline-duration";

import type {
  CampaignFacts,
  CampaignFactsExtractInput,
  CampaignFactsField,
  CampaignFactsSource,
} from "./campaign-facts-types";

function setField<T extends CampaignFactsField>(
  facts: CampaignFacts,
  field: T,
  value: CampaignFacts[T extends keyof CampaignFacts ? T : never] | undefined,
  source: CampaignFactsSource,
  confidence: number
): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value) && value.length === 0) return;
  if (typeof value === "string" && !value.trim()) return;

  (facts as Record<string, unknown>)[field] = value;
  facts.confidence[field] = confidence;
  facts.sources[field] = source;
}

function extractBrandName(input: CampaignFactsExtractInput): {
  value?: string;
  source: CampaignFactsSource;
  confidence: number;
} {
  if (input.brandName?.trim()) {
    return { value: input.brandName.trim(), source: "brief", confidence: 0.95 };
  }

  const parsed = parseBrandFromText(input.rawMessage);
  if (parsed) return { value: parsed, source: "brief", confidence: 0.9 };

  const match = input.rawMessage.match(
    /(?:campaign\s+for|launch|create\s+(?:a\s+)?(?:new\s+)?campaign\s+for?)\s+([A-Za-z0-9][\w\s-]*?)(?:\s+campaign|\s+in\s|\s*$|[.,!?])/i
  );
  if (match?.[1]?.trim()) {
    return { value: match[1].trim(), source: "brief", confidence: 0.85 };
  }

  return {
    value: resolveClientFromBrief(input.rawMessage),
    source: "inferred",
    confidence: 0.6,
  };
}

function extractGeography(text: string): string[] {
  const regions = new Set<string>();

  const market = parseMarketFromText(text);
  if (market) regions.add(market);

  const inMatch = text.match(/\bin\s+([A-Za-z][\w\s-]+?)(?:\.|,|\s+for|\s+target|\s+budget|$)/i);
  if (inMatch?.[1]?.trim()) regions.add(inMatch[1].trim());

  const acrossMatch = text.match(/across\s+([A-Za-z][\w\s,&-]+?)(?:\.|,|\s+for|\s+budget|$)/i);
  if (acrossMatch?.[1]?.trim()) regions.add(acrossMatch[1].trim());

  return [...regions];
}

function extractPlatforms(text: string, industry: ReturnType<typeof detectIndustryFromBrief>): string[] {
  const found: string[] = [];
  const patterns: Array<{ pattern: RegExp; platform: string }> = [
    { pattern: /\binstagram\b/i, platform: "Instagram" },
    { pattern: /\btiktok\b/i, platform: "TikTok" },
    { pattern: /\byoutube\b/i, platform: "YouTube" },
    { pattern: /\bsnapchat\b/i, platform: "Snapchat" },
    { pattern: /\bfacebook\b/i, platform: "Facebook" },
    { pattern: /\blinkedin\b/i, platform: "LinkedIn" },
  ];

  for (const { pattern, platform } of patterns) {
    if (pattern.test(text)) found.push(platform);
  }

  if (found.length > 0) return found;

  const profile = getIndustryProfile(industry, text);
  return profile.platforms.slice(0, 3);
}

function extractKpis(text: string, objective: string): string[] {
  const kpis: string[] = [];

  const reachMatch = text.match(/reach[:\s]*([\d,.]+\s*(?:M|K|m|k|%)?(?:\s+\w+)?)/i);
  if (reachMatch) kpis.push(`Reach: ${reachMatch[1].trim()}`);

  const engagementMatch = text.match(/engagement\s*rate[:\s]*([\d.]+\s*%?)/i);
  if (engagementMatch) kpis.push(`Engagement rate: ${engagementMatch[1].trim()}`);

  if (/conversion|sales|leads?/i.test(objective)) {
    kpis.push("Conversion rate: Category benchmark +15%");
  }

  if (/awareness/i.test(objective) && kpis.length === 0) {
    kpis.push("Reach: TBD — confirm with brand");
  }

  return kpis;
}

function extractConstraints(text: string): string[] {
  const constraints: string[] = [];
  if (/ugc|user[- ]generated/i.test(text)) {
    constraints.push("UGC-first content — creator fees include production");
  }
  if (/\b(?:no|without)\s+(?:separate\s+)?(?:content\s+)?production\b/i.test(text)) {
    constraints.push("No separate production line — 100% creator fees");
  }
  if (/\b(?:no|without)\s+(?:separate\s+|extended\s+|paid\s+)?usage\s*rights?\b/i.test(text)) {
    constraints.push("No usage rights line — organic creator bundle only");
  }
  if (/compliance|finance|banking|alcohol/i.test(text)) {
    constraints.push("Category compliance requirements apply to creator selection and messaging");
  }
  return constraints;
}

function extractRisks(text: string): string[] {
  const risks: string[] = [];
  if (/baby|parent|health/i.test(text)) {
    risks.push("Category sensitivity — messaging must align with parenting trust standards");
  }
  if (/\balcohol\b/i.test(text)) {
    risks.push("Age-gating and regional alcohol advertising regulations");
  }
  return risks;
}

/** Deterministic extraction of structured campaign facts from a raw brief. */
export function extractCampaignFacts(input: CampaignFactsExtractInput): CampaignFacts {
  const text = input.rawMessage.trim();
  const now = new Date().toISOString();

  const facts: CampaignFacts = {
    extractedAt: now,
    confidence: {},
    sources: {},
    rawBriefExcerpt: text.slice(0, 280),
  };

  const brand = extractBrandName(input);
  setField(facts, "brandName", brand.value, brand.source, brand.confidence);

  if (input.clientName?.trim()) {
    setField(facts, "clientName", input.clientName.trim(), "brief", 0.95);
  } else {
    const client = resolveClientFromBrief(text);
    if (client && client !== "Brand Client") {
      setField(facts, "clientName", client, "inferred", 0.7);
    }
  }

  const industryKey = detectIndustryFromBrief(text);
  const profile = getIndustryProfile(industryKey, text);
  setField(facts, "industry", profile.label, "brief", 0.85);
  setField(facts, "campaignType", profile.campaignType, "inferred", 0.75);

  const objective = parseObjectiveFromText(text) ?? "Brand awareness and engagement";
  setField(
    facts,
    "objective",
    objective,
    parseObjectiveFromText(text) ? "brief" : "default",
    parseObjectiveFromText(text) ? 0.9 : 0.5
  );

  const currency = detectCurrencyFromSources(text);
  const budgetAmount = parseBudgetTotalFromText(text);
  if (budgetAmount) {
    setField(facts, "budget", { amount: budgetAmount, currency }, "brief", 0.92);
  }

  const durationText = parseDurationFromText(text);
  const durationWeeks = durationText ? parseDurationWeeks(durationText) : parseDurationWeeks(text);
  setField(
    facts,
    "durationWeeks",
    durationWeeks,
    durationText ? "brief" : "default",
    durationText ? 0.9 : 0.5
  );

  const geography = extractGeography(text);
  if (geography.length > 0) {
    setField(facts, "geography", geography, "brief", 0.85);
  }

  const audience = parseAudienceFromText(text);
  if (audience) {
    setField(facts, "audience", audience, "brief", 0.88);
  } else {
    const mothersMatch = text.match(/mothers?\s+with\s+[^.]+/i);
    if (mothersMatch) {
      setField(facts, "audience", mothersMatch[0], "brief", 0.85);
    } else {
      const genZMatch = text.match(/gen\s*z[^.]+/i);
      if (genZMatch) {
        setField(facts, "audience", genZMatch[0], "brief", 0.85);
      } else {
        setField(
          facts,
          "audience",
          "Brand-relevant consumers in primary market",
          "default",
          0.4
        );
      }
    }
  }

  const platforms = extractPlatforms(text, industryKey);
  const platformSource: CampaignFactsSource = /\b(?:instagram|tiktok|youtube|snapchat|facebook|linkedin)\b/i.test(
    text
  )
    ? "brief"
    : "inferred";
  setField(facts, "platforms", platforms, platformSource, platformSource === "brief" ? 0.9 : 0.65);

  const kpis = extractKpis(text, objective);
  if (kpis.length > 0) {
    setField(facts, "kpis", kpis, "brief", 0.8);
  }

  const constraints = extractConstraints(text);
  if (constraints.length > 0) {
    setField(facts, "constraints", constraints, "brief", 0.85);
  }

  const risks = extractRisks(text);
  if (risks.length > 0) {
    setField(facts, "risks", risks, "inferred", 0.7);
  }

  return facts;
}
