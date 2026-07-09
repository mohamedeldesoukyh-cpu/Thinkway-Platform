import {
  formatRankedResults,
  formatSearchResults,
  formatShortlistSuggestionMarkdown,
  normalizeCreators,
  rankCreators,
  stripConversationalFiller,
} from "../formatters/creator-formatter";
import {
  buildFindCreatorsReportInput,
  generateFindCreatorsExecutiveReport,
  type ExecutiveReportSection,
} from "../formatters/executive-report-generator";
import type { WorkflowDefinition, WorkflowState, WorkflowTaskResult } from "../types";
import { formatToolOutput } from "./tool-output-formatter";

export interface WorkflowSummarySection {
  id: string;
  title: string;
  content: string;
  taskId: string;
  agentId?: string;
}

const CREATE_CAMPAIGN_SECTIONS: Array<{
  sectionId: string;
  title: string;
  taskIds: string[];
}> = [
  { sectionId: "campaign-strategy", title: "Campaign Strategy", taskIds: ["build-strategy"] },
  { sectionId: "budget", title: "Budget", taskIds: ["estimate-budget"] },
  { sectionId: "timeline", title: "Timeline", taskIds: ["generate-timeline"] },
  {
    sectionId: "creator-discovery",
    title: "Vendor Discovery",
    taskIds: ["search-creators"],
  },
  {
    sectionId: "creator-recommendations",
    title: "Vendor Recommendations",
    taskIds: ["build-shortlist"],
  },
  { sectionId: "campaign-brief", title: "Campaign Brief", taskIds: ["analyze-request", "generate-brief"] },
  { sectionId: "approval", title: "Approval", taskIds: ["prepare-approval"] },
];

const CREATOR_TASK_IDS = new Set([
  "search-creators",
  "rank-results",
  "shortlist-option",
  "identify-creators",
  "curate-selection",
  "build-shortlist",
]);

function hasDisplayableContent(result: WorkflowTaskResult): boolean {
  if (result.content?.trim()) return true;
  if (result.structured && extractStructuredText(result.structured, result.taskId)) return true;
  return false;
}

function getCreatorsFromStructured(
  structured: Record<string, unknown>
): ReturnType<typeof normalizeCreators> {
  const outputs = structured.toolOutputs as
    | Array<{ tool: string; output: unknown }>
    | undefined;

  if (outputs?.length) {
    for (const entry of outputs) {
      if (entry.tool === "searchCreators" && entry.output) {
        const search = entry.output as { creators?: unknown[] };
        const normalized = normalizeCreators(search.creators);
        if (normalized.length) return normalized;
      }
    }
  }

  if (Array.isArray(structured.creators)) {
    return normalizeCreators(structured.creators);
  }

  const shortlist = structured.shortlist as { creators?: unknown[] } | undefined;
  if (shortlist?.creators) {
    return normalizeCreators(shortlist.creators);
  }

  return [];
}

function extractStructuredText(
  structured: Record<string, unknown>,
  taskId: string
): string {
  const mode = structured.mode as string | undefined;

  if (mode === "ranked_creators" && Array.isArray(structured.creators)) {
    const creators = normalizeCreators(structured.creators);
    const query =
      typeof structured.searchQuery === "string" ? structured.searchQuery : undefined;
    return formatRankedResults(
      creators.map((c, i) => ({
        ...c,
        fitScore: (structured.creators as Array<{ fitScore?: number }>)[i]?.fitScore ?? 0,
        rank: i + 1,
      })),
      query
    );
  }

  if (mode === "shortlist_suggestion" || mode === "shortlist_draft") {
    const shortlist = structured.shortlist as Parameters<
      typeof formatShortlistSuggestionMarkdown
    >[0];
    if (shortlist?.creators) {
      return formatShortlistSuggestionMarkdown(shortlist);
    }
  }

  const outputs = structured.toolOutputs as
    | Array<{ tool: string; output: unknown }>
    | undefined;

  if (!outputs?.length) return "";

  const parts: string[] = [];
  for (const entry of outputs) {
    const formatted = formatToolOutput(entry.tool, entry.output);
    if (formatted) parts.push(formatted);
  }
  return parts.join("\n\n").trim();
}

function preferGroundedTaskContent(result: WorkflowTaskResult): string {
  if (result.structured) {
    const fromStructured = extractStructuredText(result.structured, result.taskId);
    if (fromStructured) return fromStructured;
  }

  if (CREATOR_TASK_IDS.has(result.taskId) && result.content?.trim()) {
    return stripConversationalFiller(result.content.trim());
  }

  return result.content?.trim() ? stripConversationalFiller(result.content.trim()) : "";
}

function extractTaskContent(
  result: WorkflowTaskResult,
  stateData: Record<string, unknown>
): string {
  const grounded = preferGroundedTaskContent(result);
  if (grounded) return grounded;

  if (result.structured) {
    const fromStructured = extractStructuredText(result.structured, result.taskId);
    if (fromStructured) return fromStructured;
  }

  if (result.taskId === "generate-brief" && stateData.brief) {
    return formatToolOutput("generateBrief", stateData.brief);
  }
  if (result.taskId === "prepare-approval" && stateData.campaignDraft) {
    return formatToolOutput("buildCampaign", stateData.campaignDraft);
  }

  return "";
}

function mergeSectionContent(existing: string, addition: string): string {
  const trimmed = addition.trim();
  if (!trimmed) return existing;
  if (!existing.trim()) return trimmed;
  if (existing.includes(trimmed)) return existing;
  return `${existing.trim()}\n\n${trimmed}`;
}

function executiveSectionToSummary(
  section: ExecutiveReportSection,
  taskId: string,
  agentId?: string
): WorkflowSummarySection {
  return {
    id: section.id,
    title: section.title,
    content: section.content,
    taskId,
    agentId,
  };
}

function aggregateFindCreatorsResults(state: WorkflowState): WorkflowSummarySection[] {
  const userMessage =
    typeof state.data.userMessage === "string" ? state.data.userMessage : "";
  const reportInput = buildFindCreatorsReportInput(state, userMessage);
  const executiveSections = generateFindCreatorsExecutiveReport(reportInput);

  const rankResult = state.taskResults["rank-results"];
  const searchResult = state.taskResults["search-creators"];
  const primaryTaskId =
    rankResult?.status === "completed" ? "rank-results" : "search-creators";
  const agentId = rankResult?.agentId ?? searchResult?.agentId;

  return executiveSections.map((section) =>
    executiveSectionToSummary(section, primaryTaskId, agentId)
  );
}

function aggregateCreateCampaignResults(state: WorkflowState): WorkflowSummarySection[] {
  const sections: WorkflowSummarySection[] = [];

  for (const mapping of CREATE_CAMPAIGN_SECTIONS) {
    let content = "";
    let agentId: string | undefined;

    for (const taskId of mapping.taskIds) {
      const result = state.taskResults[taskId];
      if (!result || result.status === "skipped" || result.status === "failed") continue;
      if (result.status !== "completed" && result.status !== "awaiting_approval") continue;

      const taskContent = extractTaskContent(result, state.data);
      if (taskContent) {
        content = taskContent;
        agentId = result.agentId ?? agentId;
        break;
      }
    }

    if (content.trim()) {
      sections.push({
        id: mapping.sectionId,
        title: mapping.title,
        content: content.trim(),
        taskId: mapping.taskIds[0],
        agentId,
      });
    }
  }

  return sections;
}

function aggregateGenericResults(
  state: WorkflowState,
  definition?: WorkflowDefinition
): WorkflowSummarySection[] {
  const tasks = definition?.tasks ?? [];
  const sections: WorkflowSummarySection[] = [];
  const seenCreatorContent = new Set<string>();

  for (const task of tasks) {
    const result = state.taskResults[task.id];
    if (!result || result.status === "skipped" || result.status === "failed") continue;
    if (result.status !== "completed" && result.status !== "awaiting_approval") continue;

    const content = extractTaskContent(result, state.data);
    if (!content.trim()) continue;

    if (CREATOR_TASK_IDS.has(task.id)) {
      const fingerprint = content.slice(0, 120);
      if (seenCreatorContent.has(fingerprint)) continue;
      seenCreatorContent.add(fingerprint);
    }

    sections.push({
      id: task.id,
      title: task.title,
      content: content.trim(),
      taskId: task.id,
      agentId: result.agentId,
    });
  }

  return sections;
}

/** Whether the workflow has finished executing and should show aggregated results. */
export function shouldRenderWorkflowSummary(state: WorkflowState, totalTasks: number): boolean {
  if (state.status === "running") return false;

  const terminalCount = Object.values(state.taskResults).filter(
    (r) =>
      r.status === "completed" ||
      r.status === "skipped" ||
      r.status === "awaiting_approval" ||
      r.status === "blocked"
  ).length;

  if (state.status === "completed") return true;
  if (terminalCount >= totalTasks) return true;

  return Object.values(state.taskResults).some(
    (r) =>
      (r.status === "completed" || r.status === "awaiting_approval") &&
      hasDisplayableContent(r)
  );
}

/** Aggregate completed task outputs into display sections. */
export function aggregateWorkflowResults(
  state: WorkflowState,
  definition?: WorkflowDefinition
): WorkflowSummarySection[] {
  console.log("[workflow-lifecycle] Result aggregation started");
  let sections: WorkflowSummarySection[];
  try {
    if (state.workflowId === "create-campaign") {
      sections = aggregateCreateCampaignResults(state);
    } else if (state.workflowId === "find-creators") {
      sections = aggregateFindCreatorsResults(state);
    } else {
      sections = aggregateGenericResults(state, definition);
    }
    console.log("[workflow-lifecycle] Result aggregation completed");
  } catch (error) {
    if (error instanceof RangeError) {
      console.error(
        "[workflow-lifecycle] Result aggregation RangeError stack:",
        error.stack
      );
    }
    throw error;
  }
  return sections;
}

export { getCreatorsFromStructured, normalizeCreators };
