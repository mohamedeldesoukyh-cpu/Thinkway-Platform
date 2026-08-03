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

function mergeDirectorSectionData(
  key: keyof CampaignObjectSections,
  existingData: Record<string, unknown> | undefined,
  approvedData: Record<string, unknown> | undefined
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...(existingData ?? {}),
    ...(approvedData ?? {}),
  };

  // Director IS1 scaffolding seeds empty recommendation IDs / empty why-selected
  // rows. Never let that wipe a slate already proposed from Vendor Discovery.
  if (key === "creators") {
    const existingRec = (existingData?.recommendations ?? {}) as {
      creatorIds?: string[];
      selectedReasoning?: unknown[];
      rejectedReasoning?: unknown[];
    };
    const approvedRec = (approvedData?.recommendations ?? {}) as {
      creatorIds?: string[];
      selectedReasoning?: unknown[];
      rejectedReasoning?: unknown[];
    };
    const intelIds = (
      (
        (merged.slateIntelligence as { recommendations?: Array<{ creatorId?: string }> })
          ?.recommendations ?? []
      )
        .map((r) => r.creatorId)
        .filter((id): id is string => Boolean(id))
    );
    const preservedIds =
      (existingRec.creatorIds?.length ?? 0) > 0
        ? existingRec.creatorIds!
        : intelIds;
    const approvedIdsEmpty = (approvedRec.creatorIds?.length ?? 0) === 0;
    const approvedReasoningEmpty = (approvedRec.selectedReasoning?.length ?? 0) === 0;
    const existingReasoning = existingRec.selectedReasoning ?? [];
    const mergedRec = (merged.recommendations ?? {}) as {
      creatorIds?: string[];
      selectedReasoning?: unknown[];
      rejectedReasoning?: unknown[];
    };
    if (approvedIdsEmpty && preservedIds.length > 0) {
      merged.recommendations = {
        ...existingRec,
        ...approvedRec,
        creatorIds: preservedIds,
        // Keep boardroom why-selected when Director scaffolding has none.
        selectedReasoning: approvedReasoningEmpty
          ? existingReasoning
          : approvedRec.selectedReasoning,
        rejectedReasoning:
          (approvedRec.rejectedReasoning?.length ?? 0) > 0
            ? approvedRec.rejectedReasoning
            : existingRec.rejectedReasoning,
      };
    } else if (
      !approvedIdsEmpty &&
      approvedReasoningEmpty &&
      existingReasoning.length > 0
    ) {
      merged.recommendations = {
        ...mergedRec,
        selectedReasoning: existingReasoning,
      };
    }

    // Final guard: never leave a non-empty slate with empty why-selected after
    // Director merge when discovery already produced reasoning.
    const finalRec = (merged.recommendations ?? {}) as {
      creatorIds?: string[];
      selectedReasoning?: unknown[];
    };
    if (
      (finalRec.creatorIds?.length ?? 0) > 0 &&
      (finalRec.selectedReasoning?.length ?? 0) === 0 &&
      existingReasoning.length > 0
    ) {
      merged.recommendations = {
        ...finalRec,
        selectedReasoning: existingReasoning,
      };
    }
  }

  return merged;
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
        ...mergeDirectorSectionData(
          key,
          existing.data as Record<string, unknown> | undefined,
          approved.data as Record<string, unknown> | undefined
        ),
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
    // Not approved: existing sections are preserved untouched (never discarded)
    // and the repair audit + user questions travel on meta so the pause is
    // explainable in Studio, never silent.
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
          governanceRepair: pipeline.governanceRepair,
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
        governanceRepair: pipeline.governanceRepair,
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
