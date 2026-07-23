/**
 * Influencer Concepts — campaign-level creative concepts for Media Plan Creative Direction.
 * Priority: brief extraction → uploaded/approved meta → AI generation (fallback only).
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { containsArabicScript } from "@/lib/creators/arabic-category-keywords";
import { resolveMarketIntelligenceConfig } from "@/features/market-intelligence/market-intelligence-config";
import type { MarketCountry } from "@/features/market-intelligence/types";

import { resolveBriefTextForScheduling } from "./brief-media-plan-schedule";
import { parseCreativeConceptsFromBrief } from "./media-plan-creative-direction";
import type { SlateCreator } from "./output-inputs";
import { sortedPlatforms } from "./media-plan-strategy-narrative";
import {
  classifyCampaignType,
  type CampaignTypeClassification,
} from "./campaign-type-classifier";
import { resolveAllowedMechanics, narrativeReferencesDisallowedMechanic, sanitizeMechanicReferences } from "./media-plan-mechanics-ssot";

export type InfluencerConceptCreatorCategory =
  | "lifestyle"
  | "food"
  | "comedy"
  | "fitness"
  | "family"
  | "beauty"
  | "travel";

export type InfluencerConceptLocaleContent = {
  /** Agency field — alias of conceptTitle for structured briefs. */
  conceptName?: string;
  conceptTitle: string;
  /** Agency field — alias of creativeObjective. */
  objective?: string;
  creativeObjective: string;
  creatorJourney?: string;
  openingHook?: string;
  targetCreatorTypes: string[];
  recommendedPlatforms: string[];
  suggestedDeliverables: string[];
  expectedAudienceReaction: string;
  storyFlow: string;
  /** Agency field — alias of suggestedDialogue. */
  dialogue?: string;
  suggestedDialogue?: string;
  keyTalkingPoints: string[];
  visualStyle?: string;
  cameraDirection?: string;
  music?: string;
  transitions?: string;
  /** Agency field — alias of suggestedShotList. */
  shotList?: string[];
  suggestedShotList: string[];
  brandIntegration?: string;
  cta: string;
  hashtags: string[];
  /** Agency field — alias of productionNotes. */
  creatorNotes?: string;
  productionNotes: string;
  approvalNotes?: string;
  estimatedDuration: string;
  creatorAdaptations: Partial<Record<InfluencerConceptCreatorCategory, string>>;
};

/** Resolve agency field aliases to canonical display values. */
export function resolveConceptLocaleFields(
  content: InfluencerConceptLocaleContent
): Required<
  Pick<
    InfluencerConceptLocaleContent,
    | "conceptTitle"
    | "creativeObjective"
    | "suggestedDialogue"
    | "suggestedShotList"
    | "productionNotes"
  >
> &
  InfluencerConceptLocaleContent {
  return {
    ...content,
    conceptTitle: content.conceptName?.trim() || content.conceptTitle || "",
    creativeObjective: content.objective?.trim() || content.creativeObjective || "",
    suggestedDialogue: content.dialogue?.trim() || content.suggestedDialogue || "",
    suggestedShotList:
      content.shotList?.length ? content.shotList : content.suggestedShotList ?? [],
    productionNotes: content.creatorNotes?.trim() || content.productionNotes || "",
  };
}

const CREATOR_CATEGORY_LABELS: Record<
  InfluencerConceptCreatorCategory,
  { en: string; ar: string }
> = {
  lifestyle: { en: "Lifestyle", ar: "لايف ستايل" },
  food: { en: "Food", ar: "طعام" },
  comedy: { en: "Comedy", ar: "كوميديا" },
  fitness: { en: "Fitness", ar: "لياقة" },
  family: { en: "Family", ar: "عائلة" },
  beauty: { en: "Beauty", ar: "جمال" },
  travel: { en: "Travel", ar: "سفر" },
};

/** Localized creator category label for EN/AR views. */
export function localizeCreatorCategory(category: string, locale: "en" | "ar"): string {
  const key = category.toLowerCase() as InfluencerConceptCreatorCategory;
  return CREATOR_CATEGORY_LABELS[key]?.[locale] ?? category;
}

const DELIVERABLE_LABELS_AR: Record<string, string> = {
  reel: "ريل",
  "story series": "سلسلة ستوري",
  story: "ستوري",
  carousel: "كاروسel",
};

function localizeDeliverableLabel(deliverable: string, locale: "en" | "ar"): string {
  if (locale === "en") return deliverable;
  const key = deliverable.trim().toLowerCase();
  if (key === "carousel") return "Carousel";
  return DELIVERABLE_LABELS_AR[key] ?? deliverable;
}

function localizeDurationArabic(duration: string): string {
  return duration
    .replace(/\b45–60 seconds\b/i, "45–60 ثانية")
    .replace(/\b30–45 seconds\b/i, "30–45 ثانية")
    .replace(/\b30 seconds\b/i, "30 ثانية")
    .replace(/\bseconds\b/gi, "ثانية")
    .replace(/\bsecond\b/gi, "ثانية");
}

/** Meta boilerplate — not shown in UI or exports. */
export function isProductionNotesBoilerplate(notes: string | undefined): boolean {
  if (!notes?.trim()) return false;
  const normalized = notes.trim();
  return (
    /^إنتاج بأسلوب المنصة — لهجة .+ محلية، بدون ترجمة حرفية$/.test(normalized) ||
    /^platform[- ]native style — local dialect, no literal translation$/i.test(normalized) ||
    /^platform style — local dialect, no literal translation$/i.test(normalized)
  );
}

export function shouldShowProductionNotes(notes: string | undefined): boolean {
  if (!notes?.trim()) return false;
  return !isProductionNotesBoilerplate(notes);
}

export type InfluencerConceptSource = "brief" | "upload" | "ai" | "manual";

export type InfluencerConcept = {
  id: string;
  source: InfluencerConceptSource;
  approved?: boolean;
  english: InfluencerConceptLocaleContent;
  arabic: InfluencerConceptLocaleContent;
  uploadedFileRef?: string;
  createdAt?: string;
};

export type InfluencerConceptUploadRef = {
  id: string;
  fileName: string;
  uploadedAt: string;
  mimeType?: string;
  storagePath?: string;
};

/** Persisted on campaign object meta — approved concepts + upload refs (Concept Library stub). */
export type InfluencerConceptsMeta = {
  concepts: InfluencerConcept[];
  approvedConceptIds?: string[];
  uploads?: InfluencerConceptUploadRef[];
  libraryTags?: {
    brand?: string;
    industry?: string;
    country?: string;
  };
};

export type InfluencerConceptsResult = {
  concepts: InfluencerConcept[];
  source: "brief" | "stored" | "ai" | "none";
  dialect: string;
  isBilingual: boolean;
};

const ALL_CREATOR_CATEGORIES: InfluencerConceptCreatorCategory[] = [
  "lifestyle",
  "food",
  "comedy",
  "fitness",
  "family",
  "beauty",
  "travel",
];

const BRIEF_INFLUENCER_FIELD_PATTERNS: Array<{
  key: keyof InfluencerConceptLocaleContent;
  patterns: RegExp[];
}> = [
  { key: "conceptTitle", patterns: [/^concept\s*title\s*[:：]/im, /^influencer\s*concept\s*\d*\s*[:：.-]/im] },
  { key: "creativeObjective", patterns: [/^creative\s*objective\s*[:：]/im, /^objective\s*[:：]/im] },
  {
    key: "targetCreatorTypes",
    patterns: [/^target\s*creator\s*types?\s*[:：]/im, /^creator\s*types?\s*[:：]/im],
  },
  { key: "recommendedPlatforms", patterns: [/^recommended\s*platforms?\s*[:：]/im, /^platforms?\s*[:：]/im] },
  {
    key: "suggestedDeliverables",
    patterns: [/^suggested\s*deliverables?\s*[:：]/im, /^deliverables?\s*[:：]/im],
  },
  {
    key: "expectedAudienceReaction",
    patterns: [/^expected\s*audience\s*reaction\s*[:：]/im, /^audience\s*reaction\s*[:：]/im],
  },
  { key: "storyFlow", patterns: [/^story\s*flow\s*[:：]/im, /^storyboard\s*[:：]/im] },
  { key: "suggestedDialogue", patterns: [/^suggested\s*dialogue\s*[:：]/im, /^script\s*[:：]/im] },
  { key: "keyTalkingPoints", patterns: [/^key\s*talking\s*points?\s*[:：]/im, /^talking\s*points?\s*[:：]/im] },
  { key: "cta", patterns: [/^cta\s*[:：]/im, /^call\s*to\s*action\s*[:：]/im] },
  { key: "hashtags", patterns: [/^hashtags?\s*[:：]/im] },
  { key: "suggestedShotList", patterns: [/^suggested\s*shot\s*list\s*[:：]/im, /^shot\s*list\s*[:：]/im] },
  { key: "productionNotes", patterns: [/^production\s*notes?\s*[:：]/im] },
  { key: "estimatedDuration", patterns: [/^estimated\s*duration\s*[:：]/im, /^duration\s*[:：]/im] },
];

function createConceptId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}-${Math.abs(hashString(`${prefix}-${index}`)).toString(36).slice(0, 6)}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function splitInfluencerConceptBlocks(text: string): string[] {
  const blocks = text.split(
    /(?=^#{1,3}\s*(?:influencer\s*)?concept\s+\d|^influencer\s*concept\s+\d\s*[:：.-]|^concept\s+\d\s*[:：.-])/im
  );
  return blocks.map((block) => block.trim()).filter((block) => block.length > 30);
}

function extractBriefField(block: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (!match) continue;
    const start = match.index! + match[0].length;
    const rest = block.slice(start);
    const nextField = rest.search(
      /\n\s*(?:concept\s*title|creative\s*objective|target\s*creator|recommended\s*platform|suggested\s*deliverable|expected\s*audience|story\s*flow|suggested\s*dialogue|key\s*talking|cta|hashtags?|suggested\s*shot|production\s*notes?|estimated\s*duration|influencer\s*concept)\s*[:：]/i
    );
    const value = (nextField >= 0 ? rest.slice(0, nextField) : rest).trim();
    if (value) return value;
  }
  return undefined;
}

function parseListField(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\n|•|·|,/)
    .map((entry) => entry.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseCreatorAdaptations(block: string): Partial<Record<InfluencerConceptCreatorCategory, string>> {
  const adaptations: Partial<Record<InfluencerConceptCreatorCategory, string>> = {};
  for (const category of ALL_CREATOR_CATEGORIES) {
    const match = block.match(new RegExp(`^${category}\\s*[:：]\\s*(.+)$`, "im"));
    if (match?.[1]?.trim()) {
      adaptations[category] = match[1].trim();
    }
  }
  return adaptations;
}

function mapCreativeConceptToInfluencerConcept(
  concept: ReturnType<typeof parseCreativeConceptsFromBrief>[number],
  index: number,
  platforms: string[],
  deliverables: string[]
): InfluencerConcept {
  const title = concept.english.conceptName;
  const locale: InfluencerConceptLocaleContent = {
    conceptTitle: title,
    creativeObjective: concept.english.creativeIdea,
    targetCreatorTypes: ["Lifestyle", "Beauty"],
    recommendedPlatforms: platforms.slice(0, 3),
    suggestedDeliverables: deliverables.slice(0, 4),
    expectedAudienceReaction: "Authentic engagement and brand recall",
    storyFlow: concept.english.storyFlow ?? "Hook → product moment → social proof → CTA",
    suggestedDialogue: concept.english.suggestedDialogue,
    keyTalkingPoints: concept.english.talkingPoints ?? [],
    cta: concept.english.cta ?? "Discover more",
    hashtags: ["#Thinkway", "#CreatorContent"],
    suggestedShotList: ["Opening hook (3s)", "Product hero", "Lifestyle context", "CTA end card"],
    productionNotes: concept.english.creatorNotes ?? "Natural lighting, handheld framing, platform-native pacing",
    estimatedDuration: "30–45 seconds",
    creatorAdaptations: {},
  };

  const arabicLocale: InfluencerConceptLocaleContent = concept.arabic
    ? {
        ...locale,
        conceptTitle: concept.arabic.conceptName,
        creativeObjective: concept.arabic.creativeIdea,
        storyFlow: concept.arabic.storyFlow ?? locale.storyFlow,
        suggestedDialogue: concept.arabic.suggestedDialogue,
        keyTalkingPoints: concept.arabic.talkingPoints ?? [],
        cta: concept.arabic.cta ?? locale.cta,
        productionNotes: concept.arabic.creatorNotes ?? locale.productionNotes,
      }
    : localizeConceptArabic(locale, "gulf", title, title, concept.english.creativeIdea);

  return {
    id: createConceptId("brief", index),
    source: "brief",
    approved: true,
    english: locale,
    arabic: arabicLocale,
    createdAt: new Date().toISOString(),
  };
}

/** Parse structured influencer concepts from campaign brief text. */
export function parseInfluencerConceptsFromBrief(
  briefText: string,
  context?: { platforms?: string[]; deliverables?: string[] }
): InfluencerConcept[] {
  const platforms = context?.platforms ?? [];
  const deliverables = context?.deliverables ?? [];

  const structuredBlocks = splitInfluencerConceptBlocks(briefText);
  const fromStructured: InfluencerConcept[] = [];

  for (let index = 0; index < structuredBlocks.length; index += 1) {
    const block = structuredBlocks[index]!;
    const title =
      extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[0]!.patterns) ??
      block.match(/^concept\s*\d+\s*[:：.-]\s*(.+)$/im)?.[1]?.trim() ??
      `Concept ${index + 1}`;
    const objective =
      extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[1]!.patterns) ??
      extractBriefField(block, [/^creative\s*idea\s*[:：]/im]);

    if (!objective?.trim()) continue;

    const english: InfluencerConceptLocaleContent = {
      conceptTitle: title,
      creativeObjective: objective,
      targetCreatorTypes: parseListField(
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[2]!.patterns)
      ),
      recommendedPlatforms:
        parseListField(extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[3]!.patterns)) ||
        platforms.slice(0, 3),
      suggestedDeliverables:
        parseListField(extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[4]!.patterns)) ||
        deliverables.slice(0, 4),
      expectedAudienceReaction:
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[5]!.patterns) ??
        "Relatable share-worthy reaction",
      storyFlow:
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[6]!.patterns) ??
        "Hook → demo → proof → CTA",
      suggestedDialogue: extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[7]!.patterns),
      keyTalkingPoints: parseListField(
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[8]!.patterns)
      ),
      cta: extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[9]!.patterns) ?? "Learn more",
      hashtags: parseListField(extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[10]!.patterns)),
      suggestedShotList: parseListField(
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[11]!.patterns)
      ),
      productionNotes:
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[12]!.patterns) ??
        "Platform-native pacing, clear product visibility",
      estimatedDuration:
        extractBriefField(block, BRIEF_INFLUENCER_FIELD_PATTERNS[13]!.patterns) ?? "30–45 seconds",
      creatorAdaptations: parseCreatorAdaptations(block),
    };

    fromStructured.push({
      id: createConceptId("brief", index),
      source: "brief",
      approved: true,
      english,
      arabic: localizeConceptArabic(
        english,
        resolveArabicDialect(undefined),
        "the brand",
        "the product",
        objective ?? "Drive awareness"
      ),
      createdAt: new Date().toISOString(),
    });
  }

  if (fromStructured.length) return fromStructured.slice(0, 5);

  const creativeConcepts = parseCreativeConceptsFromBrief(briefText);
  if (!creativeConcepts.length) return [];

  return creativeConcepts
    .slice(0, 5)
    .map((concept, index) => mapCreativeConceptToInfluencerConcept(concept, index, platforms, deliverables));
}

export function resolveArabicDialect(country?: MarketCountry | string): string {
  const normalized = (country ?? "").trim().toLowerCase();
  if (normalized.includes("egypt") || normalized === "eg") return "egyptian";
  if (normalized.includes("saudi") || normalized === "ksa" || normalized === "sa") return "saudi";
  if (normalized.includes("uae") || normalized.includes("emirates")) return "gulf";
  if (normalized.includes("kuwait")) return "kuwaiti";
  if (normalized.includes("qatar")) return "qatari";
  if (normalized.includes("morocco")) return "moroccan";
  if (normalized.includes("jordan")) return "jordanian";
  return "gulf";
}

function dialectCta(dialect: string, brand: string): string {
  const ctas: Record<string, string> = {
    egyptian: `جرّب ${brand} النهارده`,
    saudi: `جرّب ${brand} الحين`,
    gulf: `جرّب ${brand} الحين`,
    kuwaiti: `جرّب ${brand} الحين`,
    qatari: `جرّب ${brand} الحين`,
    moroccan: `جرب ${brand} دابا`,
    jordanian: `جرّب ${brand} هسّا`,
  };
  return ctas[dialect] ?? ctas.gulf!;
}

function dialectObjectiveTemplate(
  dialect: string,
  brand: string,
  product: string,
  objective: string
): string {
  const templates: Record<string, string> = {
    egyptian: `الناس تشوف ${product} في لحظة يومية حقيقية — مش إعلان، تجربة من ${brand} تناسب ${objective}`,
    saudi: `${product} يظهر بشكل طبيعي في يوم المبدع — محتوى ${brand} يخدم ${objective} بلمسة سعودية`,
    gulf: `دمج ${product} في محتوى يومي أصيل على ${brand} — يركز على ${objective} بلهجة خليجية مفهومة`,
    kuwaiti: `عرض ${product} في سياق كويتي طبيعي — ${brand} يوصل ${objective} بدون إحساس إعلاني`,
    qatari: `محتوى ${brand} يبرز ${product} في لحظة يومية — يخدم ${objective} بلهجة قطرية`,
    moroccan: `تجربة ${product} في حياة يومية مغربية — ${brand} يحقق ${objective} بأسلوب محلي`,
    jordanian: `${product} في سياق أردني أصيل — ${brand} يدعم ${objective} بلهجة مفهومة محلياً`,
  };
  return templates[dialect] ?? templates.gulf!;
}

function dialectTitleTemplate(
  dialect: string,
  seedTitle: string,
  brand: string
): string {
  const templates: Record<string, (title: string, brand: string) => string> = {
    egyptian: (title, b) => `${title} — ${b} في يومك`,
    saudi: (title, b) => `${title} | ${b}`,
    gulf: (title, b) => `${title} — ${b}`,
    kuwaiti: (title, b) => `${title} مع ${b}`,
    qatari: (title, b) => `${title} — ${b}`,
    moroccan: (title, b) => `${title} · ${b}`,
    jordanian: (title, b) => `${title} — ${b}`,
  };
  const fn = templates[dialect] ?? templates.gulf!;
  return fn(seedTitle, brand);
}

const ARABIC_ADAPTATION_TEMPLATES: Record<InfluencerConceptCreatorCategory, string> = {
  lifestyle: "دمج المنتج في يوم المبدع بشكل طبيعي — يبدو جزءاً من الروتين اليومي",
  food: "لحظة وصفة أو تذوق — لقطات مقربة حسية وتفاعل حقيقي",
  comedy: "مشهد كوميدي مألوف — الفكاهة تسبق ذكر العلامة في منتصف المحتوى",
  fitness: "عرض نشط — المنتج يدعم التمرين أو التعافي",
  family: "لحظة عائلية مشتركة — مشهد دافئ بعدة أشخاص",
  beauty: "إيقاع GRWM أو تعليمي — لقطات قبل/بعد أو تطبيق مقرب",
  travel: "اكتشاف مرتبط بالمكان — المنتج يرافق الرحلة",
};

function buildArabicCreatorAdaptations(
  categories: InfluencerConceptCreatorCategory[]
): Partial<Record<InfluencerConceptCreatorCategory, string>> {
  const adaptations: Partial<Record<InfluencerConceptCreatorCategory, string>> = {};
  for (const category of categories) {
    adaptations[category] = ARABIC_ADAPTATION_TEMPLATES[category];
  }
  return adaptations;
}

function localizeConceptArabic(
  english: InfluencerConceptLocaleContent,
  dialect: string,
  brand: string,
  product: string,
  objective: string
): InfluencerConceptLocaleContent {
  const dialectLabels: Record<string, string> = {
    egyptian: "مصري",
    saudi: "سعودي",
    gulf: "خليجي",
    kuwaiti: "كويتي",
    qatari: "قطري",
    moroccan: "مغربي",
    jordanian: "أردني",
  };

  const dialectLabel = dialectLabels[dialect] ?? "محلي";
  const arTitle = dialectTitleTemplate(dialect, english.conceptTitle, brand);
  const platform = english.recommendedPlatforms[0] ?? "Instagram";
  const adaptationCategories = Object.keys(english.creatorAdaptations) as InfluencerConceptCreatorCategory[];

  return {
    conceptTitle: arTitle,
    creativeObjective: dialectObjectiveTemplate(dialect, brand, product, objective),
    creatorJourney: english.creatorJourney
      ? "يفتح على لحظة يومية مألوفة قبل ظهور المنتج بشكل طبيعي"
      : undefined,
    openingHook: english.openingHook
      ? "لقطة افتتاحية مألوفة قبل ظهور المنتج"
      : undefined,
    targetCreatorTypes: english.targetCreatorTypes.map((type) =>
      localizeCreatorCategory(type, "ar")
    ),
    recommendedPlatforms: english.recommendedPlatforms,
    suggestedDeliverables: english.suggestedDeliverables.map((d) =>
      localizeDeliverableLabel(d, "ar")
    ),
    expectedAudienceReaction: `تفاعل طبيعي وتعليقات من الجمهور ${dialectLabel} — مش مجرد لايك`,
    storyFlow: "مشهد افتتاحي قوي → عرض المنتج → دليل اجتماعي → دعوة للعمل",
    suggestedDialogue: english.suggestedDialogue
      ? `"هذا اللي بستخدمه فعلاً من ${product} — ${brand} فاهم."`
      : undefined,
    keyTalkingPoints: english.keyTalkingPoints.length
      ? [
          `فائدة ${product} للجمهور المستهدف`,
          `${brand} يدعم ${objective}`,
          "من منظور المبدع الحقيقي — بدون قراءة إعلان",
        ].slice(0, english.keyTalkingPoints.length)
      : [],
    visualStyle: english.visualStyle
      ? `أسلوب ${platform} الأصلي — تصوير يدوي، إضاءة طبيعية، إيقاع مناسب للمنصة`
      : undefined,
    cameraDirection: english.cameraDirection
      ? "لقطات POV ومقربة للمنتج؛ المبدع يتحدث للكاميرا في الافتتاح"
      : undefined,
    music: english.music ? "صوت ترند أو آمن للعلامة — مناسب للمنصة" : undefined,
    transitions: english.transitions
      ? "قطع سريعة بإيقاع المنصة؛ انتقال عند كشف المنتج"
      : undefined,
    cta: dialectCta(dialect, brand),
    hashtags: english.hashtags,
    suggestedShotList: english.suggestedShotList.length
      ? english.suggestedShotList.map((shot) => {
          const map: Record<string, string> = {
            "Relatable opener (3s)": "لقطة افتتاحية مألوفة (3 ث)",
            "Product hero": "لقطة المنتج",
            "Lifestyle payoff": "سياق يومي",
            "CTA overlay": "دعوة للعمل",
            "Creator intro": "مقدمة المبدع",
            "Demo sequence": "تسلسل العرض",
            "Reaction beat": "لحظة تفاعل",
            "End card": "شاشة ختامية",
            "Trend hook": "خطاف ترند",
            "Brand integration": "دمج العلامة",
            "Transition": "انتقال",
            "CTA": "دعوة للعمل",
            "Seasonal opener": "افتتاحية موسمية",
            "Product in context": "المنتج في السياق",
            "Benefit highlight": "إبراز الفائدة",
            "Direct-to-camera hook": "خطاف مباشر للكاميرا",
            "Product demo": "عرض المنتج",
            "Benefit proof": "إثبات الفائدة",
          };
          return map[shot] ?? shot;
        })
      : ["لقطة افتتاحية (3 ث)", "لقطة المنتج", "سياق يومي", "دعوة للعمل"],
    brandIntegration: english.brandIntegration
      ? `ظهور ${product} في أول 5 ثوان — استخدام طبيعي بدون placement صريح`
      : undefined,
    productionNotes: "",
    estimatedDuration: localizeDurationArabic(english.estimatedDuration),
    creatorAdaptations:
      adaptationCategories.length > 0
        ? buildArabicCreatorAdaptations(adaptationCategories)
        : {},
  };
}

function detectTargetCreatorCategories(
  briefText: string,
  slate: SlateCreator[]
): InfluencerConceptCreatorCategory[] {
  const lower = `${briefText}\n${slate.map((c) => c.displayName).join(" ")}`.toLowerCase();
  const categories = new Set<InfluencerConceptCreatorCategory>();

  const signals: Array<{ category: InfluencerConceptCreatorCategory; patterns: RegExp[] }> = [
    { category: "lifestyle", patterns: [/\blifestyle\b/i, /\bvlog\b/i, /\bgrwm\b/i] },
    { category: "food", patterns: [/\bfood\b/i, /\brecipe\b/i, /\bchef\b/i] },
    { category: "comedy", patterns: [/\bcomedy\b/i, /\bhumor\b/i, /\bskit\b/i] },
    { category: "fitness", patterns: [/\bfitness\b/i, /\bworkout\b/i, /\bgym\b/i] },
    { category: "family", patterns: [/\bfamily\b/i, /\bparent\b/i, /\bkids\b/i] },
    { category: "beauty", patterns: [/\bbeauty\b/i, /\bmakeup\b/i, /\bskincare\b/i] },
    { category: "travel", patterns: [/\btravel\b/i, /\bdestination\b/i, /\btourism\b/i] },
  ];

  for (const { category, patterns } of signals) {
    if (patterns.some((pattern) => pattern.test(lower))) categories.add(category);
  }

  if (!categories.size) {
    categories.add("lifestyle");
    categories.add("beauty");
  }

  return [...categories].slice(0, 4);
}

function buildCreatorAdaptations(
  categories: InfluencerConceptCreatorCategory[],
  conceptSeed: string
): Partial<Record<InfluencerConceptCreatorCategory, string>> {
  const templates: Record<InfluencerConceptCreatorCategory, string> = {
    lifestyle: "Day-in-the-life integration — product feels organic in daily routine",
    food: "Recipe or tasting moment — sensory close-ups and reaction beats",
    comedy: "Relatable skit hook — humor lands before brand mention at midpoint",
    fitness: "Active demo — product supports the workout or recovery narrative",
    family: "Shared moment framing — multi-person scene with warm household context",
    beauty: "GRWM or tutorial pacing — before/after or application close-ups",
    travel: "Location-led discovery — product supports the journey narrative",
  };

  const adaptations: Partial<Record<InfluencerConceptCreatorCategory, string>> = {};
  for (const category of categories) {
    adaptations[category] = `${templates[category]} (${conceptSeed})`;
  }
  return adaptations;
}

/** Deterministic AI fallback — only when brief and uploads are absent. */
export function generateInfluencerConcepts(input: {
  briefText: string;
  objective?: string;
  brand?: string;
  product?: string;
  industry?: string;
  audience?: string;
  platforms: string[];
  creatorCategories: InfluencerConceptCreatorCategory[];
  marketCountry?: string;
  season?: string;
  dialect: string;
  slate: SlateCreator[];
  campaignType?: CampaignTypeClassification;
  marketIntelligenceNote?: string;
}): InfluencerConcept[] {
  const brand = input.brand?.trim() || "the brand";
  const product = input.product?.trim() || brand;
  const objective = input.objective?.trim() || "Drive awareness and engagement";
  const audience = input.audience?.trim() || "the target audience";
  const platforms = input.platforms.length ? input.platforms : ["Instagram", "TikTok"];
  const categories =
    input.creatorCategories.length > 0
      ? input.creatorCategories
      : detectTargetCreatorCategories(input.briefText, input.slate);

  const classification =
    input.campaignType ??
    classifyCampaignType({
      briefText: input.briefText,
      objective: input.objective,
      industry: input.industry,
      marketCountry: input.marketCountry,
      season: input.season,
    });

  const allowedMechanics = resolveAllowedMechanics({
    briefText: input.briefText,
    objective: input.objective,
    slate: input.slate,
  });

  const typeLabel = classification.primary.replace(/_/g, " ");
  const marketNote = input.marketCountry ? ` in ${input.marketCountry}` : "";
  const seasonNote = input.season ? ` during ${input.season}` : "";

  type ConceptSeed = {
    title: string;
    idea: string;
    reaction: string;
    shots: string[];
    hook: string;
  };

  const conceptSeeds: ConceptSeed[] = [
    {
      title: `${brand} ${typeLabel} — ${product} in daily life`,
      idea: `Creators weave ${product} into an authentic ${typeLabel} moment for ${audience}${marketNote}${seasonNote}. ${classification.toneHint}.`,
      reaction: `Relatable comments and saves from ${audience}`,
      hook: `Opens on a familiar daily moment before ${product} appears naturally`,
      shots: ["Relatable opener (3s)", `${product} hero`, "Lifestyle payoff", "CTA overlay"],
    },
    {
      title: `${product} proof — ${brand} for ${objective.toLowerCase()}`,
      idea: `${brand} creators demonstrate real ${product} usage aligned to ${objective.toLowerCase()} — ${classification.toneHint}.`,
      reaction: "Peer validation drives saves and shares",
      hook: "Creator POV demo with genuine reaction beat",
      shots: ["Creator intro", "Demo sequence", "Reaction beat", "End card"],
    },
    {
      title: `${platforms[0] ?? "Platform"}-native ${brand} ${typeLabel}`,
      idea: `Adapt a trending ${platforms[0]} format to feature ${product} without breaking native pacing — built for ${objective.toLowerCase()}.`,
      reaction: "Trend participation and organic discovery",
      hook: "Platform-native trend hook in first 2 seconds",
      shots: ["Trend hook", "Brand integration", "Transition", "CTA"],
    },
    {
      title: `${brand} ${input.season ?? "seasonal"} moment — ${product}`,
      idea: `Tie ${product} to ${input.season ?? "the current season"} context${marketNote} for ${audience} — ${classification.toneHint}.`,
      reaction: "Timely relevance drives brand recall",
      hook: "Seasonal visual opener tied to cultural moment",
      shots: ["Seasonal opener", "Product in context", "Benefit highlight", "CTA"],
    },
    {
      title: `${brand} creator POV — ${product} ${typeLabel}`,
      idea: `Each ${categories.slice(0, 2).join(" and ")} creator interprets ${product} in their voice — supporting ${objective.toLowerCase()} for ${brand}.`,
      reaction: "Authentic engagement from creator-native storytelling",
      hook: "Creator speaks directly to camera in first frame",
      shots: ["Direct-to-camera hook", "Product demo", "Benefit proof", "CTA"],
    },
  ].filter((seed) => !isBannedGenericTitle(seed.title));

  const count = Math.min(5, Math.max(3, conceptSeeds.length));

  return conceptSeeds.slice(0, count).map((seed, index) => {
    const adaptations = buildCreatorAdaptations(categories, seed.title);
    const english: InfluencerConceptLocaleContent = {
      conceptTitle: seed.title,
      conceptName: seed.title,
      creativeObjective: seed.idea,
      objective: seed.idea,
      creatorJourney: seed.hook,
      openingHook: seed.hook,
      targetCreatorTypes: categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)),
      recommendedPlatforms: platforms.slice(0, 3),
      suggestedDeliverables: ["Reel", "Story series", "Carousel"],
      expectedAudienceReaction: seed.reaction,
      storyFlow: `${seed.hook} → product proof → audience benefit → CTA`,
      suggestedDialogue: `"This is how I actually use ${product} — ${brand} gets it."`,
      dialogue: `"This is how I actually use ${product} — ${brand} gets it."`,
      keyTalkingPoints: [
        `${product} benefit for ${audience}`,
        `${brand} supports ${objective.toLowerCase()}`,
        "Authentic creator POV — not scripted ad read",
      ],
      visualStyle: `Native ${platforms[0]} aesthetic — handheld, natural light, platform-native pacing`,
      cameraDirection: "POV and close-up product shots; creator speaks to camera in opener",
      music: "Trending or brand-safe audio — platform-native sound-on",
      transitions: "Quick cuts matching platform rhythm; match-cut on product reveal",
      suggestedShotList: seed.shots,
      shotList: seed.shots,
      brandIntegration: `${product} visible within first 5 seconds — organic usage, not hard product placement`,
      cta: `Try ${brand} today`,
      hashtags: [`#${brand.replace(/\s+/g, "")}`, `#${product.replace(/\s+/g, "").slice(0, 20)}`],
      productionNotes: `Native ${platforms[0]} pacing; ${product} visible within first 5 seconds`,
      creatorNotes: `Native ${platforms[0]} pacing; ${product} visible within first 5 seconds`,
      estimatedDuration: index === 0 ? "30 seconds" : "45–60 seconds",
      creatorAdaptations: adaptations,
    };

    if (narrativeReferencesDisallowedMechanic(english.creativeObjective, allowedMechanics)) {
      english.creativeObjective = sanitizeMechanicReferences(
        english.creativeObjective,
        allowedMechanics
      );
    }

    assertConceptReferencesCampaign(english, brand, product, objective);

    return {
      id: createConceptId("ai", index),
      source: "ai" as const,
      english,
      arabic: localizeConceptArabic(english, input.dialect, brand, product, objective),
      createdAt: new Date().toISOString(),
    };
  });
}

/** Assert generated concept references brand, product, or objective — for tests. */
export function assertConceptReferencesCampaign(
  concept: InfluencerConceptLocaleContent,
  brand: string,
  product: string,
  objective: string
): void {
  const combined = `${concept.conceptTitle} ${concept.creativeObjective}`.toLowerCase();
  const brandHit = brand.length > 2 && combined.includes(brand.toLowerCase());
  const productHit = product.length > 2 && combined.includes(product.toLowerCase());
  const objectiveWords = objective.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const objectiveHit = objectiveWords.some((word) => combined.includes(word));
  if (!brandHit && !productHit && !objectiveHit) {
    throw new Error(
      `Concept "${concept.conceptTitle}" must reference brand, product, or objective`
    );
  }
}

export function readInfluencerConceptsMeta(
  campaignObject: CampaignObject
): InfluencerConceptsMeta | undefined {
  return campaignObject.meta.influencerConcepts;
}

function storedConcepts(meta: InfluencerConceptsMeta | undefined): InfluencerConcept[] {
  if (!meta?.concepts?.length) return [];
  return meta.concepts.filter(
    (concept) =>
      concept.source === "upload" ||
      concept.source === "manual" ||
      concept.approved ||
      meta.approvedConceptIds?.includes(concept.id)
  );
}

/** Brief-first resolution — AI only when no brief or stored concepts exist. */
export function buildInfluencerConcepts(input: {
  campaignObject: CampaignObject;
  briefText?: string;
  platformAllocation: Record<string, number>;
  slate: SlateCreator[];
}): InfluencerConceptsResult {
  const briefText = input.briefText ?? resolveBriefTextForScheduling(input.campaignObject);
  const facts = getCampaignFacts(input.campaignObject);
  const marketConfig = resolveMarketIntelligenceConfig(input.campaignObject, briefText);
  const primaryCountry = marketConfig.countries[0] ?? facts?.geography?.[0];
  const dialect = resolveArabicDialect(primaryCountry);

  const platforms = sortedPlatforms(input.platformAllocation).map((entry) => entry.platform);
  const deliverables = facts?.deliverables ?? [];

  const briefConcepts = parseInfluencerConceptsFromBrief(briefText, { platforms, deliverables });
  if (briefConcepts.length) {
    return {
      concepts: briefConcepts,
      source: "brief",
      dialect,
      isBilingual: containsArabicScript(briefText) || briefConcepts.some((c) => Boolean(c.arabic)),
    };
  }

  const meta = readInfluencerConceptsMeta(input.campaignObject);
  const stored = storedConcepts(meta);
  if (stored.length) {
    return {
      concepts: stored.slice(0, 5),
      source: "stored",
      dialect,
      isBilingual: stored.some((c) => containsArabicScript(c.arabic.creativeObjective)),
    };
  }

  const aiConcepts = generateInfluencerConcepts({
    briefText,
    objective: facts?.objective,
    brand: facts?.brandName,
    product: facts?.brandName,
    industry: facts?.industry,
    audience: facts?.audience,
    platforms: platforms.length ? platforms : facts?.platforms ?? [],
    creatorCategories: detectTargetCreatorCategories(briefText, input.slate),
    marketCountry: primaryCountry,
    season: marketConfig.category,
    dialect,
    slate: input.slate,
    campaignType: classifyCampaignType({
      briefText,
      objective: facts?.objective,
      industry: facts?.industry,
      marketCountry: primaryCountry,
      season: marketConfig.category,
    }),
  });

  if (!aiConcepts.length) {
    return { concepts: [], source: "none", dialect, isBilingual: false };
  }

  return {
    concepts: aiConcepts,
    source: "ai",
    dialect,
    isBilingual: true,
  };
}

export function mergeInfluencerConceptsMeta(
  existing: InfluencerConceptsMeta | undefined,
  patch: Partial<InfluencerConceptsMeta>
): InfluencerConceptsMeta {
  return {
    concepts: patch.concepts ?? existing?.concepts ?? [],
    approvedConceptIds: patch.approvedConceptIds ?? existing?.approvedConceptIds,
    uploads: patch.uploads ?? existing?.uploads,
    libraryTags: { ...existing?.libraryTags, ...patch.libraryTags },
  };
}

export function applyInfluencerConceptsPatch(
  campaignObject: CampaignObject,
  patch: Partial<InfluencerConceptsMeta>
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      influencerConcepts: mergeInfluencerConceptsMeta(campaignObject.meta.influencerConcepts, patch),
    },
    updatedAt: new Date().toISOString(),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const INFLUENCER_CONCEPTS_EXPAND_MESSAGE = "thinkway:open-influencer-concepts" as const;

export type InfluencerConceptsSummaryVariant = "static" | "interactive";

export type InfluencerConceptsExportLanguage = "en" | "ar" | "bilingual";

export const INFLUENCER_CONCEPTS_PREVIEW_COUNT = 4;

const BANNED_GENERIC_TITLES = new Set([
  "everyday hero moment",
  "social proof spark",
  "platform-native trend ride",
  "seasonal relevance beat",
  "creator-native storytelling",
]);

function isBannedGenericTitle(title: string): boolean {
  return BANNED_GENERIC_TITLES.has(title.trim().toLowerCase());
}

function conceptStatusBadge(concept: InfluencerConcept): string {
  if (concept.approved) return "Approved";
  if (concept.source === "upload") return "Uploaded";
  if (concept.source === "brief") return "Approved";
  if (concept.source === "ai") return "AI";
  return "Manual";
}

function conceptCreativeHook(concept: InfluencerConcept): string {
  const hook =
    concept.english.storyFlow?.split("→")[0]?.trim() ??
    concept.english.keyTalkingPoints[0] ??
    concept.english.creativeObjective.slice(0, 80);
  return hook;
}

function conceptLocaleSummaryRows(
  content: ReturnType<typeof resolveConceptLocaleFields>,
  locale: "en" | "ar"
): string {
  const rows =
    locale === "ar"
      ? [
          ["الهدف", content.creativeObjective],
          ["المنصات", content.recommendedPlatforms.slice(0, 2).join(", ")],
          ["دعوة للعمل", content.cta],
          ["الخطاف", content.openingHook ?? content.storyFlow.split("→")[0]?.trim()],
        ]
      : [
          ["Objective", content.creativeObjective],
          ["Platforms", content.recommendedPlatforms.slice(0, 2).join(", ")],
          ["CTA", content.cta],
          ["Hook", content.openingHook ?? content.storyFlow.split("→")[0]?.trim()],
        ];

  return rows
    .filter(([, value]) => Boolean(value && String(value).trim()))
    .map(
      ([label, value]) =>
        `<span class="ic-meta-item"><span class="ic-meta-label">${escapeHtml(label)}:</span> ${escapeHtml(String(value).slice(0, 90))}${String(value).length > 90 ? "…" : ""}</span>`
    )
    .join("");
}

function conceptLocalePanelHtml(
  concept: InfluencerConcept,
  locale: "en" | "ar",
  full = false
): string {
  const content = resolveConceptLocaleFields(locale === "en" ? concept.english : concept.arabic);
  const dir = locale === "ar" ? ' dir="rtl"' : "";
  const title = content.conceptTitle;

  if (!full) {
    return `<div class="ic-locale-panel ic-locale-${locale}" data-ic-locale="${locale}"${dir}>
      <span class="ic-preview-title">${escapeHtml(title)}</span>
      <div class="ic-summary-meta">${conceptLocaleSummaryRows(content, locale)}</div>
    </div>`;
  }

  const fields =
    locale === "ar"
      ? [
          ["اسم المفهوم", title],
          ["الهدف الإبداعي", content.creativeObjective],
          ["رحلة المبدع", content.creatorJourney],
          ["الخطاف الافتتاحي", content.openingHook],
          ["تسلسل القصة", content.storyFlow],
          ["الحوار", content.suggestedDialogue],
          ["الأسلوب البصري", content.visualStyle],
          ["قائمة اللقطات", content.suggestedShotList.join(" · ")],
          ["دمج العلامة", content.brandIntegration],
          ["دعوة للعمل", content.cta],
        ]
      : [
          ["Concept", title],
          ["Objective", content.creativeObjective],
          ["Creator Journey", content.creatorJourney],
          ["Opening Hook", content.openingHook],
          ["Story Flow", content.storyFlow],
          ["Dialogue", content.suggestedDialogue],
          ["Visual Style", content.visualStyle],
          ["Shot List", content.suggestedShotList.join(" · ")],
          ["Brand Integration", content.brandIntegration],
          ["CTA", content.cta],
        ];

  const fieldHtml = fields
    .filter(([, value]) => Boolean(value && String(value).trim()))
    .map(
      ([label, value]) =>
        `<div class="ic-field"><span class="ic-label">${escapeHtml(String(label))}</span><span class="ic-value">${escapeHtml(String(value))}</span></div>`
    )
    .join("");

  return `<div class="ic-locale-panel ic-locale-${locale}" data-ic-locale="${locale}"${dir}>${fieldHtml}</div>`;
}

function conceptLanguageTabsHtml(conceptId: string, language: InfluencerConceptsExportLanguage): string {
  if (language === "en") {
    return `<div class="ic-lang-tabs ic-lang-en-only"><span class="ic-lang-tab on">English</span></div>`;
  }
  if (language === "ar") {
    return `<div class="ic-lang-tabs ic-lang-ar-only"><span class="ic-lang-tab on">العربية</span></div>`;
  }
  return `<div class="ic-lang-tabs" data-ic-concept="${escapeHtml(conceptId)}">
    <button type="button" class="ic-lang-tab on" data-ic-lang="en">English</button>
    <button type="button" class="ic-lang-tab" data-ic-lang="ar">العربية</button>
  </div>`;
}

/** Collapsed Influencer Concepts card for HTML export — single locale per view; bilingual via tabs. */
export function renderInfluencerConceptsSummaryHtml(
  concepts: InfluencerConcept[],
  options?: {
    variant?: InfluencerConceptsSummaryVariant;
    maxPreview?: number;
    exportLevel?: "summary" | "full" | "none";
    language?: InfluencerConceptsExportLanguage;
  }
): string {
  if (!concepts.length || options?.exportLevel === "none") return "";

  const variant = options?.variant ?? "static";
  const interactive = variant === "interactive";
  const language = options?.language ?? "en";
  const previewCount =
    options?.exportLevel === "full"
      ? concepts.length
      : (options?.maxPreview ?? INFLUENCER_CONCEPTS_PREVIEW_COUNT);
  const previewConcepts = concepts.slice(0, previewCount);

  const rows = previewConcepts
    .map((concept) => {
      const badge = conceptStatusBadge(concept);
      const categories = concept.english.targetCreatorTypes.slice(0, 3).join(", ");
      const enPanel = conceptLocalePanelHtml(concept, "en", options?.exportLevel === "full");
      const arPanel =
        language === "bilingual"
          ? conceptLocalePanelHtml(concept, "ar", options?.exportLevel === "full")
          : language === "ar"
            ? conceptLocalePanelHtml(concept, "ar", options?.exportLevel === "full")
            : "";

      const activeLocale = language === "ar" ? "ar" : "en";
      const panels =
        language === "bilingual"
          ? `<div class="ic-locale-stack">${enPanel}${arPanel}</div>`
          : activeLocale === "ar"
            ? `<div class="ic-locale-stack" data-active-lang="ar">${arPanel}</div>`
            : `<div class="ic-locale-stack" data-active-lang="en">${enPanel}</div>`;

      const tabs = language === "bilingual" ? conceptLanguageTabsHtml(concept.id, "bilingual") : "";

      if (options?.exportLevel === "full") {
        return `<div class="ic-summary-row ic-summary-row--full" data-ic-concept-id="${escapeHtml(concept.id)}">
          <div class="ic-summary-head">
            <span class="ic-preview-title">${escapeHtml(resolveConceptLocaleFields(concept.english).conceptTitle)}</span>
            <span class="ic-status-badge ic-status-${badge.toLowerCase()}">${escapeHtml(badge)}</span>
          </div>
          ${tabs}
          ${panels}
          <div class="ic-summary-fields">
            <div class="ic-field"><span class="ic-label">Creators</span><span class="ic-value">${escapeHtml(categories)}</span></div>
          </div>
        </div>`;
      }

      return `<li class="ic-summary-row" data-ic-concept-id="${escapeHtml(concept.id)}">
        <div class="ic-summary-head">
          <span class="ic-status-badge ic-status-${badge.toLowerCase()}">${escapeHtml(badge)}</span>
        </div>
        ${tabs}
        ${panels}
      </li>`;
    })
    .join("");

  const remaining = concepts.length - previewConcepts.length;
  const more =
    remaining > 0
      ? interactive
        ? `<p class="ic-more">+ ${remaining} more in workspace — click card to view full concepts</p>`
        : `<p class="ic-more">+ ${remaining} more in Thinkway workspace</p>`
      : interactive
        ? `<p class="ic-more">Click to view full concepts (EN / AR tabs)</p>`
        : "";

  const badge = interactive ? "Click to expand" : "Summary only";
  const cardAttrs = interactive
    ? ` class="ic-collapsed-card ic-collapsed-card--interactive" role="button" tabindex="0" data-ic-expand="1" aria-label="Open influencer concepts"`
    : ` class="ic-collapsed-card"`;

  const listTag = options?.exportLevel === "full" ? "div" : "ul";
  const listClass = options?.exportLevel === "full" ? "ic-preview-full" : "ic-preview-list";

  return `<div${cardAttrs}>
    <div class="ic-collapsed-head">
      <span class="ic-collapsed-title">Influencer Concepts (${concepts.length})</span>
      <span class="ic-collapsed-badge">${badge}</span>
    </div>
    <${listTag} class="${listClass}">${rows}</${listTag}>
    ${more}
  </div>`;
}
