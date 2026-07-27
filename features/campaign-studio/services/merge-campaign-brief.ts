import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignFacts, CampaignFactsField } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  applyFactsToSummaryData,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import {
  deriveWeekWeightsFromBrief,
  resolveBriefTextForScheduling,
} from "@/features/campaign-outputs/brief-media-plan-schedule";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import { upsertCampaignBriefRef, type CampaignBriefSource } from "@/features/campaign-outputs/campaign-brief-ref";
import { mutateMediaPlanSchedule } from "@/features/campaign-outputs/media-plan-mutations";
import { markStaleCampaignOutputs } from "@/features/campaign-outputs/output-registry";
import type { StrategySectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { studioPlanningArtifacts } from "./campaign-planning-service";

const MIN_BRIEF_CHARS = 40;

export type MergeCampaignBriefResult = {
  campaignObject: CampaignObject;
  change: string | null;
};

function hasQuotationSlate(campaignObject: CampaignObject): boolean {
  const slate = resolveSlate(campaignObject);
  if (slate.some((creator) => (creator.quotedRevenue ?? 0) > 0 || creator.serviceTypes?.length)) {
    return true;
  }
  return Boolean(campaignObject.meta.quotationCommercials);
}

function hasFact(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/** Merge extracted brief facts — preserve quotation/commercial fields; brief fills gaps and updates strategy fields. */
function mergeFactsFromBrief(
  existing: CampaignFacts | undefined,
  extracted: CampaignFacts,
  options: { preserveCommercialBudget: boolean }
): CampaignFacts {
  const base: CampaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: { ...(existing?.confidence ?? {}) },
    sources: { ...(existing?.sources ?? {}) },
    ...existing,
    rawBriefExcerpt: extracted.rawBriefExcerpt ?? existing?.rawBriefExcerpt,
  };

  const mergeFields: CampaignFactsField[] = [
    "brandName",
    "clientName",
    "objective",
    "audience",
    "geography",
    "platforms",
    "deliverables",
    "kpis",
    "durationWeeks",
    "product",
    "industry",
    "campaignType",
  ];

  for (const field of mergeFields) {
    const nextValue = extracted[field];
    if (!hasFact(nextValue)) continue;
    const prevValue = base[field];
    if (hasFact(prevValue) && field === "durationWeeks" && existing?.sources?.durationWeeks === "inferred") {
      (base as Record<string, unknown>)[field] = nextValue;
      base.sources = { ...base.sources, [field]: "brief" };
      continue;
    }
    if (hasFact(prevValue) && field !== "objective" && field !== "audience" && field !== "deliverables" && field !== "kpis") {
      continue;
    }
    (base as Record<string, unknown>)[field] = nextValue;
    base.sources = { ...base.sources, [field]: extracted.sources[field] ?? "brief" };
    base.confidence = { ...base.confidence, [field]: extracted.confidence[field] ?? 0.85 };
  }

  if (!options.preserveCommercialBudget && hasFact(extracted.budget)) {
    base.budget = extracted.budget;
    base.sources = { ...base.sources, budget: "brief" };
  } else if (options.preserveCommercialBudget && hasFact(existing?.budget)) {
    base.budget = existing!.budget;
  } else if (hasFact(extracted.budget)) {
    base.budget = extracted.budget;
    base.sources = { ...base.sources, budget: "brief" };
  }

  return base;
}

/**
 * Apply or update THE campaign brief without resetting the creator slate.
 * Updates facts SSOT, summary cards, and media-plan week weights from strategy signals.
 */
export function mergeBriefIntoCampaignObject(
  campaignObject: CampaignObject,
  briefText: string,
  options?: { source?: CampaignBriefSource }
): MergeCampaignBriefResult {
  const trimmed = briefText.trim();
  if (trimmed.length < MIN_BRIEF_CHARS) {
    return { campaignObject, change: null };
  }

  const existingFacts = getCampaignFacts(campaignObject);
  const extracted = extractCampaignFacts({ rawMessage: trimmed, brandName: existingFacts?.brandName });
  const preserveCommercialBudget = hasQuotationSlate(campaignObject);
  const mergedFacts = mergeFactsFromBrief(existingFacts, extracted, { preserveCommercialBudget });

  const summarySection = campaignObject.sections.summary;
  const summaryData = (summarySection.data ?? {}) as Record<string, unknown>;
  const currentCards = (summaryData.summaryCards ?? {}) as Parameters<typeof applyFactsToSummaryData>[0];
  const nextCards = applyFactsToSummaryData(currentCards, mergedFacts);

  const slateBefore = resolveSlate(campaignObject).length;
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const creatorIds = creatorsData.recommendations?.creatorIds ?? [];

  const durationWeeks = Math.max(1, mergedFacts.durationWeeks ?? 4);
  const weekWeights =
    deriveWeekWeightsFromBrief(trimmed, durationWeeks) ??
    deriveWeekWeightsFromBrief(resolveBriefTextForScheduling(campaignObject), durationWeeks);

  const existingSchedule = campaignObject.meta.mediaPlanSchedule ?? {};
  const scheduleWeekWeights =
    weekWeights?.length
      ? existingSchedule.assignments?.length
        ? (existingSchedule.weekWeights ?? weekWeights)
        : weekWeights
      : null;

  const { strategy: generatedStrategy } = studioPlanningArtifacts(mergedFacts);
  const strategySection = campaignObject.sections.strategy;
  const strategyData = (strategySection.data ?? {}) as StrategySectionData;

  let next: CampaignObject = {
    ...campaignObject,
    updatedAt: new Date().toISOString(),
    sections: {
      ...campaignObject.sections,
      summary: {
        ...summarySection,
        content: trimmed,
        data: { ...summaryData, summaryCards: nextCards, campaignBrief: trimmed },
        status: "complete",
      },
      strategy: {
        ...strategySection,
        data: {
          ...strategyData,
          creatorMix: generatedStrategy.creatorMix.tiers,
          generatedStrategy,
        },
        status: strategySection.status ?? "complete",
      },
      creators: campaignObject.sections.creators,
    },
    meta: upsertCampaignBriefRef(
      {
        ...campaignObject.meta,
        campaignFacts: mergedFacts,
      },
      { briefText: trimmed, source: options?.source ?? "studio" }
    ),
  };

  // Schedule writes must go through the Media Plan Engine — never assign mediaPlanSchedule directly.
  if (scheduleWeekWeights?.length) {
    const scheduleResult = mutateMediaPlanSchedule(
      next,
      { weekWeights: scheduleWeekWeights },
      { source: "studio_media_plan_ui", autoForkDraft: true }
    );
    if (scheduleResult.ok) {
      next = scheduleResult.campaignObject;
    }
  }

  next = markStaleCampaignOutputs(next);

  const slateAfter = resolveSlate(next).length;
  if (slateBefore > 0 && slateAfter === 0 && creatorIds.length > 0) {
    next = {
      ...next,
      sections: {
        ...next.sections,
        creators: campaignObject.sections.creators,
      },
    };
  }

  const weightSummary = weekWeights
    ? weekWeights.map((weight, index) => `W${index + 1} ${weight}%`).join(", ")
    : null;

  return {
    campaignObject: next,
    change: `Updated the campaign brief${weightSummary ? ` and set publishing weight (${weightSummary})` : ""} — ${Math.max(slateAfter, creatorIds.length)} creator${Math.max(slateAfter, creatorIds.length) === 1 ? "" : "s"} on the slate preserved.`,
  };
}
