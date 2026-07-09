import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";
import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";
import type { CampaignOption, DebateMetadata, DebateResult } from "./debate-types";
import { getOptionById } from "./option-generator";

/** Apply winning debate option to strategy document — only winner feeds IS-1/IS-2 builders. */
export function applyWinnerOptionToStrategy(
  strategy: CampaignStrategyDocument,
  debateResult: DebateResult
): CampaignStrategyDocument {
  const winner = getOptionById(debateResult.options, debateResult.meeting.winnerId);
  if (!winner) return strategy;

  return {
    ...strategy,
    creatorTierStrategy: winner.creatorTierStrategy,
    understanding: {
      ...strategy.understanding,
      timeline: {
        durationWeeks: winner.timeline.durationWeeks,
        rationale: winner.timeline.rationale,
      },
      kpis: winner.kpis,
      risks: winner.risks.length > 0 ? winner.risks : strategy.understanding.risks,
    },
    narrative: [
      strategy.narrative,
      "",
      `--- IS-3 Debate Winner: Option ${winner.id} (${winner.label}) ---`,
      winner.strategySlice,
      debateResult.meeting.directorConclusion,
    ].join("\n"),
  };
}

export function buildDebateMetadata(debateResult: DebateResult): DebateMetadata {
  const winnerId = debateResult.meeting.winnerId;
  return {
    debateResult,
    rejectedOptionIds: debateResult.options.filter((o) => o.id !== winnerId).map((o) => o.id),
    winnerOptionId: winnerId,
  };
}

/** Merge debate metadata into CampaignObject meta — rejected options never in sections. */
export function applyWinnerOptionToCampaignObject(
  campaignObject: CampaignObject,
  debateMetadata: DebateMetadata
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      directorDebate: debateMetadata,
      directorPipeline: {
        ...campaignObject.meta.directorPipeline,
        approved: campaignObject.meta.directorPipeline?.approved ?? false,
        debateResult: debateMetadata,
      },
    },
  };
}

export function getWinnerOption(debateResult: DebateResult): CampaignOption | undefined {
  return getOptionById(debateResult.options, debateResult.meeting.winnerId);
}

export function getRejectedOptions(debateResult: DebateResult): CampaignOption[] {
  const winnerId = debateResult.meeting.winnerId;
  return debateResult.options.filter((o) => o.id !== winnerId);
}

export type DebateContext = {
  debateResult?: DebateResult;
  winnerOption?: CampaignOption;
};

export function buildDebateContext(debateResult?: DebateResult): DebateContext {
  if (!debateResult) return {};
  return {
    debateResult,
    winnerOption: getWinnerOption(debateResult),
  };
}

export function debateContextFromFacts(
  _facts: CampaignFacts,
  debateResult?: DebateResult
): DebateContext {
  return buildDebateContext(debateResult);
}
