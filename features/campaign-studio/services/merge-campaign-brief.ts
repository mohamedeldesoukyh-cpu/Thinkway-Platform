import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import {
  applyFactsToSummaryData,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
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

/**
 * Apply or update THE campaign brief without resetting the creator slate.
 * Brief text is stored on the object; Campaign Facts SSOT is not rewritten from regex.
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
  const summarySection = campaignObject.sections.summary;
  const summaryData = (summarySection.data ?? {}) as Record<string, unknown>;
  const currentCards = (summaryData.summaryCards ?? {}) as Parameters<typeof applyFactsToSummaryData>[0];
  const nextCards = existingFacts
    ? applyFactsToSummaryData(currentCards, existingFacts)
    : currentCards;

  const slateBefore = resolveSlate(campaignObject).length;
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const creatorIds = creatorsData.recommendations?.creatorIds ?? [];

  const durationWeeks = existingFacts?.durationWeeks;
  const weekWeights =
    durationWeeks != null
      ? deriveWeekWeightsFromBrief(trimmed, durationWeeks) ??
        deriveWeekWeightsFromBrief(resolveBriefTextForScheduling(campaignObject), durationWeeks)
      : null;

  const existingSchedule = campaignObject.meta.mediaPlanSchedule ?? {};
  const scheduleWeekWeights =
    weekWeights?.length
      ? existingSchedule.assignments?.length
        ? (existingSchedule.weekWeights ?? weekWeights)
        : weekWeights
      : null;

  const generatedStrategy = existingFacts ? studioPlanningArtifacts(existingFacts).strategy : undefined;
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
      strategy: generatedStrategy
        ? {
            ...strategySection,
            data: {
              ...strategyData,
              creatorMix: generatedStrategy.creatorMix.tiers,
              generatedStrategy,
            },
            status: strategySection.status ?? "complete",
          }
        : strategySection,
      creators: campaignObject.sections.creators,
    },
    meta: upsertCampaignBriefRef(
      {
        ...campaignObject.meta,
        ...(existingFacts ? { campaignFacts: existingFacts } : {}),
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
