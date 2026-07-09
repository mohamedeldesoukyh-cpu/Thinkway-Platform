import { stripConversationalFiller } from "@/features/ai-workflows/formatters/creator-formatter";
import type { WorkflowSummarySection } from "@/features/ai-workflows";

import {
  CAMPAIGN_STUDIO_SECTION_DEFS,
  type CampaignSpecialistId,
  type CampaignSpecialistStatus,
  type CampaignStudioSection,
  type CampaignStudioSectionId,
  type CampaignStudioSectionStatus,
  type CampaignStudioState,
} from "@/features/campaign-studio/types/campaign-studio";
import {
  SPECIALIST_LABELS,
  SPECIALIST_SECTION_MAP,
  SPECIALIST_TASK_MAP,
} from "../constants/specialist-section-map";
import { formatSectionContentForDisplay } from "./section-formatters";
import type { CreatorsSectionData } from "../types/section-schemas";
import type { CampaignObject, CampaignSectionStatus } from "../types/campaign-object";

function mapSectionStatus(
  objectStatus: CampaignSectionStatus,
  workflowStatus?: string,
  isActive?: boolean
): CampaignStudioSectionStatus {
  if (objectStatus === "complete") {
    return workflowStatus === "paused" && isActive ? "blocked" : "complete";
  }
  if (objectStatus === "working" || isActive) return "running";
  return "pending";
}

function resolveStudioSectionContent(
  sectionId: CampaignStudioSectionId,
  campaignObject: CampaignObject
): string {
  const { sections } = campaignObject;
  const creatorsData = (sections.creators.data ?? {}) as CreatorsSectionData;

  switch (sectionId) {
    case "campaign-summary":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.summary.content)
      );
    case "executive-strategy":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.strategy.content)
      );
    case "creator-discovery":
      return stripConversationalFiller(
        creatorsData.discoveryDisplay ??
          formatSectionContentForDisplay(sections.creators.content)
      );
    case "creator-recommendations":
      return stripConversationalFiller(
        creatorsData.recommendationsDisplay ?? ""
      );
    case "budget-planner":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.budget.content)
      );
    case "timeline":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.timeline.content)
      );
    case "kpi-forecast":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.performance.content)
      );
    case "risk-analysis":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.operations.content)
      );
    case "creative-concepts":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.strategy.content)
      );
    case "content-plan":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.timeline.content)
      );
    case "creator-mix":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.strategy.content)
      );
    case "why-ai":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.strategy.content)
      );
    case "industry-benchmark":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.budget.content)
      );
    case "success-probability":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.performance.content)
      );
    case "opportunity-finder":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.strategy.content)
      );
    case "executive-summary":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.presentation.content)
      );
    case "presentation-status":
      return stripConversationalFiller(
        formatSectionContentForDisplay(sections.presentation.content)
      );
    default:
      return "";
  }
}

function resolveStudioSectionStatus(
  sectionId: CampaignStudioSectionId,
  campaignObject: CampaignObject,
  activeTaskId?: string
): CampaignStudioSectionStatus {
  const def = CAMPAIGN_STUDIO_SECTION_DEFS.find((entry) => entry.id === sectionId);
  if (!def) return "pending";

  const isActive = activeTaskId != null && def.taskIds.includes(activeTaskId);

  const sourceKeys: Array<keyof CampaignObject["sections"]> = (() => {
    switch (sectionId) {
      case "campaign-summary":
        return ["summary"];
      case "executive-strategy":
        return ["strategy"];
      case "creator-discovery":
      case "creator-recommendations":
        return ["creators"];
      case "budget-planner":
        return ["budget"];
      case "timeline":
        return ["timeline"];
      case "kpi-forecast":
        return ["performance"];
      case "risk-analysis":
        return ["operations"];
      case "creative-concepts":
      case "creator-mix":
      case "why-ai":
      case "opportunity-finder":
        return ["strategy", "summary"];
      case "industry-benchmark":
        return ["budget", "strategy"];
      case "success-probability":
        return ["performance", "budget"];
      case "executive-summary":
        return ["presentation", "strategy"];
      case "content-plan":
        return ["timeline", "strategy"];
      case "presentation-status":
        return ["presentation"];
      default:
        return [];
    }
  })();

  const objectStatuses = sourceKeys.map((key) => campaignObject.sections[key].status);
  const objectStatus: CampaignSectionStatus = objectStatuses.includes("working")
    ? "working"
    : objectStatuses.includes("complete")
      ? "complete"
      : "pending";

  return mapSectionStatus(objectStatus, campaignObject.meta.workflowStatus, isActive);
}

function buildSectionsFromCampaignObject(
  campaignObject: CampaignObject,
  activeTaskId?: string
): CampaignStudioSection[] {
  return CAMPAIGN_STUDIO_SECTION_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    status: resolveStudioSectionStatus(def.id, campaignObject, activeTaskId),
    content: resolveStudioSectionContent(def.id, campaignObject),
    taskIds: def.taskIds,
    agentId: campaignObject.sections.summary.updatedBy,
  }));
}

function deriveSpecialistStatusFromSections(
  specialistId: CampaignSpecialistId,
  campaignObject: CampaignObject,
  activeTaskId?: string
): CampaignSpecialistStatus {
  const sectionKeys = SPECIALIST_SECTION_MAP[specialistId];
  const sectionStatuses = sectionKeys.map((key) => campaignObject.sections[key].status);
  const taskIds = SPECIALIST_TASK_MAP[specialistId];
  const isActive = activeTaskId != null && taskIds.includes(activeTaskId);

  let status: CampaignSpecialistStatus["status"] = "idle";
  if (sectionStatuses.length > 0 && sectionStatuses.every((s) => s === "complete")) {
    status = "complete";
  } else if (sectionStatuses.some((s) => s === "working") || isActive) {
    status = "working";
  }

  const activeEntry = campaignObject.meta.specialistProgress.find(
    (entry) => entry.id === specialistId && entry.status === "working"
  );

  return {
    id: specialistId,
    label: SPECIALIST_LABELS[specialistId],
    status,
    currentTask: isActive ? activeEntry?.currentTask : undefined,
  };
}

function buildSpecialistsFromCampaignObject(
  campaignObject: CampaignObject,
  activeTaskId?: string
): CampaignSpecialistStatus[] {
  return (Object.keys(SPECIALIST_TASK_MAP) as CampaignSpecialistId[]).map((id) =>
    deriveSpecialistStatusFromSections(id, campaignObject, activeTaskId)
  );
}

export function campaignObjectToStudioState(
  campaignObject: CampaignObject,
  input: {
    actionCards?: CampaignStudioState["actionCards"];
    activeTaskId?: string;
  } = {}
): CampaignStudioState {
  const totalSteps = campaignObject.meta.totalSteps ?? 8;
  const currentStep = campaignObject.meta.currentStep ?? 0;
  const progressPercent =
    campaignObject.meta.progressPercent ??
    (totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0);

  return {
    workflowId: campaignObject.workflowId ?? "create-campaign",
    workflowName: "Create Campaign",
    workflowStatus: campaignObject.meta.workflowStatus ?? "running",
    currentStep,
    totalSteps,
    progressPercent,
    specialists: buildSpecialistsFromCampaignObject(campaignObject, input.activeTaskId),
    sections: buildSectionsFromCampaignObject(campaignObject, input.activeTaskId),
    campaignObject,
    clarificationQuestion: campaignObject.meta.clarificationQuestion,
    inferredFields: campaignObject.meta.inferredFields,
    actionCards: input.actionCards,
  };
}

/** Fallback: derive partial campaign object sections from legacy summarySections. */
export function summarySectionsToCampaignObjectSections(
  summarySections: WorkflowSummarySection[]
): Partial<Record<keyof CampaignObject["sections"], string>> {
  const map = new Map(summarySections.map((section) => [section.id, section.content]));
  return {
    summary: map.get("campaign-brief") ?? "",
    strategy: map.get("campaign-strategy") ?? "",
    budget: map.get("budget") ?? "",
    timeline: map.get("timeline") ?? "",
    creators: map.get("creator-discovery") ?? map.get("recommended-creators") ?? "",
    presentation: map.get("approval") ?? "",
  };
}
