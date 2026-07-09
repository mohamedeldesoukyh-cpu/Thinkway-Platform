import { aggregateWorkflowResults } from "@/features/ai-workflows/dashboard/result-aggregator";
import { getWorkflowById } from "@/features/ai-workflows/definitions";
import type {
  WorkflowProgressEvent,
  WorkflowResponseMetadata,
  WorkflowState,
  WorkflowTaskResult,
} from "@/features/ai-workflows/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  applyDirectorPipelineToCampaignObject,
  getDirectorPipelineFromState,
} from "@/features/campaign-director/integrations/workflow-integration";
import {
  getOrCreateCampaignObject,
  getOrLoadCampaignObject,
  isAutosaveTaskStatus,
  saveCampaignObject,
  type SaveCampaignObjectOptions,
} from "./campaign-object-store";
import {
  applySpecialistUpdate,
  applySummarySectionsToCampaignObject,
  applyTaskResultToCampaignObject,
  syncCampaignObjectMeta,
  syncSpecialistProgress,
} from "./section-updaters";
import type {
  CampaignObject,
  CampaignSpecialistId,
  SpecialistSectionUpdate,
} from "../types/campaign-object";

export type CampaignDirectorContext = {
  conversationId: string;
  contextSnapshot?: Record<string, unknown>;
};

export type CampaignDirectorPersistOptions = SaveCampaignObjectOptions & {
  autosaveFromTask?: WorkflowProgressEvent | WorkflowTaskResult;
};

/**
 * Campaign Director coordinates workflow events and routes specialist outputs
 * to the correct CampaignObject sections. It does not write section content directly.
 */
export class CampaignDirector {
  private campaignObject: CampaignObject;

  constructor(campaignObject: CampaignObject) {
    this.campaignObject = campaignObject;
  }

  static initialize(input: {
    conversationId: string;
    workflowId: string;
    contextSnapshot?: Record<string, unknown>;
    inferredFields?: string[];
    existingObject?: CampaignObject | null;
  }): CampaignDirector {
    const object =
      input.existingObject ??
      getOrCreateCampaignObject({
        conversationId: input.conversationId,
        workflowId: input.workflowId,
        contextSnapshot: input.contextSnapshot,
        inferredFields: input.inferredFields,
      });
    const director = new CampaignDirector(object);
    director.campaignObject = syncCampaignObjectMeta(director.campaignObject, {
      workflowStatus: "running",
      status: "building",
      inferredFields: input.inferredFields,
    });
    return director;
  }

  static fromSnapshot(context: CampaignDirectorContext): CampaignDirector | null {
    const existing = getOrLoadCampaignObject(context.conversationId, context.contextSnapshot);
    if (!existing) return null;
    return new CampaignDirector(existing);
  }

  getObject(): CampaignObject {
    return this.campaignObject;
  }

  applySpecialistUpdate(
    specialistId: CampaignSpecialistId | "director",
    updates: SpecialistSectionUpdate[]
  ): CampaignObject {
    this.campaignObject = applySpecialistUpdate(this.campaignObject, specialistId, updates);
    return this.campaignObject;
  }

  applyTaskResult(
    result: WorkflowTaskResult,
    stateData: Record<string, unknown> = {}
  ): CampaignObject {
    this.campaignObject = applyTaskResultToCampaignObject(
      this.campaignObject,
      result,
      stateData
    );
    return this.campaignObject;
  }

  applyProgressEvent(event: WorkflowProgressEvent): CampaignObject {
    this.campaignObject = syncCampaignObjectMeta(this.campaignObject, {
      workflowStatus: event.status === "running" ? "running" : this.campaignObject.meta.workflowStatus,
      currentStep: event.step,
      totalSteps: event.totalSteps,
      progressPercent: event.progress,
    });

    this.campaignObject = syncSpecialistProgress(this.campaignObject, {
      activeTaskId: event.status === "running" ? event.taskId : undefined,
      activeTaskTitle: event.status === "running" ? event.taskTitle : undefined,
    });

    if (event.status === "running") {
      this.campaignObject = applyTaskResultToCampaignObject(
        this.campaignObject,
        {
          taskId: event.taskId,
          status: "running",
        },
        {}
      );
    }

    return this.campaignObject;
  }

  syncFromWorkflowState(state: WorkflowState): CampaignObject {
    const definition = getWorkflowById(state.workflowId);
    const summarySections = aggregateWorkflowResults(state, definition ?? undefined);

    this.campaignObject = applySummarySectionsToCampaignObject(
      this.campaignObject,
      summarySections
    );

    const directorPipeline = getDirectorPipelineFromState(state.data);
    if (directorPipeline) {
      this.campaignObject = applyDirectorPipelineToCampaignObject(
        this.campaignObject,
        directorPipeline
      );
    }

    const completedTaskIds = Object.entries(state.taskResults)
      .filter(([, result]) => result.status === "completed" || result.status === "awaiting_approval")
      .map(([taskId]) => taskId);

    this.campaignObject = syncSpecialistProgress(this.campaignObject, {
      completedTaskIds,
    });

    this.campaignObject = syncCampaignObjectMeta(this.campaignObject, {
      workflowStatus: state.status,
      pauseReason: state.pauseReason,
      clarificationQuestion: state.pauseMessage,
      currentStep: state.currentTaskIndex + 1,
      totalSteps: definition?.tasks.length,
      progressPercent: definition
        ? Math.round(((state.currentTaskIndex + 1) / definition.tasks.length) * 100)
        : undefined,
      completedTasks: completedTaskIds.map((id) => {
        const task = definition?.tasks.find((t) => t.id === id);
        return task?.title ?? id;
      }),
    });

    return this.campaignObject;
  }

  syncFromMetadata(metadata: WorkflowResponseMetadata): CampaignObject {
    if (metadata.summarySections?.length) {
      this.campaignObject = applySummarySectionsToCampaignObject(
        this.campaignObject,
        metadata.summarySections
      );
    }

    this.campaignObject = syncSpecialistProgress(this.campaignObject, {
      completedTasks: metadata.completedTasks,
    });

    this.campaignObject = syncCampaignObjectMeta(this.campaignObject, {
      workflowStatus: metadata.status,
      pauseReason: metadata.pauseReason,
      clarificationQuestion: metadata.clarificationQuestion,
      currentStep: metadata.currentStep,
      totalSteps: metadata.totalSteps,
      progressPercent: metadata.totalSteps
        ? Math.round((metadata.currentStep / metadata.totalSteps) * 100)
        : undefined,
      completedTasks: metadata.completedTasks,
      pendingTasks: metadata.pendingTasks,
      inferredFields: metadata.inferredFields,
    });

    return this.campaignObject;
  }

  async persist(
    conversationId: string,
    options?: CampaignDirectorPersistOptions
  ): Promise<CampaignObject> {
    const shouldPersist = Boolean(
      options?.persistToDb &&
        options.supabase &&
        options.userId &&
        (options.saveReason === "workflow_complete" ||
          options.saveReason === "manual" ||
          (options.autosaveFromTask &&
            isAutosaveTaskStatus(options.autosaveFromTask.status)))
    );

    this.campaignObject = await saveCampaignObject(conversationId, this.campaignObject, {
      ...options,
      persistToDb: shouldPersist,
      saveReason:
        options?.saveReason ??
        (options?.autosaveFromTask && isAutosaveTaskStatus(options.autosaveFromTask.status)
          ? "task_complete"
          : undefined),
    });
    return this.campaignObject;
  }
}

/** Apply all completed task results from workflow state to a campaign object. */
export function buildCampaignObjectFromWorkflowState(
  campaignObject: CampaignObject,
  state: WorkflowState
): CampaignObject {
  const director = new CampaignDirector(campaignObject);
  return director.syncFromWorkflowState(state);
}

/** Convenience: initialize director, sync state, persist to memory + DB. */
export async function processWorkflowForCampaignObject(input: {
  conversationId: string;
  workflowId: string;
  state: WorkflowState;
  metadata: WorkflowResponseMetadata;
  contextSnapshot?: Record<string, unknown>;
  inferredFields?: string[];
  supabase?: SupabaseClient<Database>;
  userId?: string;
  campaignHeaderId?: string | null;
}): Promise<CampaignObject> {
  let existingObject: CampaignObject | null = null;
  if (input.supabase) {
    const { loadCampaignObjectForConversation } = await import("./campaign-object-store");
    existingObject = await loadCampaignObjectForConversation(
      input.supabase,
      input.conversationId,
      input.contextSnapshot
    );
  }

  const director = CampaignDirector.initialize({
    conversationId: input.conversationId,
    workflowId: input.workflowId,
    contextSnapshot: input.contextSnapshot,
    inferredFields: input.inferredFields ?? input.metadata.inferredFields,
    existingObject,
  });

  for (const result of Object.values(input.state.taskResults)) {
    director.applyTaskResult(result, input.state.data);
  }

  director.syncFromWorkflowState(input.state);
  director.syncFromMetadata(input.metadata);

  return await director.persist(input.conversationId, {
    supabase: input.supabase,
    userId: input.userId,
    campaignHeaderId: input.campaignHeaderId,
    persistToDb: Boolean(input.supabase && input.userId),
    saveReason: "workflow_complete",
  });
}
