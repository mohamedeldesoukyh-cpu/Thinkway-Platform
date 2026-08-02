import type {
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowPauseReason,
  WorkflowState,
  WorkflowTaskDefinition,
  WorkflowTaskResult,
} from "../types";
import {
  detectCurrencyFromText,
  parseBudgetAmount,
} from "@/features/campaign-intelligence/services/structured-section-builders";
import { workflowTrace } from "@/lib/creators/search-trace";
import {
  assertNoDuplicateGroundedCreators,
  dedupeGroundedCreators,
  formatIntegrityViolation,
} from "@/lib/creators/dedupe-creators";
import { normalizeCreators } from "../formatters/creator-formatter";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

function hasFactsSeededState(state: WorkflowState): boolean {
  return Boolean(state.data.campaignFacts);
}

export type ContinuationDecision = {
  shouldContinue: boolean;
  reason?: WorkflowPauseReason;
  message?: string;
};

function getClarificationMessage(result: WorkflowTaskResult): string | undefined {
  const content = result.content?.trim();
  if (!content) return undefined;

  if (result.structured?.mode === "clarification") {
    return content;
  }

  if (result.status === "blocked") {
    return content;
  }

  return undefined;
}

/** Determine if workflow should auto-continue to next task. */
export function shouldAutoContinue(
  task: WorkflowTaskDefinition,
  result: WorkflowTaskResult,
  state: WorkflowState
): ContinuationDecision {
  if (result.status === "blocked" || result.status === "awaiting_approval") {
    const clarification = getClarificationMessage(result);
    return {
      shouldContinue: false,
      reason: result.status === "awaiting_approval" ? "approval_required" : "missing_info",
      message:
        clarification ??
        result.error ??
        "Task blocked — user input required.",
    };
  }

  if (result.status === "failed") {
    if (task.readonly) {
      return { shouldContinue: true };
    }
    return {
      shouldContinue: false,
      reason: "missing_info",
      message: result.error ?? "Task failed.",
    };
  }

  if (task.requiresApproval && !task.readonly && hasApprovalToolOutput(result)) {
    return {
      shouldContinue: false,
      reason: "approval_required",
      message: "Approval required before proceeding.",
    };
  }

  if (state.status === "paused") {
    return { shouldContinue: false, reason: state.pauseReason };
  }

  return { shouldContinue: true };
}

function hasApprovalToolOutput(result: WorkflowTaskResult): boolean {
  const structured = result.structured;
  if (!structured) return false;

  const outputs = structured.toolOutputs as
    | Array<{ tool: string; output: unknown }>
    | undefined;

  if (!outputs?.length) return false;

  const mutatingTools = ["buildCampaign", "createShortlist"];
  return outputs.some(
    (o) =>
      mutatingTools.includes(o.tool) &&
      o.output &&
      typeof o.output === "object"
  );
}

/** Check if task prerequisites are met. */
export function canRunTask(
  task: WorkflowTaskDefinition,
  ctx: WorkflowExecutionContext
): { canRun: boolean; reason?: string } {
  if (task.shouldSkip?.(ctx)) {
    return { canRun: false, reason: "skip" };
  }

  if (task.requiredState?.length) {
    for (const key of task.requiredState) {
      if (ctx.state.data[key] === undefined && ctx.resolvedCampaignId === undefined) {
        return {
          canRun: false,
          reason: `Missing required state: ${key}`,
        };
      }
    }
  }

  return { canRun: true };
}

/** Get next task index, skipping tasks that should be skipped. */
export function getNextTaskIndex(
  definition: WorkflowDefinition,
  currentIndex: number,
  ctx: WorkflowExecutionContext
): number {
  let next = currentIndex + 1;
  while (next < definition.tasks.length) {
    const task = definition.tasks[next];
    const check = canRunTask(task, ctx);
    if (check.canRun || check.reason !== "skip") {
      return next;
    }
    next += 1;
  }
  return next;
}

/** Compute workflow progress percentage. */
export function computeProgress(state: WorkflowState, totalTasks: number): number {
  const completed = Object.values(state.taskResults).filter(
    (r) => r.status === "completed" || r.status === "skipped"
  ).length;
  return totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
}

/** Determine recommended next action for dashboard. */
export function getRecommendedNextAction(
  state: WorkflowState,
  definition: WorkflowDefinition
): string {
  if (state.status === "completed") {
    return "Review results above.";
  }

  if (state.pauseReason === "approval_required") {
    return "Review and approve the action card below to proceed.";
  }

  if (state.pauseReason === "disambiguation") {
    return "Select the correct campaign from the options above.";
  }

  if (state.pauseReason === "missing_info") {
    return state.pauseMessage ?? "Reply with the missing detail to continue.";
  }

  const currentTask = definition.tasks[state.currentTaskIndex];
  if (currentTask) {
    return `Executing: ${currentTask.title}`;
  }

  return "Processing workflow…";
}

const CREATOR_SEARCH_TASK_IDS = new Set(["search-creators", "identify-creators"]);
const CREATOR_RANK_TASK_IDS = new Set([
  "rank-results",
  "curate-selection",
  "build-shortlist",
]);

function storeDedupedSearchResults(
  state: WorkflowState,
  creators: unknown,
  total?: number
): void {
  const normalized = normalizeCreators(creators, "workflowSearchResults");
  const violation = assertNoDuplicateGroundedCreators(normalized, "workflowSearchResults");
  if (violation) {
    console.error("[creator-integrity]", formatIntegrityViolation(violation));
  }
  const { creators: deduped } = dedupeGroundedCreators(normalized, "workflowSearchResults");
  state.data.searchResults = deduped;
  if (typeof total === "number") {
    state.data.searchTotal = total;
  } else if (deduped.length > 0) {
    state.data.searchTotal = deduped.length;
  }
}

function applyGroundedCreatorSearchToState(
  state: WorkflowState,
  structured: Record<string, unknown>,
  options?: { forceReplace?: boolean }
): void {
  const creators = structured.creators;
  if (!Array.isArray(creators)) return;

  const existing = state.data.searchResults;
  const hasExisting = Array.isArray(existing) && existing.length > 0;

  if (hasExisting && !options?.forceReplace) return;

  storeDedupedSearchResults(
    state,
    creators,
    typeof structured.total === "number" ? structured.total : undefined
  );
}

function isAuthoritativeCreatorSearchTask(taskId: string): boolean {
  return CREATOR_SEARCH_TASK_IDS.has(taskId);
}

/** Extract useful data from task result into workflow state. */
export function mergeTaskResultIntoState(
  state: WorkflowState,
  task: WorkflowTaskDefinition,
  result: WorkflowTaskResult
): void {
  const beforeShape = workflowTrace(
    "6_mergeTaskResultIntoState_before",
    { data: state.data, structured: result.structured },
    "mergeBefore",
    { taskId: task.id }
  );

  state.taskResults[task.id] = result;

  const structured = result.structured;
  if (!structured) return;

  const outputs = structured.toolOutputs as
    | Array<{ tool: string; output: unknown }>
    | undefined;

  const authoritativeSearch = isAuthoritativeCreatorSearchTask(task.id);

  if (outputs?.length) {
    for (const entry of outputs) {
      if (entry.tool === "searchCreators" && entry.output) {
        const search = entry.output as {
          creators?: unknown[];
          total?: number;
          constraintReport?: unknown;
        };
        if (state.data.searchExecuted === true && !authoritativeSearch) {
          console.warn("[creator-integrity] Ignoring duplicate searchCreators tool output — search already executed");
          continue;
        }
        if (state.data.searchExecuted === true && authoritativeSearch) {
          console.warn(
            "[creator-integrity] Replacing prior searchResults with search-creators task output"
          );
        }
        storeDedupedSearchResults(state, search.creators, search.total);
        if (search.constraintReport) {
          state.data.constraintReport = search.constraintReport;
        }
        state.data.searchExecuted = true;
      }
      if (entry.tool === "getCampaign" && entry.output) {
        const campaign = entry.output as { id?: string; name?: string };
        if (campaign.id) {
          state.data.campaignId = campaign.id;
          state.data.campaignName = campaign.name;
        }
      }
      if (entry.tool === "buildCampaign" && entry.output) {
        state.data.campaignDraft = entry.output;
      }
      if (entry.tool === "generateBrief" && entry.output) {
        state.data.brief = entry.output;
      }
      if (entry.tool === "generateReport" && entry.output) {
        state.data.report = entry.output;
      }
    }
  }

  // Sprint 6.8 grounded scout: creators live on structured.creators; toolOutputs may be empty.
  if (
    structured.mode === "creator_search" ||
    CREATOR_SEARCH_TASK_IDS.has(task.id)
  ) {
    const canMergeStructured =
      authoritativeSearch || state.data.searchExecuted !== true;
    if (canMergeStructured) {
      applyGroundedCreatorSearchToState(state, structured, {
        forceReplace: authoritativeSearch,
      });
      if (Array.isArray(state.data.searchResults) && state.data.searchResults.length > 0) {
        state.data.searchExecuted = true;
      }
    }
  }

  if (CREATOR_RANK_TASK_IDS.has(task.id) && Array.isArray(structured.creators)) {
    const ranked = normalizeCreators(structured.creators, "rankingOutput");
    state.data.rankedCreators = ranked;
  }

  if (task.id === "analyze-request") {
    const facts = state.data.campaignFacts as CampaignFacts | undefined;
    if (!hasFactsSeededState(state)) {
      const brandMatch = result.content?.match(/brand[:\s]+["']?(\w[\w\s-]*?)["']?(?:\s|$|[.,])/i);
      if (brandMatch?.[1]) {
        state.data.brandName = brandMatch[1].trim();
      }
      state.data.currency = detectCurrencyFromText(
        result.content,
        typeof state.data.userMessage === "string" ? state.data.userMessage : undefined
      );
    } else if (!state.data.brandName && facts?.brandName) {
      state.data.brandName = facts.brandName;
    }
  }

  if (task.id === "estimate-budget" && result.content?.trim() && !hasFactsSeededState(state)) {
    const content = result.content;
    state.data.currency = detectCurrencyFromText(
      content,
      typeof state.data.currency === "string" ? state.data.currency : undefined,
      typeof state.data.userMessage === "string" ? state.data.userMessage : undefined
    );
    const total = parseBudgetAmount(content);
    if (total != null) state.data.budgetTotal = total;
  }

  const afterShape = workflowTrace(
    "6_mergeTaskResultIntoState_after",
    { data: state.data },
    "mergeAfter",
    { taskId: task.id }
  );

  if (
    typeof beforeShape.creatorsLen === "number" &&
    beforeShape.creatorsLen > 0 &&
    (afterShape.creatorsLen ?? 0) === 0
  ) {
    console.warn("[workflow-trace] COUNT_DROP @ mergeTaskResultIntoState", {
      taskId: task.id,
      before: beforeShape,
      after: afterShape,
    });
  }
}
