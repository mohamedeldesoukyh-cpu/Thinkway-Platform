import { stripConversationalFiller } from "@/features/ai-workflows/formatters/creator-formatter";
import type { WorkflowSummarySection } from "@/features/ai-workflows";
import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

import {
  SPECIALIST_LABELS,
  SPECIALIST_TASK_MAP,
  SUMMARY_SECTION_TO_CAMPAIGN,
  TASK_SECTION_MAP,
  TASK_SPECIALIST_MAP,
  getTaskTitle,
} from "../constants/specialist-section-map";
import { formatSectionContentForDisplay } from "./section-formatters";
import {
  buildBudgetSectionData,
  buildCreatorDiscoveryData,
  buildCreatorRecommendationData,
  buildKpiForecastFromStrategy,
  buildPresentationStatus,
  buildRiskAnalysisFromBudget,
  buildTimelineSectionData,
  extractCreatorsFromTaskResult,
  formatDiscoveryDisplay,
  formatRecommendationDisplay,
} from "./structured-section-builders";
import { enrichCampaignObjectWithStudioData } from "./studio-section-data-builders";
import { proposeInitialCreatorSlate } from "@/features/campaign-studio/services/propose-creator-slate";
import { mergeBriefIntoCampaignObject } from "@/features/campaign-studio/services/merge-campaign-brief";
import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import {
  applyDirectorBudgetRules,
  applyDirectorTimelineRules,
} from "@/features/campaign-director/integrations/section-builder-integration";
import {
  applyDirectorPipelineToCampaignObject,
  getDirectorPipelineFromState,
} from "@/features/campaign-director/integrations/workflow-integration";
import {
  applyFactsToSummaryData,
  buildBudgetSectionDataFromFacts,
  buildGroundedKpisFromFacts,
  buildTimelineSectionDataFromFacts,
  getCampaignFactsFromState,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import { buildKpiForecastReasoning } from "@/features/campaign-intelligence/services/reasoning/kpi-reasoning";
import { buildVendorDiscoveryFunnel } from "@/features/campaign-intelligence/services/reasoning/vendor-discovery-funnel";
import type {
  BudgetSectionData,
  CreatorsSectionData,
  KpiForecastSectionData,
  PresentationStatusSectionData,
  RiskAnalysisSectionData,
  TimelineSectionData,
} from "../types/section-schemas";
import type {
  CampaignObject,
  CampaignObjectMeta,
  CampaignObjectSections,
  CampaignObjectStatus,
  CampaignSection,
  CampaignSectionKey,
  CampaignSectionStatus,
  CampaignSpecialistId,
  SpecialistProgress,
  SpecialistSectionUpdate,
} from "../types/campaign-object";

function emptySection(): CampaignSection {
  return { content: "", status: "pending" };
}

export function createEmptyCampaignObject(input: {
  id: string;
  conversationId?: string;
  workflowId?: string;
  inferredFields?: string[];
}): CampaignObject {
  const now = new Date().toISOString();
  return {
    id: input.id,
    conversationId: input.conversationId,
    workflowId: input.workflowId,
    updatedAt: now,
    sections: {
      summary: emptySection(),
      audience: emptySection(),
      strategy: emptySection(),
      creators: emptySection(),
      budget: emptySection(),
      timeline: emptySection(),
      performance: emptySection(),
      presentation: emptySection(),
      operations: emptySection(),
    },
    meta: {
      status: "draft",
      specialistProgress: buildSpecialistProgress([], undefined, undefined),
      inferredFields: input.inferredFields,
    },
  };
}

function extractTaskContent(
  result: WorkflowTaskResult,
  stateData: Record<string, unknown>
): string {
  if (result.content?.trim()) {
    return stripConversationalFiller(result.content.trim());
  }

  if (result.structured) {
    for (const key of ["content", "text", "summary", "brief"]) {
      const value = result.structured[key];
      if (typeof value === "string" && value.trim()) {
        return stripConversationalFiller(value.trim());
      }
    }
  }

  if (result.taskId === "generate-brief" && stateData.brief) {
    const brief = stateData.brief as { content?: string; text?: string };
    return stripConversationalFiller((brief.content ?? brief.text ?? "").trim());
  }

  if (result.taskId === "prepare-approval" && stateData.campaignDraft) {
    const draft = stateData.campaignDraft as { name?: string; description?: string };
    const parts = [draft.name, draft.description].filter(Boolean);
    return stripConversationalFiller(parts.join("\n\n"));
  }

  return "";
}

function extractBriefTextFromWorkflow(
  stateData: Record<string, unknown>,
  fallbackContent: string
): string {
  const brief = stateData.brief as
    | {
        content?: string;
        text?: string;
        sections?: Array<{ content?: string; body?: string }>;
      }
    | undefined;
  if (brief?.content?.trim()) return brief.content.trim();
  if (brief?.text?.trim()) return brief.text.trim();
  if (brief?.sections?.length) {
    const joined = brief.sections
      .map((section) => section.content?.trim() || section.body?.trim() || "")
      .filter(Boolean)
      .join("\n\n");
    if (joined.length >= 40) return joined;
  }
  return fallbackContent.trim();
}

/** Mark re-run proposal as in-flight without clearing committed recommendations. */
function beginPendingCreatorProposal(
  data: CreatorsSectionData
): CreatorsSectionData {
  const hasCommittedRecommendations =
    (data.recommendations?.creatorIds?.length ?? 0) > 0;
  if (!hasCommittedRecommendations) {
    return data;
  }
  return {
    ...data,
    pendingProposal: {
      status: "generating",
      generatedAt: new Date().toISOString(),
    },
  };
}

function extractAudienceFromAnalyze(content: string): string {
  const lines = content.split("\n");
  const audienceLines = lines.filter((line) =>
    /audience|demographic|persona|target|consumer/i.test(line)
  );
  if (audienceLines.length > 0) {
    return stripConversationalFiller(audienceLines.slice(0, 6).join("\n"));
  }
  return content.trim()
    ? stripConversationalFiller(content.trim())
    : "";
}

function setSection(
  sections: CampaignObjectSections,
  key: CampaignSectionKey,
  content: string | Record<string, unknown>,
  specialistId: CampaignSpecialistId | "director",
  status: CampaignSectionStatus,
  data?: Record<string, unknown>
): void {
  const section = sections[key];
  sections[key] = {
    content,
    data: data ? { ...section.data, ...data } : section.data,
    updatedBy: specialistId,
    updatedAt: new Date().toISOString(),
    status: status === "pending" && (typeof content === "string" ? content.trim() : true)
      ? "complete"
      : status,
  };
}

function deriveSectionUpdatesFromTask(
  taskId: string,
  content: string,
  result: WorkflowTaskResult,
  sections: CampaignObjectSections,
  stateData: Record<string, unknown>
): SpecialistSectionUpdate[] {
  const updates: SpecialistSectionUpdate[] = [];
  const sectionKeys = TASK_SECTION_MAP[taskId] ?? [];

  for (const key of sectionKeys) {
    if (key === "audience" && taskId === "analyze-request") {
      updates.push({
        sectionKey: key,
        content: extractAudienceFromAnalyze(content),
        status: "complete",
      });
      continue;
    }

    if (key === "performance" && taskId === "build-strategy") {
      const campaignFacts = getCampaignFactsFromState(stateData);
      const strategy = getStrategyFromWorkflowData(stateData);
      const factsKpis = campaignFacts ? buildGroundedKpisFromFacts(campaignFacts) : [];
      const kpiData: KpiForecastSectionData =
        factsKpis.length > 0
          ? {
              kpis: factsKpis.map((k) => ({
                metric: k.metric,
                target: k.prediction,
                benchmark: k.benchmark,
                platform: k.platform,
              })),
              forecastNotes: "Forecasts based on campaign facts SSOT.",
            }
          : buildKpiForecastFromStrategy(content, campaignFacts, strategy);
      updates.push({
        sectionKey: key,
        content: kpiData,
        data: campaignFacts
          ? {
              groundedKpis: factsKpis,
              kpiReasoning:
                strategy && campaignFacts
                  ? buildKpiForecastReasoning(campaignFacts, strategy).kpis
                  : undefined,
              summaryCards: undefined,
            }
          : undefined,
        status: "complete",
      });
      continue;
    }

    if (key === "operations" && taskId === "estimate-budget") {
      const campaignFacts = getCampaignFactsFromState(stateData);
      const budgetContent = sections.budget.content;
      const budgetData =
        typeof budgetContent === "object" && budgetContent !== null
          ? (budgetContent as BudgetSectionData)
          : campaignFacts
            ? buildBudgetSectionDataFromFacts(
                campaignFacts,
                typeof stateData.userMessage === "string" ? stateData.userMessage : content,
                getStrategyFromWorkflowData(stateData)
              )
            : buildBudgetSectionData(content, stateData);
      const strategyContent =
        typeof sections.strategy.content === "string" ? sections.strategy.content : "";
      const riskData: RiskAnalysisSectionData = buildRiskAnalysisFromBudget(
        budgetData,
        strategyContent
      );
      updates.push({
        sectionKey: key,
        content: riskData,
        status: "complete",
      });
      continue;
    }

    if (key === "budget" && taskId === "estimate-budget") {
      const campaignFacts = getCampaignFactsFromState(stateData);
      const briefText =
        typeof stateData.userMessage === "string" ? stateData.userMessage : content;
      const strategy = getStrategyFromWorkflowData(stateData);
      let budgetData = campaignFacts
        ? buildBudgetSectionDataFromFacts(campaignFacts, briefText, strategy)
        : buildBudgetSectionData(content, stateData);
      if (strategy) {
        budgetData = applyDirectorBudgetRules(
          budgetData,
          strategy,
          briefText,
          campaignFacts
        );
      }
      updates.push({
        sectionKey: key,
        content: budgetData,
        data: {
          directorRationale: strategy?.understanding.budget?.rationale,
          ...(campaignFacts
            ? {
                summaryCards: applyFactsToSummaryData({}, campaignFacts),
              }
            : {}),
        },
        status: "complete",
      });
      continue;
    }

    if (key === "timeline" && taskId === "generate-timeline") {
      const campaignFacts = getCampaignFactsFromState(stateData);
      const strategy = getStrategyFromWorkflowData(stateData);
      let timelineData: TimelineSectionData = campaignFacts
        ? buildTimelineSectionDataFromFacts(campaignFacts, strategy)
        : buildTimelineSectionData(content);
      if (strategy && !campaignFacts) {
        timelineData = applyDirectorTimelineRules(timelineData, strategy);
      } else if (strategy && campaignFacts) {
        timelineData = applyDirectorTimelineRules(timelineData, strategy);
      }
      updates.push({
        sectionKey: key,
        content: timelineData,
        data: { directorRationale: strategy?.understanding.timeline?.rationale },
        status: "complete",
      });
      continue;
    }

    if (key === "presentation" && taskId === "prepare-approval") {
      const presentationData: PresentationStatusSectionData = buildPresentationStatus(
        content,
        stateData,
        "awaiting_approval"
      );
      updates.push({
        sectionKey: key,
        content: presentationData,
        status: "complete",
      });
      continue;
    }

    if (key === "creators") {
      const existingData = (sections.creators.data ?? {}) as CreatorsSectionData;
      const creators = extractCreatorsFromTaskResult(result, stateData);
      const indexedTotal =
        typeof stateData.searchTotal === "number" ? stateData.searchTotal : undefined;
      const total =
        creators.length > 0
          ? indexedTotal ?? creators.length
          : 0;
      const query =
        typeof result.structured?.searchQuery === "string"
          ? result.structured.searchQuery
          : undefined;

      if (taskId === "search-creators") {
        const campaignFacts = getCampaignFactsFromState(stateData);
        const strategy = getStrategyFromWorkflowData(stateData);
        const discoveryDisplay = formatDiscoveryDisplay(creators, total, query);
        const hasResults = creators.length > 0;
        const funnel =
          campaignFacts && strategy
            ? buildVendorDiscoveryFunnel(campaignFacts, strategy, total, !hasResults)
            : undefined;
        const cipProfileId =
          typeof stateData.campaignIntelligenceProfileId === "string"
            ? stateData.campaignIntelligenceProfileId
            : undefined;
        const discoveryData = beginPendingCreatorProposal(existingData);
        updates.push({
          sectionKey: key,
          content: discoveryDisplay,
          data: {
            ...discoveryData,
            phase: hasResults ? "discovery" : existingData.phase ?? "pending",
            discovery: buildCreatorDiscoveryData(creators, total, query, campaignFacts, strategy),
            discoveryDisplay,
            vendorDiscoveryFunnel: funnel,
            discoveryPipeline: funnel,
            discoveryEngine: cipProfileId ? "cip" : "keyword",
            cipProfileId,
            constraintReport:
              stateData.constraintReport &&
              typeof stateData.constraintReport === "object"
                ? (stateData.constraintReport as CreatorsSectionData["constraintReport"])
                : existingData.constraintReport,
            lastDiscoveryAt: new Date().toISOString(),
          },
          status: hasResults ? "working" : "pending",
        });
        continue;
      }

      if (taskId === "build-shortlist") {
        const campaignFacts = getCampaignFactsFromState(stateData);
        const strategy = getStrategyFromWorkflowData(stateData);
        const poolCreators = Array.isArray(stateData.searchResults)
          ? (stateData.searchResults as import("@/features/ai-workflows/formatters/creator-formatter").GroundedCreator[])
          : [];
        const groundedCreators =
          creators.length > 0 ? creators : poolCreators.length > 0 ? poolCreators : [];
        const recommendationData = buildCreatorRecommendationData(
          groundedCreators,
          query,
          campaignFacts,
          strategy,
          poolCreators
        );
        const recommendationsDisplay =
          groundedCreators.length > 0
            ? formatRecommendationDisplay(groundedCreators, query)
            : "_No vendors available to recommend — run discovery search first._";
        const discoveryDisplay =
          existingData.discoveryDisplay ??
          (typeof sections.creators.content === "string" ? sections.creators.content : "");
        const fitScoreCount = Object.keys(
          recommendationData.creatorFitScores ?? {}
        ).length;
        const poolSize =
          existingData.discovery?.total ??
          (typeof stateData.searchTotal === "number" ? stateData.searchTotal : undefined) ??
          groundedCreators.length;
        const funnel =
          campaignFacts && strategy
            ? buildVendorDiscoveryFunnel(
                campaignFacts,
                strategy,
                groundedCreators.length,
                false,
                { initialPoolCount: poolSize }
              )
            : existingData.vendorDiscoveryFunnel;
        updates.push({
          sectionKey: key,
          content: discoveryDisplay,
          data: {
            ...existingData,
            phase: groundedCreators.length > 0 ? "complete" : "pending",
            recommendations: recommendationData,
            recommendationsDisplay,
            fitScoreCount,
            vendorDiscoveryFunnel: funnel,
            discoveryPipeline: funnel,
            constraintReport:
              stateData.constraintReport &&
              typeof stateData.constraintReport === "object"
                ? (stateData.constraintReport as CreatorsSectionData["constraintReport"])
                : existingData.constraintReport,
            lastShortlistAt: new Date().toISOString(),
          },
          status: groundedCreators.length > 0 ? "complete" : "pending",
        });
        continue;
      }

      updates.push({
        sectionKey: key,
        content,
        status: content.trim() ? "complete" : "pending",
      });
      continue;
    }

    updates.push({
      sectionKey: key,
      content,
      status: content.trim() ? "complete" : "pending",
    });
  }

  return updates;
}

export function applySpecialistUpdate(
  campaignObject: CampaignObject,
  specialistId: CampaignSpecialistId | "director",
  updates: SpecialistSectionUpdate[]
): CampaignObject {
  const sections = { ...campaignObject.sections };

  for (const update of updates) {
    const existing = sections[update.sectionKey];
    sections[update.sectionKey] = {
      content: update.content,
      data: update.data ? { ...existing.data, ...update.data } : existing.data,
      updatedBy: specialistId,
      updatedAt: new Date().toISOString(),
      status: update.status ?? (update.content ? "complete" : existing.status),
    };
  }

  return {
    ...campaignObject,
    sections,
    updatedAt: new Date().toISOString(),
  };
}

export function applyTaskResultToCampaignObject(
  campaignObject: CampaignObject,
  result: WorkflowTaskResult,
  stateData: Record<string, unknown> = {}
): CampaignObject {
  if (result.status === "skipped" || result.status === "failed") {
    return campaignObject;
  }

  if (result.taskId === "search-creators" && result.status === "running") {
    const creatorsData = (campaignObject.sections.creators.data ??
      {}) as CreatorsSectionData;
    return applySpecialistUpdate(campaignObject, "scout", [
      {
        sectionKey: "creators",
        content: campaignObject.sections.creators.content ?? "",
        data: beginPendingCreatorProposal(creatorsData),
        status: "working",
      },
    ]);
  }

  const specialistId = TASK_SPECIALIST_MAP[result.taskId] ?? "director";
  const content = extractTaskContent(result, stateData);
  const isTerminal =
    result.status === "completed" ||
    result.status === "awaiting_approval" ||
    result.status === "blocked";

  if (!content.trim() && !isTerminal && result.taskId !== "search-creators") {
    return markTaskWorking(campaignObject, result.taskId, specialistId);
  }

  const sectionStatus: CampaignSectionStatus =
    result.status === "running"
      ? "working"
      : result.status === "completed" || result.status === "awaiting_approval"
        ? "complete"
        : result.status === "blocked"
          ? "working"
          : "pending";

  const updates = deriveSectionUpdatesFromTask(
    result.taskId,
    content,
    result,
    campaignObject.sections,
    stateData
  ).map((update) => ({
    ...update,
    status: update.status ?? sectionStatus,
  }));

  let updated = applySpecialistUpdate(
    campaignObject,
    specialistId as CampaignSpecialistId,
    updates
  );

  const campaignFactsFromState = getCampaignFactsFromState(stateData);
  if (campaignFactsFromState) {
    updated = {
      ...updated,
      meta: { ...updated.meta, campaignFacts: campaignFactsFromState },
    };
  }

  if (result.taskId === "generate-brief" && isTerminal) {
    const creatorsData = (updated.sections.creators.data ?? {}) as CreatorsSectionData;
    const existingSlate = creatorsData.recommendations?.creatorIds ?? [];
    const briefText = extractBriefTextFromWorkflow(stateData, content);
    if (existingSlate.length > 0 && briefText.length >= 40) {
      const merged = mergeBriefIntoCampaignObject(updated, briefText);
      if (merged.change) updated = merged.campaignObject;
    }
  }

  updated = syncSpecialistProgress(updated, {
    activeTaskId: result.status === "running" ? result.taskId : undefined,
    activeTaskTitle: result.status === "running" ? getTaskTitle(result.taskId) : undefined,
    completedTaskIds: isTerminal ? [result.taskId] : [],
  });

  if (result.status === "running") {
    updated.meta.status = "building";
  }

  const directorPipeline = getDirectorPipelineFromState(stateData);
  if (directorPipeline?.approvalGate.approved) {
    const campaignFacts = stateData.campaignFacts as
      | import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts
      | undefined;
    updated = applyDirectorPipelineToCampaignObject(updated, directorPipeline, campaignFacts);
    const poolCreators = Array.isArray(stateData.searchResults)
      ? (stateData.searchResults as GroundedCreator[])
      : undefined;
    updated = proposeInitialCreatorSlate(updated, {
      poolCreators,
      query: typeof stateData.searchQuery === "string" ? stateData.searchQuery : undefined,
    });
  }

  return enrichCampaignObjectWithStudioData(updated);
}

function markTaskWorking(
  campaignObject: CampaignObject,
  taskId: string,
  specialistId: CampaignSpecialistId | "director"
): CampaignObject {
  const sectionKeys = TASK_SECTION_MAP[taskId] ?? [];
  const updates: SpecialistSectionUpdate[] = sectionKeys.map((key) => ({
    sectionKey: key,
    content: "",
    status: "working" as const,
  }));

  let updated = applySpecialistUpdate(
    campaignObject,
    specialistId as CampaignSpecialistId,
    updates
  );

  updated = syncSpecialistProgress(updated, {
    activeTaskId: taskId,
    activeTaskTitle: getTaskTitle(taskId),
  });
  updated.meta.status = "building";

  return updated;
}

export function applySummarySectionsToCampaignObject(
  campaignObject: CampaignObject,
  summarySections: WorkflowSummarySection[]
): CampaignObject {
  let updated = { ...campaignObject, sections: { ...campaignObject.sections } };
  const campaignFacts = campaignObject.meta.campaignFacts;

  for (const summary of summarySections) {
    const targetKeys = SUMMARY_SECTION_TO_CAMPAIGN[summary.id] ?? [];
    const specialistId =
      TASK_SPECIALIST_MAP[summary.taskId] ?? ("director" as CampaignSpecialistId);

    for (const key of targetKeys) {
      if (key === "creators") {
        const existingData = (updated.sections.creators.data ?? {}) as CreatorsSectionData;
        if (summary.id === "creator-discovery") {
          updated = applySpecialistUpdate(updated, "scout", [
            {
              sectionKey: "creators",
              content: summary.content,
              data: { ...existingData, phase: "discovery" },
              status: "complete",
            },
          ]);
        } else if (summary.id === "creator-recommendations") {
          updated = applySpecialistUpdate(updated, "scout", [
            {
              sectionKey: "creators",
              content: summary.content,
              data: { ...existingData, phase: "complete" },
              status: "complete",
            },
          ]);
        } else {
          updated = applySpecialistUpdate(updated, "scout", [
            {
              sectionKey: "creators",
              content: summary.content,
              status: "complete",
            },
          ]);
        }
        continue;
      }

      if (key === "performance" && summary.id === "campaign-strategy") {
        const kpiData = buildKpiForecastFromStrategy(summary.content);
        updated = applySpecialistUpdate(updated, "analyst", [
          {
            sectionKey: "performance",
            content: kpiData,
            status: "complete",
          },
        ]);
        continue;
      }

      if (key === "operations" && summary.id === "budget") {
        const briefText = summary.content;
        const budgetData = campaignFacts
          ? buildBudgetSectionDataFromFacts(campaignFacts, briefText)
          : buildBudgetSectionData(summary.content, {});
        const strategyContent =
          typeof updated.sections.strategy.content === "string"
            ? updated.sections.strategy.content
            : "";
        const riskData = buildRiskAnalysisFromBudget(budgetData, strategyContent);
        updated = applySpecialistUpdate(updated, "analyst", [
          {
            sectionKey: "operations",
            content: riskData,
            status: "complete",
          },
        ]);
        continue;
      }

      if (key === "budget" && summary.id === "budget") {
        const budgetData = campaignFacts
          ? buildBudgetSectionDataFromFacts(campaignFacts, summary.content)
          : buildBudgetSectionData(summary.content, {});
        updated = applySpecialistUpdate(updated, specialistId, [
          {
            sectionKey: "budget",
            content: budgetData,
            status: "complete",
          },
        ]);
        continue;
      }

      if (key === "timeline" && summary.id === "timeline") {
        const timelineContent = campaignFacts
          ? buildTimelineSectionDataFromFacts(campaignFacts)
          : buildTimelineSectionData(summary.content);
        updated = applySpecialistUpdate(updated, specialistId, [
          {
            sectionKey: "timeline",
            content: timelineContent,
            status: "complete",
          },
        ]);
        continue;
      }

      if (key === "presentation" && summary.id === "approval") {
        updated = applySpecialistUpdate(updated, specialistId, [
          {
            sectionKey: "presentation",
            content: buildPresentationStatus(summary.content, {}, "awaiting_approval"),
            status: "complete",
          },
        ]);
        continue;
      }

      updated = applySpecialistUpdate(updated, specialistId, [
        {
          sectionKey: key,
          content: summary.content,
          status: summary.content.trim() ? "complete" : "pending",
        },
      ]);
    }
  }

  return enrichCampaignObjectWithStudioData(updated);
}

export function buildSpecialistProgress(
  completedTaskIds: string[],
  activeTaskId?: string,
  activeTaskTitle?: string
): SpecialistProgress[] {
  const completedTitles = new Set(
    completedTaskIds.map((id) => getTaskTitle(id).toLowerCase())
  );

  return (Object.keys(SPECIALIST_TASK_MAP) as CampaignSpecialistId[]).map((id) => {
    const taskIds = SPECIALIST_TASK_MAP[id];
    const titles = taskIds.map((taskKey) => getTaskTitle(taskKey));
    const allComplete = titles.every((title) => completedTitles.has(title.toLowerCase()));
    const isActive = activeTaskId != null && taskIds.includes(activeTaskId);

    let status: SpecialistProgress["status"] = "idle";
    if (allComplete) status = "complete";
    else if (isActive) status = "working";

    return {
      id,
      label: SPECIALIST_LABELS[id],
      status,
      currentTask: isActive ? activeTaskTitle : undefined,
    };
  });
}

export function syncSpecialistProgress(
  campaignObject: CampaignObject,
  input: {
    activeTaskId?: string;
    activeTaskTitle?: string;
    completedTaskIds?: string[];
    completedTasks?: string[];
  }
): CampaignObject {
  const completedFromIds = input.completedTaskIds ?? [];
  const completedFromTitles = (input.completedTasks ?? []).flatMap((title) => {
    const entry = Object.entries(TASK_SECTION_MAP).find(
      ([, sections]) => sections.length > 0
    );
    void entry;
    return [title];
  });

  const completedTaskIds = [
    ...completedFromIds,
    ...completedFromTitles
      .map((title) =>
        Object.keys(TASK_SECTION_MAP).find(
          (taskId) => getTaskTitle(taskId).toLowerCase() === title.toLowerCase()
        )
      )
      .filter(Boolean) as string[],
  ];

  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      specialistProgress: buildSpecialistProgress(
        completedTaskIds,
        input.activeTaskId,
        input.activeTaskTitle
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function resolveCampaignObjectStatus(
  workflowStatus: string,
  pauseReason?: string
): CampaignObjectStatus {
  if (workflowStatus === "completed") return "complete";
  if (workflowStatus === "paused") {
    return pauseReason === "missing_info" ? "paused" : "building";
  }
  if (workflowStatus === "running") return "building";
  return "draft";
}

export function syncCampaignObjectMeta(
  campaignObject: CampaignObject,
  meta: Partial<CampaignObjectMeta> & {
    workflowStatus?: string;
    pauseReason?: string;
  }
): CampaignObject {
  const objectStatus = meta.workflowStatus
    ? resolveCampaignObjectStatus(meta.workflowStatus, meta.pauseReason)
    : campaignObject.meta.status;

  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      ...meta,
      status: objectStatus,
    },
    updatedAt: new Date().toISOString(),
  };
}

export { formatSectionContentForDisplay, beginPendingCreatorProposal };
