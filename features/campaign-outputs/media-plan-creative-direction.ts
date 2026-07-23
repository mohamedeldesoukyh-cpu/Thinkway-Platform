/**
 * Brief-first creative direction for Media Plan strategy sections.
 * Priority: brief concepts → uploaded strategy concepts → Thinkway recommendations only as fallback.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreativeConcept } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { containsArabicScript } from "@/lib/creators/arabic-category-keywords";
import { resolveCreativeConcepts } from "@/features/campaign-studio/services/section-data-resolver";

import { resolveBriefTextForScheduling } from "./brief-media-plan-schedule";
import type { MediaPlanCreativeRecommendation } from "./media-plan-strategy-narrative";
import { buildCreativeRecommendations } from "./media-plan-strategy-narrative";
import type { SlateCreator } from "./output-inputs";

export type BilingualCreativeConceptFields = {
  conceptName: string;
  creativeIdea: string;
  storyFlow?: string;
  talkingPoints?: string[];
  cta?: string;
  suggestedDialogue?: string;
  creatorNotes?: string;
};

export type MediaPlanCreativeConceptDisplay = {
  name: string;
  source: "brief" | "thinkway";
  english: BilingualCreativeConceptFields;
  arabic?: BilingualCreativeConceptFields;
};

export type MediaPlanCreativeDirectionResult = {
  concepts: MediaPlanCreativeConceptDisplay[];
  /** Thinkway-labelled recommendations — only when no approved brief concepts exist. */
  thinkwayRecommendations?: MediaPlanCreativeRecommendation[];
  isBilingual: boolean;
};

const BRIEF_FIELD_PATTERNS: Array<{ key: keyof BilingualCreativeConceptFields; patterns: RegExp[] }> = [
  { key: "conceptName", patterns: [/^concept\s*name\s*[:：]/im, /^اسم\s*المفهوم\s*[:：]/im] },
  { key: "creativeIdea", patterns: [/^creative\s*idea\s*[:：]/im, /^الفكرة\s*الإبداعية\s*[:：]/im, /^big\s*idea\s*[:：]/im] },
  { key: "storyFlow", patterns: [/^story\s*flow\s*[:：]/im, /^تسلسل\s*القصة\s*[:：]/im] },
  {
    key: "talkingPoints",
    patterns: [/^talking\s*points?\s*[:：]/im, /^نقاط\s*الحديث\s*[:：]/im, /^key\s*messages?\s*[:：]/im],
  },
  { key: "cta", patterns: [/^cta\s*[:：]/im, /^call\s*to\s*action\s*[:：]/im, /^دعوة\s*للعمل\s*[:：]/im] },
  {
    key: "suggestedDialogue",
    patterns: [/^suggested\s*dialogue\s*[:：]/im, /^dialogue\s*[:：]/im, /^حوار\s*مقترح\s*[:：]/im],
  },
  { key: "creatorNotes", patterns: [/^creator\s*notes?\s*[:：]/im, /^ملاحظات\s*المبدع\s*[:：]/im] },
];

function splitConceptBlocks(text: string): string[] {
  const blocks = text.split(/(?=^#{1,3}\s*concept\s+\d|^concept\s+\d\s*[:：.-]|^مفهوم\s+\d)/im);
  return blocks.map((block) => block.trim()).filter((block) => block.length > 20);
}

function extractFieldValue(block: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (!match) continue;
    const start = match.index! + match[0].length;
    const rest = block.slice(start);
    const nextField = rest.search(
      /\n\s*(?:concept\s*name|creative\s*idea|story\s*flow|talking\s*points?|cta|suggested\s*dialogue|creator\s*notes?|اسم\s*المفهوم|الفكرة\s*الإبداعية|تسلسل\s*القصة|نقاط\s*الحديث|دعوة\s*للعمل|حوار\s*مقترح|ملاحظات\s*المبدع)\s*[:：]/i
    );
    const value = (nextField >= 0 ? rest.slice(0, nextField) : rest).trim();
    if (value) return value;
  }
  return undefined;
}

function parseTalkingPoints(value: string): string[] {
  return value
    .split(/\n|•|·|–|-/)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseBriefConceptBlock(block: string, index: number): BilingualCreativeConceptFields | null {
  const englishBlock = block;
  const name =
    extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[0]!.patterns) ??
    block.match(/^concept\s*\d+\s*[:：.-]\s*(.+)$/im)?.[1]?.trim() ??
    `Concept ${index + 1}`;

  const creativeIdea =
    extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[1]!.patterns) ??
    extractFieldValue(englishBlock, [/^hook\s*[:：]/im]);

  if (!creativeIdea?.trim()) return null;

  const talkingPointsRaw = extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[3]!.patterns);

  return {
    conceptName: name,
    creativeIdea,
    storyFlow: extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[2]!.patterns),
    talkingPoints: talkingPointsRaw ? parseTalkingPoints(talkingPointsRaw) : undefined,
    cta: extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[4]!.patterns),
    suggestedDialogue: extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[5]!.patterns),
    creatorNotes: extractFieldValue(englishBlock, BRIEF_FIELD_PATTERNS[6]!.patterns),
  };
}

/** Parse structured creative concepts from raw brief text when present. */
export function parseCreativeConceptsFromBrief(briefText: string): MediaPlanCreativeConceptDisplay[] {
  const blocks = splitConceptBlocks(briefText);
  const concepts: MediaPlanCreativeConceptDisplay[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const english = parseBriefConceptBlock(block, index);
    if (!english) continue;

    const hasArabic = containsArabicScript(block);
    let arabic: BilingualCreativeConceptFields | undefined;
    if (hasArabic) {
      const arName = extractFieldValue(block, [/^اسم\s*المفهوم\s*[:：]/im]) ?? english.conceptName;
      const arIdea = extractFieldValue(block, [/^الفكرة\s*الإبداعية\s*[:：]/im]);
      if (arIdea) {
        const arTalking = extractFieldValue(block, [/^نقاط\s*الحديث\s*[:：]/im]);
        arabic = {
          conceptName: arName,
          creativeIdea: arIdea,
          storyFlow: extractFieldValue(block, [/^تسلسل\s*القصة\s*[:：]/im]),
          talkingPoints: arTalking ? parseTalkingPoints(arTalking) : undefined,
          cta: extractFieldValue(block, [/^دعوة\s*للعمل\s*[:：]/im]),
          suggestedDialogue: extractFieldValue(block, [/^حوار\s*مقترح\s*[:：]/im]),
          creatorNotes: extractFieldValue(block, [/^ملاحظات\s*المبدع\s*[:：]/im]),
        };
      }
    }

    concepts.push({
      name: english.conceptName,
      source: "brief",
      english,
      arabic,
    });
  }

  return concepts;
}

function mapStoredConceptToDisplay(concept: CreativeConcept, index: number): MediaPlanCreativeConceptDisplay {
  const talkingPoints = [
    concept.hook,
    concept.keyVisual,
    concept.contentTheme,
    concept.targetEmotion,
  ].filter((value): value is string => Boolean(value?.trim()));

  return {
    name: concept.name?.trim() || `Concept ${index + 1}`,
    source: "brief",
    english: {
      conceptName: concept.name?.trim() || `Concept ${index + 1}`,
      creativeIdea: concept.bigIdea?.trim() || concept.hook?.trim() || "",
      storyFlow: concept.contentTheme?.trim(),
      talkingPoints: talkingPoints.length ? talkingPoints : undefined,
      cta: concept.cta?.trim(),
      suggestedDialogue: concept.sampleCaption?.trim(),
      creatorNotes: [concept.creatorStyle, concept.visualDirection, concept.contentStyle]
        .filter(Boolean)
        .join(" · ") || undefined,
    },
  };
}

/** Approved concepts from strategy.data or parseable brief sections — never AI-overwritten. */
export function resolveApprovedCreativeConcepts(
  campaignObject: CampaignObject
): MediaPlanCreativeConceptDisplay[] {
  const stored = resolveCreativeConcepts(campaignObject);
  if (stored.length) {
    return stored
      .filter((concept) => concept.bigIdea?.trim() || concept.hook?.trim())
      .map((concept, index) => mapStoredConceptToDisplay(concept, index));
  }

  const briefText = resolveBriefTextForScheduling(campaignObject);
  return parseCreativeConceptsFromBrief(briefText);
}

export function formatCreativeConceptForDisplay(concept: MediaPlanCreativeConceptDisplay): string[] {
  const lines: string[] = [];
  const prefix = concept.source === "thinkway" ? "Thinkway Creative Recommendation — " : "";

  lines.push(`${prefix}${concept.english.conceptName}`);
  lines.push(`Creative Idea: ${concept.english.creativeIdea}`);
  if (concept.english.storyFlow) lines.push(`Story Flow: ${concept.english.storyFlow}`);
  if (concept.english.talkingPoints?.length) {
    lines.push(`Talking Points: ${concept.english.talkingPoints.join(" · ")}`);
  }
  if (concept.english.cta) lines.push(`CTA: ${concept.english.cta}`);
  if (concept.english.suggestedDialogue) lines.push(`Suggested Dialogue: ${concept.english.suggestedDialogue}`);
  if (concept.english.creatorNotes) lines.push(`Creator Notes: ${concept.english.creatorNotes}`);

  if (concept.arabic) {
    lines.push("—");
    lines.push(`${concept.arabic.conceptName}`);
    lines.push(`الفكرة الإبداعية: ${concept.arabic.creativeIdea}`);
    if (concept.arabic.storyFlow) lines.push(`تسلسل القصة: ${concept.arabic.storyFlow}`);
    if (concept.arabic.talkingPoints?.length) {
      lines.push(`نقاط الحديث: ${concept.arabic.talkingPoints.join(" · ")}`);
    }
    if (concept.arabic.cta) lines.push(`دعوة للعمل: ${concept.arabic.cta}`);
    if (concept.arabic.suggestedDialogue) lines.push(`حوار مقترح: ${concept.arabic.suggestedDialogue}`);
    if (concept.arabic.creatorNotes) lines.push(`ملاحظات المبدع: ${concept.arabic.creatorNotes}`);
  }

  return lines;
}

function escapeCreativeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderConceptFieldsHtml(
  fields: BilingualCreativeConceptFields,
  locale: "en" | "ar"
): string {
  const rows: string[] = [];
  const push = (label: string, value?: string | string[]) => {
    if (!value || (Array.isArray(value) && !value.length)) return;
    const text = Array.isArray(value) ? value.join(" · ") : value;
    rows.push(
      `<div class="cd-field"><span class="cd-label">${escapeCreativeHtml(label)}</span><span class="cd-value">${escapeCreativeHtml(text)}</span></div>`
    );
  };

  if (locale === "ar") {
    push("اسم المفهوم", fields.conceptName);
    push("الفكرة الإبداعية", fields.creativeIdea);
    push("تسلسل القصة", fields.storyFlow);
    push("نقاط الحديث", fields.talkingPoints);
    push("دعوة للعمل", fields.cta);
    push("حوار مقترح", fields.suggestedDialogue);
    push("ملاحظات المبدع", fields.creatorNotes);
  } else {
    push("Concept Title", fields.conceptName);
    push("Creative Idea", fields.creativeIdea);
    push("Story Flow", fields.storyFlow);
    push("Talking Points", fields.talkingPoints);
    push("CTA", fields.cta);
    push("Suggested Dialogue", fields.suggestedDialogue);
    push("Creator Notes", fields.creatorNotes);
  }

  return rows.join("");
}

/** Structured bilingual creative concept markup for HTML export/preview — language tabs, no mixed locale. */
export function renderCreativeConceptHtml(
  concept: MediaPlanCreativeConceptDisplay,
  options?: { language?: "en" | "ar" | "bilingual" }
): string {
  const language = options?.language ?? "en";
  const sourceBadge =
    concept.source === "thinkway"
      ? `<span class="cd-source">Thinkway Creative Recommendation</span>`
      : "";
  const english = renderConceptFieldsHtml(concept.english, "en");
  const arabic = concept.arabic
    ? `<div class="cd-locale cd-locale-ar" dir="rtl">${renderConceptFieldsHtml(concept.arabic, "ar")}</div>`
    : "";

  const tabs =
    language === "bilingual" && concept.arabic
      ? `<div class="cd-lang-tabs">
          <button type="button" class="cd-lang-tab on" data-cd-lang="en">English</button>
          <button type="button" class="cd-lang-tab" data-cd-lang="ar">العربية</button>
        </div>`
      : "";

  const activeLang = language === "ar" ? "ar" : "en";
  const localeContent =
    language === "ar" && concept.arabic
      ? `<div class="cd-locale cd-locale-ar" dir="rtl">${renderConceptFieldsHtml(concept.arabic, "ar")}</div>`
      : `<div class="cd-locale cd-locale-en">${english}</div>`;

  if (language === "bilingual" && concept.arabic) {
    return `<div class="cd-concept" data-active-lang="en">
      ${sourceBadge}
      ${tabs}
      <div class="cd-locale cd-locale-en">${english}</div>
      ${arabic}
    </div>`;
  }

  return `<div class="cd-concept" data-active-lang="${activeLang}">
    ${sourceBadge}
    ${localeContent}
  </div>`;
}

export function renderCreativeConceptsHtml(
  concepts: MediaPlanCreativeConceptDisplay[],
  options?: { language?: "en" | "ar" | "bilingual" }
): string {
  return concepts.map((concept) => renderCreativeConceptHtml(concept, options)).join("");
}

/** Brief-first creative direction — Thinkway recommendations only when no approved concepts. */
export function buildMediaPlanCreativeDirection(input: {
  campaignObject: CampaignObject;
  briefText: string;
  objective?: string;
  industry?: string;
  platformAllocation: Record<string, number>;
  slate: SlateCreator[];
}): MediaPlanCreativeDirectionResult {
  const approved = resolveApprovedCreativeConcepts(input.campaignObject);
  const briefHasArabic = containsArabicScript(input.briefText);

  if (approved.length) {
    return {
      concepts: approved,
      isBilingual: briefHasArabic || approved.some((concept) => Boolean(concept.arabic)),
    };
  }

  const recommendations = buildCreativeRecommendations({
    briefText: input.briefText,
    objective: input.objective,
    industry: input.industry ?? getCampaignFacts(input.campaignObject)?.industry,
    platformAllocation: input.platformAllocation,
    slate: input.slate,
  });

  const thinkwayConcepts: MediaPlanCreativeConceptDisplay[] = recommendations.map((entry) => ({
    name: entry.format,
    source: "thinkway",
    english: {
      conceptName: entry.format,
      creativeIdea: entry.reason,
    },
  }));

  return {
    concepts: thinkwayConcepts,
    thinkwayRecommendations: recommendations,
    isBilingual: briefHasArabic,
  };
}
