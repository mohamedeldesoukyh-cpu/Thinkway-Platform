import type {
  ContentPlanItem,
  CreatorContentEvidenceRef,
  CreatorContentProvenance,
} from "@/features/campaign-intelligence/types/section-schemas";

import type { ContentContext, ContentContextCreator } from "./content-context";
import type { CreatorContentEvidence } from "./creator-content-evidence";

export type CreatorContentContext = {
  campaign: Pick<ContentContext, "objective" | "audience" | "keyMessages" | "cta" | "platforms" | "deliverables" | "requirements" | "constraints">;
  creator: ContentContextCreator;
  evidence?: CreatorContentEvidence;
  readiness: ContentContext["readiness"];
  campaignFitRef?: CreatorContentEvidenceRef;
};

export type CreatorTreatment = Pick<
  ContentPlanItem,
  | "contentAngle"
  | "format"
  | "hookDirection"
  | "talkingPoints"
  | "creatorAdaptation"
  | "mandatoryInclusions"
  | "prohibitedPoints"
  | "evidenceRefs"
  | "rationale"
  | "treatmentProvenance"
  | "evidenceStrength"
>;

export type CreatorTreatmentAiOutput = {
  creatorId: string;
  campaignPillar?: string;
  contentAngle?: string;
  format?: string;
  hookDirection?: string;
  talkingPoints?: string[];
  keyMessage?: string;
  cta?: string;
  mandatoryInclusions?: string[];
  prohibitedPoints?: string[];
  platformTreatment?: string;
  creatorAdaptation?: string;
  evidenceRefs?: string[];
  rationale?: string;
  confidence?: number;
  provenance?: "AI_RECOMMENDED";
};

function requirementText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(", ") || undefined;
  return undefined;
}

function requirements(
  context: CreatorContentContext,
  expression: RegExp
): Array<{ text: string; ref: CreatorContentEvidenceRef }> {
  return context.campaign.requirements.flatMap((requirement) => {
    if (!expression.test(requirement.concept)) return [];
    const text = requirementText(requirement.value) ?? requirement.label ?? requirement.concept.replace(/_/g, " ");
    return [{
      text,
      ref: {
        id: `fact:${requirement.id}`,
        label: `Campaign requirement: ${requirement.concept.replace(/_/g, " ")}`,
        provenance: "STRATEGY_DECISION",
        ...(requirement.scope ? { scope: JSON.stringify(requirement.scope) } : {}),
      },
    }];
  });
}

type EvidenceStrength = "none" | "weak" | "medium" | "strong";

const GENERIC_TREATMENT_WORDS = new Set([
  "about", "campaign", "creator", "message", "product", "show", "through", "with",
]);

const BROAD_CATEGORY_WORDS = new Set([
  "beauty", "lifestyle", "family", "food", "fitness", "travel", "fashion", "entertainment",
]);

type ContentPattern = "tutorial" | "narrative" | "routine" | "review" | "educational" | "entertainment";

const CONTENT_PATTERN_MATCHERS: Array<{ pattern: ContentPattern; words: string[] }> = [
  { pattern: "tutorial", words: ["tutorial", "demonstration", "demo", "steps", "step", "howto"] },
  { pattern: "narrative", words: ["story", "storytelling", "situation", "moment"] },
  { pattern: "routine", words: ["routine", "ritual", "everyday", "daily"] },
  { pattern: "review", words: ["review", "unboxing", "impressions"] },
  { pattern: "educational", words: ["tips", "guide", "explain", "myth"] },
  { pattern: "entertainment", words: ["comedy", "funny", "sketch"] },
];

function meaningfulWords(value: string | undefined): string[] {
  return (value?.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length >= 4 && !GENERIC_TREATMENT_WORDS.has(word));
}

function publicationPatterns(caption: string | undefined): ContentPattern[] {
  const words = new Set(meaningfulWords(caption));
  return CONTENT_PATTERN_MATCHERS
    .filter((matcher) => matcher.words.some((word) => words.has(word)))
    .map((matcher) => matcher.pattern);
}

type RelevantPublication = {
  id: string;
  patterns: ContentPattern[];
};

/**
 * A publication is relevant only when it carries the selected category/niche,
 * or (when no category exists) all meaningful treatment words. Evidence refs,
 * campaign reasoning, and profile metadata are deliberately not counted as
 * independent proof.
 */
function treatmentRelevantPublications(
  evidence: CreatorContentEvidence | undefined,
  category: string | undefined,
  baseConcept: string | undefined
): RelevantPublication[] {
  const treatmentWords = meaningfulWords(category ?? baseConcept);
  if (treatmentWords.length === 0) return [];
  const broadSingleCategory = treatmentWords.length === 1 && BROAD_CATEGORY_WORDS.has(treatmentWords[0]!);
  const seen = new Set<string>();
  return (
    (evidence?.recentPublications ?? [])
      .flatMap((publication): RelevantPublication[] => {
        if (seen.has(publication.id)) return [];
        seen.add(publication.id);
        const captionWords = new Set(meaningfulWords(publication.caption));
        const patterns = publicationPatterns(publication.caption);
        const topicMatches = treatmentWords.every((word) => captionWords.has(word));
        // Captions are supporting evidence only. A broad one-word category
        // needs an observable content pattern, so "beauty bag" is not treated
        // as a beauty tutorial or recurring beauty-content signal.
        if (!topicMatches || (broadSingleCategory && patterns.length === 0)) return [];
        return [{ id: publication.id, patterns }];
      })
  );
}

function primaryPattern(publications: RelevantPublication[]): ContentPattern | undefined {
  const counts = new Map<ContentPattern, number>();
  for (const publication of publications) {
    for (const pattern of publication.patterns) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([leftPattern, leftCount], [rightPattern, rightCount]) => rightCount - leftCount || leftPattern.localeCompare(rightPattern))[0]
    ?.[0];
}

function evidenceStrength(
  evidence: CreatorContentEvidence | undefined,
  category: string | undefined,
  baseConcept: string | undefined
): EvidenceStrength {
  const directRelevantCategory = Boolean(category && evidence?.categories.includes(category));
  const derivedRelevantInterest = Boolean(category && !directRelevantCategory && evidence?.interests.includes(category));
  const publicationCount = treatmentRelevantPublications(evidence, category, baseConcept).length;

  // Freshness is retained on compact evidence refs but is not converted into an
  // arbitrary age threshold. Existing source freshness therefore informs review
  // without promoting stale or unrelated evidence.
  if ((directRelevantCategory && publicationCount >= 2) || publicationCount >= 3) return "strong";
  if ((directRelevantCategory && publicationCount >= 1) || publicationCount >= 2) return "medium";
  if (directRelevantCategory || derivedRelevantInterest || publicationCount >= 1) return "weak";
  return "none";
}

function patternTreatment(
  pattern: ContentPattern | undefined,
  strength: EvidenceStrength,
  baseFormat: string,
  baseConcept: string,
  category: string | undefined,
  publicationCount: number
): Pick<CreatorTreatment, "contentAngle" | "format" | "hookDirection" | "creatorAdaptation" | "rationale"> | undefined {
  if (!pattern || (strength !== "medium" && strength !== "strong")) return undefined;
  const observation = `${publicationCount} distinct recent ${pattern}-style ${publicationCount === 1 ? "publication" : "publications"}`;
  const categoryContext = category ? ` for the recorded ${category} signal` : "";
  const caution = strength === "strong" ? "Use" : "Consider using";
  switch (pattern) {
    case "tutorial":
      return {
        contentAngle: `${baseConcept} through a step-by-step demonstration${categoryContext}`,
        format: `Demonstration-led ${baseFormat}`,
        hookDirection: "Open with the product in use, then show the key steps.",
        creatorAdaptation: `${caution} a step-by-step product demonstration informed by observed tutorial-style posts, while retaining the approved campaign message.`,
        rationale: `Observed: ${observation}. Recommendation: ${caution.toLowerCase()} a demonstration-led treatment with a step-based opening.`,
      };
    case "narrative":
      return {
        contentAngle: `${baseConcept} through a relatable situation${categoryContext}`,
        format: `Narrative-led ${baseFormat}`,
        hookDirection: "Open on a relatable situation, then move into a personal story.",
        creatorAdaptation: `${caution} a situation-led narrative informed by observed storytelling posts, while retaining the approved campaign message.`,
        rationale: `Observed: ${observation}. Recommendation: ${caution.toLowerCase()} a narrative opening anchored in a relatable moment.`,
      };
    case "routine":
      return {
        contentAngle: `${baseConcept} within a familiar routine${categoryContext}`,
        format: `Routine-led ${baseFormat}`,
        hookDirection: "Start in a familiar routine, then introduce the campaign message naturally.",
        creatorAdaptation: `${caution} a routine-context execution informed by observed routine-style posts, while retaining the approved campaign message.`,
        rationale: `Observed: ${observation}. Recommendation: ${caution.toLowerCase()} a routine-led treatment with a relatable opening.`,
      };
    case "review":
      return {
        contentAngle: `${baseConcept} through an explanatory product perspective${categoryContext}`,
        format: `Review-led ${baseFormat}`,
        hookDirection: "Open with the product question, then explain the relevant details.",
        creatorAdaptation: `${caution} an explanatory review-style structure informed by observed review posts, while retaining the approved campaign message.`,
        rationale: `Observed: ${observation}. Recommendation: ${caution.toLowerCase()} an explanatory product-led treatment.`,
      };
    case "educational":
      return {
        contentAngle: `${baseConcept} through a practical takeaway${categoryContext}`,
        format: `Educational ${baseFormat}`,
        hookDirection: "Open with a useful insight, then explain the campaign message clearly.",
        creatorAdaptation: `${caution} an educational structure informed by observed tips or guide-style posts, while retaining the approved campaign message.`,
        rationale: `Observed: ${observation}. Recommendation: ${caution.toLowerCase()} an insight-led explanatory treatment.`,
      };
    case "entertainment":
      return {
        contentAngle: `${baseConcept} through a light scenario${categoryContext}`,
        format: `Scenario-led ${baseFormat}`,
        hookDirection: "Open with a light scenario, then introduce the campaign message clearly.",
        creatorAdaptation: `${caution} a light scenario-led structure informed by observed entertainment posts, while retaining the approved campaign message.`,
        rationale: `Observed: ${observation}. Recommendation: ${caution.toLowerCase()} a scenario-led treatment if consistent with the approved tone.`,
      };
  }
}

/** Pure composition. It intentionally cannot query Creator DNA or invoke AI. */
export function buildCreatorContentContext(input: {
  content: ContentContext;
  creator: ContentContextCreator;
  evidence?: CreatorContentEvidence;
}): CreatorContentContext {
  const campaignFitRef = input.creator.whySelected?.trim()
    ? {
        id: `slate:${input.creator.creatorId}`,
        label: "Campaign recommendation reasoning",
        provenance: "STRATEGY_DECISION" as const,
      }
    : undefined;
  return {
    campaign: {
      objective: input.content.objective,
      audience: input.content.audience,
      keyMessages: input.content.keyMessages,
      cta: input.content.cta,
      platforms: input.content.platforms,
      deliverables: input.content.deliverables,
      requirements: input.content.requirements,
      constraints: input.content.constraints,
    },
    creator: input.creator,
    evidence: input.evidence,
    readiness: input.content.readiness,
    ...(campaignFitRef ? { campaignFitRef } : {}),
  };
}

/**
 * Safe deterministic treatment. It describes evidence as evidence and does
 * not claim a creator's audience or historical performance where none exists.
 */
export function deriveCreatorTreatment(
  context: CreatorContentContext,
  input: { baseFormat: string; baseHook?: string; baseConcept?: string }
): CreatorTreatment {
  if (context.readiness.status === "BLOCKED") return {};
  const category = context.evidence?.categories[0] ?? context.evidence?.interests[0];
  const base = input.baseConcept?.trim() || context.campaign.objective?.trim() || "Campaign message";
  const strength = evidenceStrength(context.evidence, category, base);
  const relevantPublications = treatmentRelevantPublications(context.evidence, category, base);
  const pattern = primaryPattern(relevantPublications);
  const patternGuidance = patternTreatment(pattern, strength, input.baseFormat, base, category, relevantPublications.length);
  const mandatory = requirements(context, /(^|_)(mandatory|must_include|disclaimer|required)(_|$)/i);
  const prohibited = requirements(context, /(^|_)(prohibit|restricted|avoid|claim|exclud)(_|$)/i);
  const constraintRefs = context.campaign.constraints.map((constraint) => ({
    text: constraint.statement,
    ref: {
      id: `constraint:${constraint.id}`,
      label: `Campaign ${constraint.kind} restriction`,
      provenance: "OBSERVED" as const,
      ...(constraint.scope ? { scope: JSON.stringify(constraint.scope) } : {}),
    },
  }));
  const refs: CreatorContentEvidenceRef[] = [
    ...(context.evidence?.evidenceRefs ?? []),
    ...relevantPublications.map((publication) => ({
      id: publication.id,
      label: "Observed creator publication used for treatment guidance",
      provenance: "OBSERVED" as const,
      ...(context.evidence?.freshness ? { freshness: context.evidence.freshness } : {}),
    })),
    ...(context.campaignFitRef ? [context.campaignFitRef] : []),
    ...mandatory.map((item) => item.ref),
    ...prohibited.map((item) => item.ref),
    ...constraintRefs.map((item) => item.ref),
  ];
  const uniqueRefs = refs.filter((ref, index) => refs.findIndex((item) => item.id === ref.id) === index);
  const contentAngle = category
    ? `${base} through a ${category} perspective`
    : base;
  const creatorAdaptation = category
    ? `Adapt the campaign message to the creator's recorded ${category} signal; validate the final execution with the creator.`
    : "Creator evidence is limited; keep the treatment grounded in the selected campaign role and approved requirements.";
  const talkingPoints = [
    context.campaign.keyMessages[0],
    ...mandatory.map((item) => item.text),
  ].filter((item): item is string => Boolean(item?.trim())).slice(0, 3);
  const provenance: CreatorContentProvenance[] = [
    "STRATEGY_DECISION",
    category
      ? (context.evidence?.evidenceRefs.find((ref) => /categor|interest/i.test(ref.id))?.provenance ?? "DERIVED") as CreatorContentProvenance
      : "HEURISTIC_DEFAULT",
  ];
  return {
    contentAngle: patternGuidance?.contentAngle ?? contentAngle,
    format: patternGuidance?.format ?? input.baseFormat,
    hookDirection: patternGuidance?.hookDirection ?? input.baseHook,
    talkingPoints,
    creatorAdaptation: patternGuidance?.creatorAdaptation ?? creatorAdaptation,
    mandatoryInclusions: [...mandatory, ...constraintRefs.filter((item) => /disclaimer|required|must/i.test(item.text))].map((item) => item.text),
    prohibitedPoints: [...prohibited, ...constraintRefs.filter((item) => /prohibit|avoid|must not|cannot|restricted|claim/i.test(item.text))].map((item) => item.text),
    evidenceRefs: uniqueRefs,
    rationale: patternGuidance?.rationale ?? (context.creator.whySelected?.trim() || (category ? `Uses recorded ${category} evidence.` : "Based on campaign role; creator evidence is limited.")),
    treatmentProvenance: [...new Set(provenance)],
    evidenceStrength: strength,
  };
}

/** Strict validation boundary for an optional future structured AI adapter. */
export function validateCreatorTreatmentAiOutput(
  value: unknown,
  context: CreatorContentContext
): CreatorTreatmentAiOutput | null {
  if (!value || typeof value !== "object") return null;
  const allowedKeys = new Set([
    "creatorId", "campaignPillar", "contentAngle", "format", "hookDirection",
    "talkingPoints", "keyMessage", "cta", "mandatoryInclusions", "prohibitedPoints",
    "platformTreatment", "creatorAdaptation", "evidenceRefs", "rationale", "confidence", "provenance",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  const output = value as Partial<CreatorTreatmentAiOutput>;
  if (output.creatorId !== context.creator.creatorId || output.provenance !== "AI_RECOMMENDED") return null;
  if (output.cta != null && output.cta !== context.campaign.cta) return null;
  const allowedMandatory = requirements(context, /(^|_)(mandatory|must_include|disclaimer|required)(_|$)/i).map((item) => item.text);
  const allowedProhibited = requirements(context, /(^|_)(prohibit|restricted|avoid|claim|exclud)(_|$)/i).map((item) => item.text);
  if (output.mandatoryInclusions?.some((point) => !allowedMandatory.includes(point))) return null;
  if (output.prohibitedPoints?.some((point) => !allowedProhibited.includes(point))) return null;
  if (output.evidenceRefs?.some((id) => ![...(context.evidence?.evidenceRefs ?? []), ...(context.campaignFitRef ? [context.campaignFitRef] : [])].some((ref) => ref.id === id))) return null;
  if (output.confidence != null && (typeof output.confidence !== "number" || output.confidence < 0 || output.confidence > 1)) return null;
  return {
    creatorId: output.creatorId,
    ...(typeof output.campaignPillar === "string" ? { campaignPillar: output.campaignPillar } : {}),
    ...(typeof output.contentAngle === "string" ? { contentAngle: output.contentAngle } : {}),
    ...(typeof output.format === "string" ? { format: output.format } : {}),
    ...(typeof output.hookDirection === "string" ? { hookDirection: output.hookDirection } : {}),
    ...(Array.isArray(output.talkingPoints) && output.talkingPoints.every((item) => typeof item === "string") ? { talkingPoints: output.talkingPoints } : {}),
    ...(typeof output.keyMessage === "string" ? { keyMessage: output.keyMessage } : {}),
    ...(typeof output.cta === "string" ? { cta: output.cta } : {}),
    ...(Array.isArray(output.mandatoryInclusions) && output.mandatoryInclusions.every((item) => typeof item === "string") ? { mandatoryInclusions: output.mandatoryInclusions } : {}),
    ...(Array.isArray(output.prohibitedPoints) && output.prohibitedPoints.every((item) => typeof item === "string") ? { prohibitedPoints: output.prohibitedPoints } : {}),
    ...(typeof output.platformTreatment === "string" ? { platformTreatment: output.platformTreatment } : {}),
    ...(typeof output.creatorAdaptation === "string" ? { creatorAdaptation: output.creatorAdaptation } : {}),
    ...(Array.isArray(output.evidenceRefs) ? { evidenceRefs: output.evidenceRefs } : {}),
    ...(typeof output.rationale === "string" ? { rationale: output.rationale } : {}),
    ...(typeof output.confidence === "number" ? { confidence: output.confidence } : {}),
    provenance: "AI_RECOMMENDED",
  };
}
