import type { AiContext, AiOrchestrator, AiRequest } from "@/features/ai";
import type { AiWorkspaceRequestContext } from "@/features/knowledge-engine";
import type { ContextBuilderInput } from "@/features/ai/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyCampaignDirectorContext,
  isCampaignWorkflow,
} from "@/features/campaign-studio";
import {
  CampaignDirector,
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  serializeCampaignObject,
  type SaveCampaignObjectOptions,
} from "@/features/campaign-intelligence";
import { CAMPAIGN_STUDIO_COPY } from "../constants/ai-copy";

import type { AiActionCard } from "../types";
import {
  executeWorkflow,
  getWorkflowById,
  matchWorkflow,
  resumeWorkflow,
  type WorkflowExecutionResult,
  type WorkflowProgressEvent,
  type WorkflowResponseMetadata,
  type WorkflowState,
  type WorkflowId,
} from "@/features/ai-workflows";

/**
 * Strip bulky workflow payloads from SSE done events.
 * Full metadata (campaignObject, summarySections) is persisted on the message row;
 * the client reloads the conversation after create-campaign completes.
 */
export function slimWorkflowMetadataForStream(
  metadata: WorkflowResponseMetadata
): WorkflowResponseMetadata {
  const { campaignObject, summarySections, ...rest } = metadata as WorkflowResponseMetadata & {
    campaignObject?: unknown;
    summarySections?: WorkflowResponseMetadata["summarySections"];
  };
  void campaignObject;
  void summarySections;
  return rest;
}

export type PausedWorkflowSnapshot = {
  workflowId: WorkflowId;
  state: WorkflowState;
  originalUserMessage: string;
};

export function getPausedWorkflowSnapshot(
  contextSnapshot?: Record<string, unknown>
): PausedWorkflowSnapshot | null {
  const paused = contextSnapshot?.pausedWorkflow as PausedWorkflowSnapshot | undefined;
  if (!paused?.workflowId || !paused.state || !paused.originalUserMessage?.trim()) {
    return null;
  }
  if (paused.state.status !== "paused" || paused.state.pauseReason !== "missing_info") {
    return null;
  }
  return paused;
}

export function buildPausedWorkflowSnapshot(
  result: WorkflowExecutionResult,
  originalUserMessage: string
): PausedWorkflowSnapshot | null {
  if (result.state.status !== "paused" || result.state.pauseReason !== "missing_info") {
    return null;
  }

  return {
    workflowId: result.state.workflowId,
    state: result.state,
    originalUserMessage: originalUserMessage.trim(),
  };
}

export type WorkflowAdapterResult =
  | {
      handled: false;
    }
  | {
      handled: true;
      content: string;
      actionCards: AiActionCard[];
      metadata: WorkflowResponseMetadata;
      agentId: string;
      workflowResult: WorkflowExecutionResult;
      campaignObjectSnapshot?: Record<string, unknown>;
      contextSnapshotPatch?: Record<string, unknown>;
    };

export type WorkflowAdapterOptions = {
  orchestrator: AiOrchestrator;
  supabase: SupabaseClient;
  contextInput?: Omit<ContextBuilderInput, "request">;
  conversationId?: string;
  contextSnapshot?: Record<string, unknown>;
  onProgress?: (event: WorkflowProgressEvent) => void;
  pausedWorkflow?: PausedWorkflowSnapshot | null;
  userId?: string;
  campaignHeaderId?: string | null;
};

function buildPersistenceOptions(
  options: WorkflowAdapterOptions,
  saveReason: SaveCampaignObjectOptions["saveReason"],
  autosaveFromTask?: WorkflowProgressEvent
): SaveCampaignObjectOptions & { autosaveFromTask?: WorkflowProgressEvent } {
  return {
    supabase: options.supabase,
    userId: options.userId,
    campaignHeaderId: options.campaignHeaderId,
    persistToDb: Boolean(options.userId),
    saveReason,
    autosaveFromTask,
  };
}

async function initializeCampaignDirector(
  input: {
    conversationId: string;
    workflowId: string;
    contextSnapshot?: Record<string, unknown>;
    inferredFields?: string[];
  },
  options: WorkflowAdapterOptions
): Promise<CampaignDirector> {
  const existingObject = await loadCampaignObjectForConversation(
    options.supabase,
    input.conversationId,
    input.contextSnapshot
  );

  return CampaignDirector.initialize({
    ...input,
    existingObject,
  });
}

async function enrichCampaignWorkflowMetadata(
  metadata: WorkflowResponseMetadata,
  execution: WorkflowExecutionResult,
  input: {
    conversationId?: string;
    contextSnapshot?: Record<string, unknown>;
    inferredFields?: string[];
  },
  options: WorkflowAdapterOptions,
  director: CampaignDirector
): Promise<{
  metadata: WorkflowResponseMetadata;
  campaignObjectSnapshot?: Record<string, unknown>;
  contextSnapshotPatch?: Record<string, unknown>;
}> {
  if (!input.conversationId || !isCampaignWorkflow(metadata.workflowId)) {
    return { metadata };
  }

  for (const result of Object.values(execution.state.taskResults)) {
    director.applyTaskResult(result, execution.state.data);
  }

  director.syncFromWorkflowState(execution.state);
  director.syncFromMetadata(metadata);

  const campaignObject = await director.persist(
    input.conversationId,
    buildPersistenceOptions(options, "workflow_complete")
  );
  const serialized = serializeCampaignObject(campaignObject);

  const enrichedMetadata: WorkflowResponseMetadata = {
    ...metadata,
    campaignObject: serialized,
    inferredFields: metadata.inferredFields ?? input.inferredFields,
  };

  const contextSnapshotPatch = attachCampaignObjectToSnapshot(
    input.contextSnapshot ?? {},
    campaignObject
  );

  return {
    metadata: enrichedMetadata,
    campaignObjectSnapshot: serialized,
    contextSnapshotPatch,
  };
}

/**
 * Thin adapter layer: detects workflow match and executes multi-step engine.
 * Falls through to orchestrator when no workflow matches.
 */
export async function tryExecuteWorkflow(
  request: AiRequest,
  aiContext: AiWorkspaceRequestContext,
  options: WorkflowAdapterOptions
): Promise<WorkflowAdapterResult> {
  const workflowContext: AiContext = {
    workspace: aiContext.workspace,
    user: aiContext.user,
    selectedCreators: aiContext.selectedCreators,
    campaign: aiContext.campaign,
    client: aiContext.client,
    shortlist: aiContext.shortlist,
    filters: aiContext.filters,
    snapshot: aiContext.snapshot,
    conversation: aiContext.conversation,
  };

  const paused = options.pausedWorkflow ?? null;
  const conversationId = options.conversationId ?? request.conversationId;

  let campaignDirector: CampaignDirector | null = null;
  if (conversationId && isCampaignWorkflow(paused?.workflowId)) {
    campaignDirector = await initializeCampaignDirector(
      {
        conversationId,
        workflowId: paused!.workflowId,
        contextSnapshot: options.contextSnapshot,
      },
      options
    );
  }

  const onProgress = options.onProgress
    ? (event: WorkflowProgressEvent) => {
        if (campaignDirector && isCampaignWorkflow(event.workflowId)) {
          campaignDirector.applyProgressEvent(event);
          if (conversationId) {
            void campaignDirector
              .persist(conversationId, buildPersistenceOptions(options, "task_complete", event))
              .catch((err) => {
                console.error(
                  "[workflow-adapter] task autosave failed:",
                  err instanceof Error ? err.message : err
                );
              });
          }
        }
        options.onProgress?.(event);
      }
    : undefined;

  if (paused) {
    const definition = getWorkflowById(paused.workflowId);
    if (!definition) {
      return { handled: false };
    }

    const resumeRequest: AiRequest = {
      ...request,
      message: `${paused.originalUserMessage}\n\nAdditional details: ${request.message.trim()}`,
    };

    const result = await resumeWorkflow(
      definition,
      paused.state,
      resumeRequest,
      workflowContext,
      {
        orchestrator: options.orchestrator,
        supabase: options.supabase,
        contextInput: options.contextInput,
        onProgress,
      }
    );

    let metadata: WorkflowResponseMetadata = {
      ...result.metadata,
    };

    if (!campaignDirector && conversationId) {
      campaignDirector = await initializeCampaignDirector(
        {
          conversationId,
          workflowId: paused.workflowId,
          contextSnapshot: options.contextSnapshot,
        },
        options
      );
    }

    const enriched = campaignDirector
      ? await enrichCampaignWorkflowMetadata(
          metadata,
          result,
          {
            conversationId,
            contextSnapshot: options.contextSnapshot,
          },
          options,
          campaignDirector
        )
      : { metadata };
    metadata = enriched.metadata;

    const content = isCampaignWorkflow(paused.workflowId)
      ? buildCampaignStudioMessage(metadata)
      : result.dashboardContent;

    return {
      handled: true,
      content,
      actionCards: result.actionCards,
      metadata,
      agentId: "workflow-engine",
      workflowResult: result,
      campaignObjectSnapshot: enriched.campaignObjectSnapshot,
      contextSnapshotPatch: enriched.contextSnapshotPatch,
    };
  }

  const match = matchWorkflow(request, workflowContext);

  if (!match.matched || !match.workflow) {
    return { handled: false };
  }

  let effectiveRequest = request;
  let effectiveContext = aiContext;
  let inferredFields: string[] = [];

  if (isCampaignWorkflow(match.workflow.id)) {
    const directed = applyCampaignDirectorContext(request, aiContext);
    effectiveRequest = directed.request;
    effectiveContext = directed.aiContext;
    inferredFields = directed.inferredFields;

    if (conversationId) {
      campaignDirector = await initializeCampaignDirector(
        {
          conversationId,
          workflowId: match.workflow.id,
          contextSnapshot: options.contextSnapshot,
          inferredFields,
        },
        options
      );
    }
  }

  const directedWorkflowContext: AiContext = {
    workspace: effectiveContext.workspace,
    user: effectiveContext.user,
    selectedCreators: effectiveContext.selectedCreators,
    campaign: effectiveContext.campaign,
    client: effectiveContext.client,
    shortlist: effectiveContext.shortlist,
    filters: effectiveContext.filters,
    snapshot: effectiveContext.snapshot,
    conversation: effectiveContext.conversation,
    campaignIntelligenceProfileId: effectiveContext.campaignIntelligenceProfileId,
  };

  if (onProgress && isCampaignWorkflow(match.workflow.id)) {
    const firstTask = match.workflow.tasks[0];
    onProgress({
      workflowId: match.workflow.id,
      step: 0,
      totalSteps: match.workflow.tasks.length,
      taskId: firstTask?.id ?? "analyze-request",
      taskTitle: firstTask?.title ?? "Campaign Studio",
      status: "running",
      progress: 0,
    });
  }

  const result = await executeWorkflow(
    match.workflow,
    effectiveRequest,
    directedWorkflowContext,
    {
      orchestrator: options.orchestrator,
      supabase: options.supabase,
      contextInput: options.contextInput,
      onProgress,
    }
  );

  let metadata: WorkflowResponseMetadata = {
    ...result.metadata,
    ...(inferredFields.length > 0 ? { inferredFields } : {}),
  };

  const enriched = campaignDirector
    ? await enrichCampaignWorkflowMetadata(
        metadata,
        result,
        {
          conversationId,
          contextSnapshot: options.contextSnapshot,
          inferredFields,
        },
        options,
        campaignDirector
      )
    : { metadata };
  metadata = enriched.metadata;

  const content = isCampaignWorkflow(match.workflow.id)
    ? buildCampaignStudioMessage(metadata)
    : result.dashboardContent;

  return {
    handled: true,
    content,
    actionCards: result.actionCards,
    metadata,
    agentId: "workflow-engine",
    workflowResult: result,
    campaignObjectSnapshot: enriched.campaignObjectSnapshot,
    contextSnapshotPatch: enriched.contextSnapshotPatch,
  };
}

function buildCampaignStudioMessage(metadata: WorkflowResponseMetadata): string {
  if (metadata.status === "paused" && metadata.clarificationQuestion) {
    return metadata.clarificationQuestion;
  }

  // Campaign Studio renders progress, sections, and approval cards — skip duplicate chat caption.
  if (metadata.workflowId === "create-campaign") {
    return "";
  }

  if (metadata.status === "completed") {
    return CAMPAIGN_STUDIO_COPY.ready;
  }
  return CAMPAIGN_STUDIO_COPY.building;
}
