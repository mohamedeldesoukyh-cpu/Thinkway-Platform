import type { WorkflowDashboard, DashboardFormatInput } from "../types/dashboard";
import type { WorkflowResponseMetadata, WorkflowTaskResult } from "../types";
import { computeProgress, getRecommendedNextAction } from "../engine/continuation";
import { getWorkflowById } from "../definitions";
import {
  aggregateWorkflowResults,
  shouldRenderWorkflowSummary,
} from "./result-aggregator";

function getBlockedTaskClarification(
  state: DashboardFormatInput["state"],
  definition: ReturnType<typeof getWorkflowById>
): string | undefined {
  const currentTask = definition?.tasks[state.currentTaskIndex];
  if (!currentTask) return undefined;

  const result = state.taskResults[currentTask.id];
  if (result?.status !== "blocked") return undefined;

  const content = result.content?.trim();
  if (!content) return undefined;

  if (result.structured?.mode === "clarification" || state.pauseReason === "missing_info") {
    return content;
  }

  return undefined;
}

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  running: "◐",
  completed: "✓",
  skipped: "—",
  blocked: "✕",
  awaiting_approval: "⏸",
  failed: "✕",
};

export function formatWorkflowDashboard(input: DashboardFormatInput): WorkflowDashboard {
  const { state, actionCards, pauseReason, pauseMessage } = input;
  const definition = getWorkflowById(state.workflowId);
  const totalTasks = definition?.tasks.length ?? Object.keys(state.taskResults).length;

  const tasks = (definition?.tasks ?? []).map((task, index) => {
    const result = state.taskResults[task.id];
    return {
      id: task.id,
      title: task.title,
      status: result?.status ?? (index < state.currentTaskIndex ? "completed" : "pending"),
      agent: task.agent,
      isCurrent: index === state.currentTaskIndex && state.status === "running",
    };
  });

  const progress = {
    current: Math.min(state.currentTaskIndex + 1, totalTasks),
    total: totalTasks,
    percent: computeProgress(state, totalTasks),
    statusLabel: getStatusLabel(state.status, pauseReason),
  };

  // A missing_info pause can also come from post-completion governance (no
  // blocked task) — its questions must still reach the chat/Studio surface.
  const clarificationQuestion =
    getBlockedTaskClarification(state, definition) ??
    (state.status === "paused" && state.pauseReason === "missing_info"
      ? state.pauseMessage
      : undefined);

  const recommendedNextAction =
    clarificationQuestion ??
    pauseMessage ??
    state.pauseMessage ??
    (definition ? getRecommendedNextAction(state, definition) : "Review workflow progress.");

  const summarySections = shouldRenderWorkflowSummary(state, totalTasks)
    ? aggregateWorkflowResults(state, definition ?? undefined)
    : [];

  const metadata: WorkflowResponseMetadata = {
    workflow: true,
    workflowId: state.workflowId,
    workflowName: state.workflowName,
    status: state.status,
    currentStep: progress.current,
    totalSteps: progress.total,
    completedTasks: tasks.filter((t) => t.status === "completed").map((t) => t.title),
    pendingTasks: tasks
      .filter((t) => t.status === "pending" || t.status === "running")
      .map((t) => t.title),
    currentTaskTitle: tasks.find((t) => t.isCurrent)?.title,
    recommendedNextAction,
    pauseReason: pauseReason ?? state.pauseReason,
    clarificationQuestion,
    summarySections,
  };

  const content = renderDashboardMarkdown(
    state,
    tasks,
    progress,
    recommendedNextAction,
    clarificationQuestion,
    summarySections,
    actionCards.some((card) => card.type === "creator_search")
  );

  return {
    title: state.workflowName,
    summary: summarySections.length
      ? `${progress.statusLabel} — ${summarySections.length} result sections`
      : `${progress.statusLabel} — Step ${progress.current}/${progress.total} (${progress.percent}%)`,
    content,
    progress,
    tasks,
    recommendedNextAction,
    actionCards,
    summarySections,
    metadata,
  };
}

function getStatusLabel(
  status: string,
  pauseReason?: string
): string {
  if (status === "paused") {
    switch (pauseReason) {
      case "approval_required":
        return "Awaiting approval";
      case "disambiguation":
        return "Needs clarification";
      case "missing_info":
        return "Missing information";
      default:
        return "Paused";
    }
  }
  switch (status) {
    case "running":
      return "In progress";
    case "completed":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function renderDashboardMarkdown(
  state: DashboardFormatInput["state"],
  tasks: Array<{ id: string; title: string; status: WorkflowTaskResult["status"]; agent?: string; isCurrent: boolean }>,
  progress: { current: number; total: number; percent: number; statusLabel: string },
  recommendedNextAction: string,
  clarificationQuestion?: string,
  summarySections: Array<{ id: string; title: string; content: string }> = [],
  hasCreatorActionCard = false
): string {
  const lines: string[] = [];

  lines.push(`## ${state.workflowName}`);
  lines.push("");

  if (summarySections.length > 0) {
    lines.push(`**Workflow Complete** · ${progress.total}/${progress.total} · ${progress.percent}%`);
  } else {
    lines.push(`**${progress.statusLabel}** · Step ${progress.current}/${progress.total} · ${progress.percent}%`);
  }
  lines.push("");

  if (clarificationQuestion) {
    lines.push("### Clarification needed");
    lines.push(clarificationQuestion);
    lines.push("");
  } else if (state.pauseMessage) {
    lines.push(`> ${state.pauseMessage}`);
    lines.push("");
  }

  if (summarySections.length > 0) {
    const isExecutiveReport = summarySections.some((s) => s.id === "executive-summary");
    lines.push(isExecutiveReport ? "### Executive Report" : "### Results");
    lines.push("");
    for (const section of summarySections) {
      lines.push(`#### ${section.title}`);
      if (hasCreatorActionCard && section.id === "top-recommendations") {
        lines.push("_See creator matches card for full searchable list._");
        lines.push("");
        lines.push(section.content);
      } else {
        lines.push(section.content);
      }
      lines.push("");
    }
  }

  lines.push("### Progress");
  const barFilled = Math.round(progress.percent / 5);
  const barEmpty = 20 - barFilled;
  lines.push(`[${"█".repeat(barFilled)}${"░".repeat(barEmpty)}] ${progress.percent}%`);
  lines.push("");

  lines.push("### Tasks");
  for (const task of tasks) {
    const icon = STATUS_ICONS[task.status] ?? "○";
    const current = task.isCurrent ? " ← current" : "";
    const agent = task.agent ? ` (${task.agent})` : "";
    lines.push(`- ${icon} ${task.title}${agent}${current}`);
  }
  lines.push("");

  lines.push("### Next action");
  lines.push(recommendedNextAction);

  if (state.disambiguationOptions?.length) {
    lines.push("");
    lines.push("### Select campaign");
    state.disambiguationOptions.forEach((opt, i) => {
      lines.push(`${i + 1}. ${opt.label}`);
    });
  }

  return lines.join("\n");
}

/** Extract dashboard content string from format result. */
export function getDashboardContent(input: DashboardFormatInput): string {
  return formatWorkflowDashboard(input).content;
}
