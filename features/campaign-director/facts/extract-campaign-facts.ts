import {
  detectCurrencyFromSources,
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

/**
 * Labels that open a labelled block in a brief.
 *
 * Document uploads reach extraction through `serializeStructuredBrief()`, which
 * writes section titles as `Section: <title>` and heading blocks as bare text —
 * neither carries a trailing colon. A bare `Deliverables` line therefore closes
 * the preceding block exactly as `Deliverables:` does.
 */
const CANONICAL_BRIEF_LABELS = [
  "Objective",
  "Objectives",
  "Campaign objective",
  "Campaign objectives",
  "Target audience",
  "Primary audience",
  "Audience",
  "Consumer target",
  "Target consumer",
  "Key message",
  "Core message",
  "Message",
  "Key msg",
  "Call to action",
  "Call-to-action",
  "CTA",
  "Tone",
  "Tone of voice",
  "Voice",
  "Campaign goal",
  "Campaign funnel",
  "Funnel",
  "Goal",
  "Deliverable",
  "Deliverables",
  "Agency deliverables",
  "Creator deliverables",
  "Brand",
  "Client",
  "Market",
  "Budget",
  "Platform",
  "Platforms",
  "Duration",
  "Campaign duration",
  "KPI",
  "KPIs",
  "Category",
  "Product",
] as const;

const CANONICAL_BRIEF_LABEL_SET = new Set(
  CANONICAL_BRIEF_LABELS.map((label) => label.toLowerCase())
);

/** Bullet / quote / markdown-heading noise permitted before a label. */
const LABEL_LEAD = String.raw`[ \t>*\-•#]*`;
/** `serializeStructuredBrief()` prefixes section titles with this marker. */
const SECTION_MARKER = String.raw`(?:section[ \t]*[:：][ \t]*)?`;
/** `Label: value`, `Label — value`, and the serialized key/value table `Label -> value`. */
const LABEL_SEPARATOR = String.raw`(?:->|[:：\-—])`;
/**
 * Separator set for labels that also occur as ordinary hyphenated words, where
 * a bare dash is not a label separator at all ("Deliverable-based pricing…").
 * A colon or the serialized table arrow is required.
 */
const EXPLICIT_LABEL_SEPARATOR = String.raw`(?:->|[:：])`;
/**
 * A line that opens the next labelled field, closing the block above it.
 *
 * Deliberately as broad as the terminator it replaced: the label may contain
 * digits ("Phase 1: launch") and may be closed by a dash or em dash
 * ("Awareness - drive trial", "Note — see appendix"), not only a colon.
 * Narrowing it silently let those lines be absorbed into the previous value.
 */
const NEXT_LABEL_LINE = /^[\s>*\-•]*[A-Za-z][\w /&'()-]{2,40}[ \t]*[:：\-—]/;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBulletMarker(line: string): string {
  return line.replace(/^[\s>*\-•]+/, "").trim();
}

/** True when a line opens a new labelled block, closing the one being read. */
function isBlockBoundaryLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^[-•*]/.test(trimmed)) return false; // bullets are block content, not a new label
  if (/^section[ \t]*[:：]/i.test(trimmed)) return true;
  // Covers serialized key/value table rows too (`Market -> Egypt`), since the
  // dash of the arrow closes the label.
  if (NEXT_LABEL_LINE.test(trimmed)) return true;
  const bare = trimmed.replace(/[:：\-—]+$/, "").trim().toLowerCase();
  return CANONICAL_BRIEF_LABEL_SET.has(bare);
}

export type LabeledBriefBlock = {
  /** Text on the label line itself; empty when the label stands alone as a heading. */
  inline: string;
  /** Lines beneath the label, up to the next blank line or labelled block. */
  lines: string[];
  /** False when the label was matched mid-sentence (single-line chat briefs). */
  atLineStart: boolean;
};

/**
 * Canonical labelled-block reader. Recognises every label shape the platform
 * actually receives:
 *
 *   `Label: value`                     — chat and single-line briefs
 *   `Label:` + value on the next line  — block-form briefs
 *   `Section: Label` + value beneath   — serialized section titles
 *   `Label` + value on the next line   — serialized heading blocks
 *   `Label -> value`                   — serialized key/value tables
 *
 * Returns one candidate block per label, in label order, so callers can fall
 * through to the next label when a block turns out to hold no usable value.
 */
export function readLabeledBriefBlocks(
  text: string,
  labels: readonly string[],
  options: { allowMidLine?: boolean; requireExplicitSeparator?: boolean } = {}
): LabeledBriefBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: LabeledBriefBlock[] = [];
  const separator = options.requireExplicitSeparator
    ? EXPLICIT_LABEL_SEPARATOR
    : LABEL_SEPARATOR;

  for (const label of labels) {
    const escaped = escapeForRegExp(label);
    const inlinePattern = new RegExp(
      `^${LABEL_LEAD}${SECTION_MARKER}${escaped}[ \\t]*${separator}[ \\t]*(\\S.*)$`,
      "i"
    );
    const headingPattern = new RegExp(
      `^${LABEL_LEAD}${SECTION_MARKER}${escaped}[ \\t]*(?:${separator})?[ \\t]*$`,
      "i"
    );
    const midLinePattern = options.allowMidLine
      ? new RegExp(`\\b${escaped}[ \\t]*${separator}[ \\t]*(.*)$`, "i")
      : undefined;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      let inline: string | undefined;
      let atLineStart = true;

      const inlineMatch = line.match(inlinePattern);
      if (inlineMatch) {
        inline = inlineMatch[1]?.trim() ?? "";
      } else if (headingPattern.test(line)) {
        inline = "";
      } else if (midLinePattern) {
        const midMatch = line.match(midLinePattern);
        if (midMatch) {
          inline = midMatch[1]?.trim() ?? "";
          atLineStart = false;
        }
      }
      if (inline === undefined) continue;

      // A mid-sentence label owns only the rest of its own line.
      const body: string[] = [];
      if (atLineStart) {
        for (let j = i + 1; j < lines.length; j += 1) {
          if (isBlockBoundaryLine(lines[j] ?? "")) break;
          const content = stripBulletMarker(lines[j] ?? "");
          if (content) body.push(content);
        }
      }

      blocks.push({ inline, lines: body, atLineStart });
      break;
    }
  }

  return blocks;
}

/**
 * Read a labelled block from a brief as a single string. Returns undefined
 * rather than a bare label, so a heading never becomes the extracted value.
 */
export function readLabeledBriefValue(
  text: string,
  labels: readonly string[]
): string | undefined {
  for (const block of readLabeledBriefBlocks(text, labels)) {
    const value = [block.inline, ...block.lines]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // A value that is only another label (e.g. "Target" → "Audience:") is not a value.
    if (!value || /^[A-Za-z][\w /&'()-]{0,40}[:\-—]$/.test(value)) continue;
    if (value.length < 3) continue;
    return value;
  }
  return undefined;
}

const DELIVERABLES_LABELS = [
  "Agency deliverables",
  "Creator deliverables",
  "Content deliverables",
  "Deliverables",
  "Deliverable",
] as const;

/** Ordered-list marker left by a serialized `1. item` list block. */
const ORDERED_LIST_MARKER = /^\d+[.)]\s+/;

function extractDeliverables(text: string): string[] {
  // `requireExplicitSeparator`: "Deliverable" is also an ordinary word stem, so
  // a bare dash must not open the block ("Deliverable-based pricing is …").
  const [block] = readLabeledBriefBlocks(text, DELIVERABLES_LABELS, {
    allowMidLine: true,
    requireExplicitSeparator: true,
  });
  if (!block) return [];

  const items: string[] = [];

  // Same-line list: "Deliverables: 2 reels, 4 stories." — when the label sits
  // mid-sentence, stop the inline list at the first sentence boundary.
  let inline = block.inline;
  if (!block.atLineStart) {
    inline = inline.split(/\.(?:\s|$)/)[0] ?? "";
  }
  inline = inline.replace(/\.\s*$/, "").trim();
  if (inline) {
    items.push(...inline.split(/[,;·|]/));
  }

  // Bullet / plain lines beneath the label are one deliverable each — never
  // comma-split, or a single line listing metrics would fragment into noise.
  for (const line of block.lines) {
    items.push(line.replace(ORDERED_LIST_MARKER, ""));
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

const AUDIENCE_LABELS = [
  "Target audience",
  "Primary audience",
  "Target Audience",
  "Audience",
  "Who we are talking to",
  "Who we're talking to",
  "Consumer target",
  "Target consumer",
] as const;

/** Audience prose from a labelled brief block. Never returns a bare label. */
export function extractAudienceFromBrief(text: string): string | undefined {
  const labeled = readLabeledBriefValue(text, AUDIENCE_LABELS);
  if (labeled) return labeled;

  // Unlabelled audience statements briefs commonly use in prose.
  const mass = text.match(/\btargeting\s+(?:a\s+)?(mass audience)\b/i);
  if (mass?.[1]) return mass[1].trim();
  const mothers = text.match(/mothers?\s+with\s+[^.\n]+/i);
  if (mothers?.[0]) return mothers[0].trim();
  const genZ = text.match(/gen\s*z[^.\n]+/i);
  if (genZ?.[0]) return genZ[0].trim();
  return undefined;
}

const OBJECTIVE_LABELS = [
  "Campaign objective",
  "Campaign objectives",
  "Objective",
  "Objectives",
] as const;

/**
 * Campaign objective stated in the brief.
 *
 * The canonical labelled-block reader runs first so uploaded documents — whose
 * serialized text carries `Section: Campaign Objective` headings with no colon
 * after the label — resolve. Single-line chat briefs ("… Objective: awareness
 * and engagement. Need 3 creators …") keep the mid-sentence parser.
 */
export function extractObjectiveFromBrief(text: string): string | undefined {
  return readLabeledBriefValue(text, OBJECTIVE_LABELS) ?? parseObjectiveFromText(text);
}

const KEY_MESSAGE_LABELS = ["Key message", "Core message", "Message", "Key msg"] as const;
const CTA_LABELS = ["Call to action", "CTA", "Call-to-action"] as const;
const TONE_LABELS = ["Tone", "Tone of voice", "Voice"] as const;
const FUNNEL_LABELS = ["Campaign goal", "Funnel", "Campaign funnel", "Goal"] as const;

/** Key message stated in the brief. Undefined when absent — never invented. */
export function extractKeyMessageFromBrief(text: string): string | undefined {
  return readLabeledBriefValue(text, KEY_MESSAGE_LABELS);
}

/** Call to action stated in the brief. */
export function extractCallToActionFromBrief(text: string): string | undefined {
  return readLabeledBriefValue(text, CTA_LABELS);
}

/** Tone descriptors stated in the brief, split on commas. */
export function extractToneFromBrief(text: string): string[] {
  const value = readLabeledBriefValue(text, TONE_LABELS);
  if (!value) return [];
  return value
    .split(/[,;]|\band\b/i)
    .map((part) => part.trim().replace(/[.]+$/, ""))
    .filter((part) => part.length > 1);
}

/**
 * Funnel stages stated in the brief (e.g. "Awareness → Interest → Trial").
 * A funnel is campaign intent, never a KPI.
 */
export function extractCampaignFunnelFromBrief(text: string): string[] {
  const value = readLabeledBriefValue(text, FUNNEL_LABELS);
  const source = value ?? text;
  const chain = source.match(
    /([A-Za-z][A-Za-z /&-]{2,24}?)\s*(?:->|→|➞|>|then)\s*([A-Za-z][A-Za-z /&-]{2,24}?)(?:\s*(?:->|→|➞|>|then)\s*([A-Za-z][A-Za-z /&-]{2,24}?))?(?=[.\n]|$)/
  );
  if (!chain) return [];
  return [chain[1], chain[2], chain[3]]
    .filter((stage): stage is string => Boolean(stage?.trim()))
    .map((stage) => stage.trim().replace(/[.]+$/, ""));
}

/**
 * KPIs explicitly stated in the brief.
 *
 * Never synthesises a KPI. A brief that states no success measurement yields an
 * empty list, so Intake can show it as genuinely missing rather than inventing
 * a target and labelling it `brief`.
 */
function extractKpis(text: string): string[] {
  const kpis: string[] = [];
  const seen = new Set<string>();

  const push = (label: string, value: string) => {
    const cleaned = value.trim().replace(/[.,;:\s]+$/, "");
    if (!cleaned || !/\d/.test(cleaned)) return;
    const entry = `${label}: ${cleaned}`;
    if (seen.has(entry.toLowerCase())) return;
    seen.add(entry.toLowerCase());
    kpis.push(entry);
  };

  // A numeric value is required — a bare metric word is an objective, not a KPI.
  // Briefs write both orders ("5M reach" and "reach: 5M"), so try each.
  const metrics: Array<{ label: string; word: string; unit: string }> = [
    { label: "Reach", word: "reach", unit: "(?:M|K|BN|B)?" },
    { label: "Views", word: "(?:video\\s+)?views", unit: "(?:M|K)?" },
    { label: "Engagement rate", word: "engagement(?:\\s*rate)?", unit: "%?" },
    { label: "Conversion rate", word: "conversion(?:\\s*rate)?", unit: "%?" },
    { label: "Impressions", word: "impressions", unit: "(?:M|K)?" },
  ];

  for (const { label, word, unit } of metrics) {
    const valueFirst = text.match(
      new RegExp(`(\\d[\\d,.]*\\s*${unit})\\s*(?:of\\s+)?${word}\\b`, "i")
    );
    if (valueFirst?.[1]) {
      push(label, valueFirst[1]);
      continue;
    }
    const labelFirst = text.match(
      new RegExp(`\\b${word}\\b[^\\d\\n]{0,20}(\\d[\\d,.]*\\s*${unit})`, "i")
    );
    if (labelFirst?.[1]) push(label, labelFirst[1]);
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

  const briefObjective = extractObjectiveFromBrief(text);
  setField(
    facts,
    "objective",
    briefObjective ?? "Brand awareness and engagement",
    briefObjective ? "brief" : "default",
    briefObjective ? 0.9 : 0.5
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

  const audience = extractAudienceFromBrief(text);
  if (audience) {
    setField(facts, "audience", audience, "brief", 0.88);
  }

  // Campaign intent stated in the brief. Absent → left undefined, never invented.
  const keyMessage = extractKeyMessageFromBrief(text);
  if (keyMessage) {
    setField(facts, "keyMessage", keyMessage, "brief", 0.85);
  }

  const callToAction = extractCallToActionFromBrief(text);
  if (callToAction) {
    setField(facts, "callToAction", callToAction, "brief", 0.85);
  }

  const campaignFunnel = extractCampaignFunnelFromBrief(text);
  if (campaignFunnel.length > 0) {
    setField(facts, "campaignFunnel", campaignFunnel, "brief", 0.85);
  }

  const toneOfVoice = extractToneFromBrief(text);
  if (toneOfVoice.length > 0) {
    setField(facts, "toneOfVoice", toneOfVoice, "brief", 0.85);
  }

  const platforms = extractPlatforms(text);
  if (platforms.length > 0) {
    setField(facts, "platforms", platforms, "brief", 0.9);
  }

  const kpis = extractKpis(text);
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
