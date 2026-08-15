import {
  detectCurrencyFromSources,
  parseAudienceFromText,
  parseBrandFromText,
  parseBudgetTotalFromText,
  parseMarketFromText,
  parseObjectiveFromText,
  parseProductFromText,
} from "@/features/campaign-studio/components/sections/shared/format-utils";
import {
  detectIndustryFromBrief,
  getIndustryProfile,
  resolveClientFromBrief,
} from "@/features/campaign-studio/services/industry-intelligence";
import { parseOptionalDurationWeeks } from "@/features/campaign-studio/services/timeline-duration";
import {
  isValidBrandName,
  sanitizeBrandName,
} from "@/features/campaign-intelligence-profile/services/normalization/validators";

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

/**
 * "campaign for <X>" names the paying client/brand — the capture must accept
 * brand punctuation ("e&", "P&G", "L'Oréal") and never swallow article-led
 * phrases ("launch an influencer campaign" → "an influencer").
 * Period is excluded so "for Dar Global. Brand:" does not become "Dar Global. Brand".
 */
const FOR_ATTRIBUTION_PATTERN =
  /(?:campaign|activation|launch)\s+for\s+([A-Za-z0-9][\w&+'’-]*(?:\s+[A-Za-z0-9][\w&+'’-]*){0,3})/i;

/** Stop "campaign for Arab Bank new credit card…" from swallowing the product. */
const FOR_ATTRIBUTION_STOP =
  /^(?:new|credit|card|instant|issuance|feature|mobile|app|and|would|in|targeting|across|on|to)\b/i;

function captureAttributedEntity(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const kept: string[] = [];
  for (const token of raw.trim().split(/\s+/)) {
    if (FOR_ATTRIBUTION_STOP.test(token)) break;
    kept.push(token);
  }
  return cleanEntityCapture(kept.join(" "));
}

const LAUNCH_PATTERN =
  /(?:launch|create\s+(?:a\s+)?(?:new\s+)?campaign\s+for)\s+([A-Za-z0-9][\w&+'’-]*(?:\s+[A-Za-z0-9][\w&+'’-]*){0,3})/i;

const ARTICLE_LED = /^(?:a|an|the|our|your|their|this|that|new)\b/i;
const GENERIC_CAMPAIGN_NOUN =
  /^(?:influencer|creator|marketing|social|media|summer|winter|awareness|ugc|brand)\b/i;

function cleanEntityCapture(raw: string | undefined): string | undefined {
  const value = raw?.trim().replace(/[.,;:]+$/, "");
  if (!value) return undefined;
  if (ARTICLE_LED.test(value) || GENERIC_CAMPAIGN_NOUN.test(value)) return undefined;
  return isValidBrandName(value) ? sanitizeBrandName(value) : undefined;
}

function extractBrandName(input: CampaignFactsExtractInput): {
  value?: string;
  source: CampaignFactsSource;
  confidence: number;
  fromForAttribution?: boolean;
} {
  if (input.brandName?.trim()) {
    const cleaned = cleanEntityCapture(input.brandName);
    if (cleaned) return { value: cleaned, source: "brief", confidence: 0.95 };
  }

  const parsed = cleanEntityCapture(parseBrandFromText(input.rawMessage));
  if (parsed) return { value: parsed, source: "brief", confidence: 0.9 };

  const forAttribution = captureAttributedEntity(
    input.rawMessage.match(FOR_ATTRIBUTION_PATTERN)?.[1]
  );
  if (forAttribution) {
    return {
      value: forAttribution,
      source: "brief",
      confidence: 0.9,
      fromForAttribution: true,
    };
  }

  const launched = cleanEntityCapture(input.rawMessage.match(LAUNCH_PATTERN)?.[1]);
  if (launched) {
    return { value: launched, source: "brief", confidence: 0.8 };
  }

  const inferredClient = resolveClientFromBrief(input.rawMessage);
  if (inferredClient && inferredClient !== "Brand Client") {
    return { value: inferredClient, source: "inferred", confidence: 0.6 };
  }

  return { value: undefined, source: "inferred", confidence: 0 };
}

/** Known markets/countries — free-text "in <phrase>" capture produced junk geography. */
const KNOWN_GEO_ENTITIES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\begypt\b/i, label: "Egypt" },
  { pattern: /\b(?:saudi\s*arabia|ksa)\b/i, label: "Saudi Arabia" },
  { pattern: /\b(?:uae|united\s+arab\s+emirates|dubai|abu\s+dhabi)\b/i, label: "UAE" },
  { pattern: /\bjordan\b/i, label: "Jordan" },
  { pattern: /\bkuwait\b/i, label: "Kuwait" },
  { pattern: /\bqatar\b/i, label: "Qatar" },
  { pattern: /\bbahrain\b/i, label: "Bahrain" },
  { pattern: /\boman\b/i, label: "Oman" },
  { pattern: /\bmorocco\b/i, label: "Morocco" },
  { pattern: /\blebanon\b/i, label: "Lebanon" },
  { pattern: /\bgcc\b/i, label: "GCC" },
  { pattern: /\bmena\b/i, label: "MENA" },
];

function extractGeography(text: string): string[] {
  const regions = new Set<string>();

  const market = parseMarketFromText(text);
  if (market) regions.add(market);

  for (const { pattern, label } of KNOWN_GEO_ENTITIES) {
    if (pattern.test(text)) regions.add(label);
  }

  // Canonical labels can duplicate parseMarketFromText output with different casing.
  // Never keep free-text residue ("Egypt, budget… Please search…").
  const allowed = new Set(KNOWN_GEO_ENTITIES.map((g) => g.label.toLowerCase()));
  const deduped = new Map<string, string>();
  for (const region of regions) {
    const key = region.trim().toLowerCase();
    if (!key || !allowed.has(key)) continue;
    if (!deduped.has(key)) deduped.set(key, region.trim());
  }
  return [...deduped.values()];
}

const DELIVERABLES_LABEL = /\b(?:agency\s+)?deliverables?\s*(?:->|[:：])\s*(.*)$/i;
const NEXT_LABEL_LINE = /^\s*[A-Za-z][A-Za-z\s/&]{0,40}[:：]\s*/;

function extractDeliverables(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const items: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const label = lines[i].match(DELIVERABLES_LABEL);
    if (!label) continue;

    // Same-line list: "Deliverables: 2 reels, 4 stories." — when the label sits
    // mid-sentence, stop the inline list at the first sentence boundary.
    const labelAtLineStart = /^\s*(?:agency\s+)?deliverables?/i.test(lines[i]);
    let inline = label[1]?.trim() ?? "";
    if (!labelAtLineStart) {
      inline = inline.split(/\.(?:\s|$)/)[0] ?? "";
    }
    inline = inline.replace(/\.\s*$/, "").trim();
    if (inline) {
      items.push(...inline.split(/[,;·|]/));
    }

    // Following bullet/plain lines until a blank line or the next "Label:" line.
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j].trim();
      if (!line) break;
      if (NEXT_LABEL_LINE.test(line) && !/^[-•*]/.test(lines[j].trim())) break;
      items.push(line.replace(/^[-•*\d.)\s]+/, ""));
    }
    break;
  }

  return items
    .map((d) => d.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 12);
}

function extractPlatforms(text: string): string[] {
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

  return found;
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
    // Placeholder vocabulary ("TBD") is rejected by the governance QA gate
    // (qa_no_placeholder) — the default KPI must be honest without it.
    kpis.push("Reach: confirm target with brand");
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
    rawBriefExcerpt: text.slice(0, 1500),
  };

  const brand = extractBrandName(input);
  setField(facts, "brandName", brand.value, brand.source, brand.confidence);

  if (input.clientName?.trim()) {
    setField(facts, "clientName", input.clientName.trim(), "brief", 0.95);
  } else {
    const client = resolveClientFromBrief(text);
    if (client && client !== "Brand Client") {
      setField(facts, "clientName", client, "inferred", 0.7);
    } else if (brand.value) {
      // STAB-030: labeled "Brand: Noon" (and "campaign for e&") — when no separate
      // legal entity is stated, the brand is the paying client for readiness /
      // Approve → Generate. Restricting to fromForAttribution left Client empty
      // and permanently blocked Campaign Plan submit.
      setField(
        facts,
        "clientName",
        brand.value,
        brand.fromForAttribution ? "brief" : "inferred",
        brand.fromForAttribution ? 0.85 : 0.75
      );
    }
  }

  const industryKey = detectIndustryFromBrief(text);
  const profile = getIndustryProfile(industryKey, text);
  setField(facts, "industry", profile.label, "brief", 0.85);
  setField(facts, "campaignType", profile.campaignType, "inferred", 0.75);

  const product = parseProductFromText(text);
  if (product) setField(facts, "product", product, "brief", 0.85);

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

  const durationWeeks = parseOptionalDurationWeeks(text);
  if (durationWeeks != null) {
    setField(facts, "durationWeeks", durationWeeks, "brief", 0.9);
  }

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
      }
    }
  }

  const platforms = extractPlatforms(text);
  if (platforms.length > 0) {
    setField(facts, "platforms", platforms, "brief", 0.9);
  }

  const kpis = extractKpis(text, objective);
  if (kpis.length > 0) {
    setField(facts, "kpis", kpis, "brief", 0.8);
  }

  const deliverables = extractDeliverables(text);
  if (deliverables.length > 0) {
    setField(facts, "deliverables", deliverables, "brief", 0.9);
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
