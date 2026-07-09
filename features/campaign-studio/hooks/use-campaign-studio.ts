import { useMemo } from "react";

import { enrichCampaignObjectWithStudioData } from "@/features/campaign-intelligence";
import { stripConversationalFiller } from "@/features/ai-workflows/formatters/creator-formatter";
import type { WorkflowSummarySection } from "@/features/ai-workflows";
import { campaignObjectToStudioState } from "@/features/campaign-intelligence/services/studio-renderer";

import {
  CAMPAIGN_STUDIO_SECTION_DEFS,
  SPECIALIST_LABELS,
  SPECIALIST_TASK_MAP,
  type CampaignSpecialistId,
  type CampaignSpecialistStatus,
  type CampaignStudioInput,
  type CampaignStudioSection,
  type CampaignStudioSectionId,
  type CampaignStudioSectionStatus,
  type CampaignStudioState,
} from "../types/campaign-studio";

function resolveSectionContent(
  sectionId: CampaignStudioSectionId,
  summaryMap: Map<string, WorkflowSummarySection>,
  analyzeContent?: string
): string {
  const def = CAMPAIGN_STUDIO_SECTION_DEFS.find((entry) => entry.id === sectionId);
  if (!def) return "";

  for (const summaryId of def.summaryIds) {
    const section = summaryMap.get(summaryId);
    if (section?.content?.trim()) {
      const content = stripConversationalFiller(section.content.trim());

      if (sectionId === "campaign-summary" && summaryId === "campaign-brief") {
        const brief = content;
        const summary = analyzeContent?.trim()
          ? `${analyzeContent.trim()}\n\n${brief}`
          : brief;
        return stripConversationalFiller(summary);
      }

      return content;
    }
  }

  if (sectionId === "campaign-summary" && analyzeContent?.trim()) {
    return stripConversationalFiller(analyzeContent.trim());
  }

  return "";
}

function resolveSectionStatus(
  sectionId: CampaignStudioSectionId,
  taskId: string | undefined,
  taskStatus: string | undefined,
  completedTasks: string[],
  workflowStatus: string
): CampaignStudioSectionStatus {
  const def = CAMPAIGN_STUDIO_SECTION_DEFS.find((entry) => entry.id === sectionId);
  if (!def) return "pending";

  const taskTitlesCompleted = new Set(completedTasks.map((task) => task.toLowerCase()));

  const allTasksComplete = def.taskIds.every((id) => {
    const taskTitle = TASK_ID_TO_TITLE[id]?.toLowerCase();
    return taskTitle ? taskTitlesCompleted.has(taskTitle) : false;
  });

  if (allTasksComplete) {
    return workflowStatus === "paused" && def.taskIds.includes(taskId ?? "")
      ? "blocked"
      : "complete";
  }

  if (taskId && def.taskIds.includes(taskId)) {
    if (taskStatus === "running") return "running";
    if (taskStatus === "blocked") return "blocked";
  }

  return "pending";
}

const TASK_ID_TO_TITLE: Record<string, string> = {
  "analyze-request": "Analyze request",
  "build-strategy": "Build campaign strategy",
  "estimate-budget": "Estimate campaign budget",
  "search-creators": "Search creators",
  "build-shortlist": "Build recommended shortlist",
  "generate-brief": "Generate campaign brief",
  "generate-timeline": "Generate timeline",
  "prepare-approval": "Prepare approval action",
};

function buildSpecialists(
  taskId: string | undefined,
  taskTitle: string | undefined,
  taskStatus: string | undefined,
  completedTasks: string[]
): CampaignSpecialistStatus[] {
  const completedSet = new Set(completedTasks.map((task) => task.toLowerCase()));

  return (Object.keys(SPECIALIST_TASK_MAP) as CampaignSpecialistId[]).map((id) => {
    const taskIds = SPECIALIST_TASK_MAP[id];
    const titles = taskIds
      .map((taskKey) => TASK_ID_TO_TITLE[taskKey])
      .filter(Boolean) as string[];

    const allComplete = titles.every((title) => completedSet.has(title.toLowerCase()));
    const isActive =
      taskId != null &&
      taskIds.includes(taskId) &&
      (taskStatus === "running" || taskStatus === "blocked");

    let status: CampaignSpecialistStatus["status"] = "idle";
    if (allComplete) status = "complete";
    else if (isActive) status = "working";

    return {
      id,
      label: SPECIALIST_LABELS[id],
      status,
      currentTask: isActive ? taskTitle : undefined,
    };
  });
}

function buildSections(input: CampaignStudioInput): CampaignStudioSection[] {
  const summaryMap = new Map(
    (input.summarySections ?? []).map((section) => [section.id, section])
  );
  const analyzeSection = input.summarySections?.find(
    (section) => section.taskId === "analyze-request"
  );
  const completedTasks = input.completedTasks ?? [];

  return CAMPAIGN_STUDIO_SECTION_DEFS.map((def) => {
    const content = resolveSectionContent(
      def.id,
      summaryMap,
      analyzeSection?.content
    );
    const status = resolveSectionStatus(
      def.id,
      input.taskId,
      input.taskStatus,
      completedTasks,
      input.workflowStatus ?? "running"
    );

    const agentId = def.summaryIds
      .map((summaryId) => summaryMap.get(summaryId)?.agentId)
      .find(Boolean);

    return {
      id: def.id,
      title: def.title,
      status,
      content,
      taskIds: def.taskIds,
      agentId,
    };
  });
}

export function buildCampaignStudioState(
  input: CampaignStudioInput
): CampaignStudioState | null {
  if (!input.workflowId || input.workflowId !== "create-campaign") {
    return null;
  }

  if (input.campaignObject) {
    const enrichedObject = enrichCampaignObjectWithStudioData(input.campaignObject);
    const fromObject = campaignObjectToStudioState(enrichedObject, {
      actionCards: input.actionCards,
      activeTaskId: input.taskId,
    });
    return {
      ...fromObject,
      workflowName: input.workflowName ?? fromObject.workflowName,
      workflowStatus: input.workflowStatus ?? fromObject.workflowStatus,
      campaignObject: enrichedObject,
      clarificationQuestion:
        input.clarificationQuestion ?? fromObject.clarificationQuestion,
      inferredFields: input.inferredFields ?? fromObject.inferredFields,
    };
  }

  const totalSteps = input.totalSteps ?? 8;
  const currentStep = input.currentStep ?? 0;
  const progressPercent =
    input.progressPercent ??
    (totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0);

  return {
    workflowId: input.workflowId,
    workflowName: input.workflowName ?? "Campaign Studio",
    workflowStatus: input.workflowStatus ?? "running",
    currentStep,
    totalSteps,
    progressPercent,
    specialists: buildSpecialists(
      input.taskId,
      input.taskTitle,
      input.taskStatus,
      input.completedTasks ?? []
    ),
    sections: buildSections(input),
    clarificationQuestion: input.clarificationQuestion,
    inferredFields: input.inferredFields,
    actionCards: input.actionCards,
  };
}

export function useCampaignStudio(input: CampaignStudioInput): CampaignStudioState | null {
  const {
    workflowId,
    workflowName,
    workflowStatus,
    currentStep,
    totalSteps,
    progressPercent,
    taskId,
    taskTitle,
    taskStatus,
    campaignObject,
    summarySections,
    clarificationQuestion,
    completedTasks,
    pendingTasks,
    inferredFields,
    actionCards,
  } = input;

  const campaignObjectId = campaignObject?.id;
  const campaignObjectUpdatedAt = campaignObject?.updatedAt;
  const summarySectionsKey = summarySections
    ?.map((section) => `${section.id}:${section.content.length}`)
    .join("|");

  return useMemo(
    () => buildCampaignStudioState(input),
    [
      workflowId,
      workflowName,
      workflowStatus,
      currentStep,
      totalSteps,
      progressPercent,
      taskId,
      taskTitle,
      taskStatus,
      campaignObjectId,
      campaignObjectUpdatedAt,
      summarySectionsKey,
      clarificationQuestion,
      completedTasks,
      pendingTasks,
      inferredFields,
      actionCards,
    ]
  );
}

export function isCampaignStudioActive(input: {
  workflowId?: string;
  intent?: string;
}): boolean {
  if (input.workflowId === "create-campaign") return true;
  if (input.intent === "strategize") return false;
  return false;
}
