import type { WorkflowState, WorkflowTaskResult } from "@/features/ai-workflows/types";
import type { CampaignObject, CampaignObjectSections } from "@/features/campaign-intelligence/types/campaign-object";
import type { CampaignSpecialistId } from "@/features/campaign-intelligence/types/campaign-object";

import { buildCampaignGovernanceMeta } from "@/features/campaign-governance/governance-pipeline";
import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument, DirectorApprovedSection, DirectorPipelineResult, DirectorSpecialistId } from "../types";
import { DIRECTOR_PIPELINE_STATE_KEY, finalizeDirectorPipelineFromWorkflow } from "../services/campaign-director";

function mapDirectorSpecialistToCampaignSpecialist(
  id: DirectorSpecialistId
): CampaignSpecialistId {
  switch (id) {
    case "finance":
    case "risk":
    case "performance":
      return "analyst";
    case "creator_intelligence":
      return "scout";
    case "media_planner":
      return "planner";
    default:
      return "strategist";
  }
}

/** Inject Director SSOT strategy document into workflow state at initialization. */
export function injectDirectorStrategyIntoWorkflowState(
  state: WorkflowState,
  strategyDocument: CampaignStrategyDocument
): void {
  state.data.campaignStrategyDocument = strategyDocument;
}

/** Run full director pipeline after workflow tasks complete. */
export function enrichWorkflowStateWithDirectorPipeline(
  state: WorkflowState,
  userMessage: string,
  brandName?: string,
  campaignFacts?: CampaignFacts
): DirectorPipelineResult {
  const taskResults = Object.fromEntries(
    Object.entries(state.taskResults).filter(
      ([, result]) => result.status === "completed" || result.status === "awaiting_approval"
    )
  ) as Record<string, WorkflowTaskResult>;

  const facts =
    campaignFacts ?? (state.data.campaignFacts as CampaignFacts | undefined);

  const pipelineResult = finalizeDirectorPipelineFromWorkflow({
    userMessage,
    brandName: brandName ?? (state.data.brandName as string | undefined),
    taskResults,
    campaignFacts: facts,
  });

  state.data[DIRECTOR_PIPELINE_STATE_KEY] = pipelineResult;
  state.data.campaignStrategyDocument = pipelineResult.strategyDocument;
  if (facts) {
    state.data.campaignFacts = facts;
  }

  return pipelineResult;
}

/** Apply Director-approved sections to CampaignObject sections with WHY rationale. */
export function applyDirectorApprovedSections(
  sections: CampaignObjectSections,
  approvedSections: DirectorApprovedSection[]
): CampaignObjectSections {
  const updated = { ...sections };

  for (const approved of approvedSections) {
    const key = approved.sectionKey as keyof CampaignObjectSections;
    if (!(key in updated)) continue;

    const existing = updated[key];
    updated[key] = {
      ...existing,
      content: approved.content,
      data: {
        ...existing.data,
        ...approved.data,
        directorRationale: approved.rationale,
        approvedBy: approved.approvedBy,
      },
      updatedBy: mapDirectorSpecialistToCampaignSpecialist(approved.approvedBy),
      updatedAt: new Date().toISOString(),
      status: "complete",
    };
  }

  return updated;
}

export function getDirectorPipelineFromState(
  data: Record<string, unknown>
): DirectorPipelineResult | undefined {
  return data[DIRECTOR_PIPELINE_STATE_KEY] as DirectorPipelineResult | undefined;
}

export function applyDirectorPipelineToCampaignObject(
  campaignObject: CampaignObject,
  pipeline: DirectorPipelineResult,
  campaignFacts?: CampaignFacts
): CampaignObject {
  const facts =
    campaignFacts ??
    (campaignObject.meta.campaignFacts as CampaignFacts | undefined);

  const governanceMeta = pipeline.governance
    ? buildCampaignGovernanceMeta(pipeline.governance)
    : undefined;

  if (!pipeline.approvalGate.approved || pipeline.approvedSections.length === 0) {
    return {
      ...campaignObject,
      meta: {
        ...campaignObject.meta,
        campaignFacts: facts,
        governance: governanceMeta,
        directorPipeline: {
          approved: pipeline.approvalGate.approved,
          unresolvedConflicts: pipeline.approvalGate.unresolvedConflictCount,
          revisionRounds: pipeline.approvalGate.revisionRounds,
          reviewReport: pipeline.reviewReport,
          governance: governanceMeta,
        },
      },
    };
  }

  return {
    ...campaignObject,
    sections: applyDirectorApprovedSections(campaignObject.sections, pipeline.approvedSections),
    meta: {
      ...campaignObject.meta,
      campaignFacts: facts,
      governance: governanceMeta,
      directorPipeline: {
        approved: true,
        strategyDocumentId: pipeline.strategyDocument.id,
        revisionRounds: pipeline.approvalGate.revisionRounds,
        approvedAt: pipeline.approvalGate.approvedAt,
        reviewReport: pipeline.reviewReport,
        governance: governanceMeta,
        debateResult: pipeline.debateResult
          ? {
              winnerOptionId: pipeline.debateResult.meeting.winnerId,
              rejectedOptionIds: pipeline.debateResult.options
                .filter((o) => o.id !== pipeline.debateResult!.meeting.winnerId)
                .map((o) => o.id),
              debateResult: pipeline.debateResult,
            }
          : undefined,
      },
      directorDebate: pipeline.debateResult
        ? {
            debateResult: pipeline.debateResult,
            rejectedOptionIds: pipeline.debateResult.options
              .filter((o) => o.id !== pipeline.debateResult!.meeting.winnerId)
              .map((o) => o.id),
            winnerOptionId: pipeline.debateResult.meeting.winnerId,
          }
        : undefined,
    },
  };
}
