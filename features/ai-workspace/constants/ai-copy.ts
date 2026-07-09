import type { AiMessage, WorkspaceUrlParams } from "../types";

/** Thinkway brand + AI accent tokens for consistent styling. */
export const AI_COLORS = {
  primary: "#1D9E75",
  accent: "#7c3aed",
  accentLight: "#6366f1",
} as const;

/** UI terminology aligned with Thinkway product reference. */
export const AI_TERMINOLOGY = {
  vendor: "Vendor",
  vendorPlural: "Vendors",
  vendorSlashInfluencer: "Vendor/Influencer",
  campaign: "Campaign",
  legalEntity: "Legal entity",
  brand: "Brand",
  shortlist: "Shortlist",
} as const;

/** Specialist display names — consistent across Campaign Studio and workflows. */
export const AI_SPECIALISTS = {
  campaignPlanner: "Campaign Planner",
  strategist: "Strategist",
  scout: "Scout",
  analyst: "Analyst",
} as const;

export const AI_WORKSPACE_COPY = {
  title: "Thinkway Intelligence",
  subtitle: `AI-powered workspace for ${AI_TERMINOLOGY.campaign.toLowerCase()}s, ${AI_TERMINOLOGY.vendorPlural.toLowerCase()}, shortlists, and insights.`,
  inputPlaceholder: `Ask about ${AI_TERMINOLOGY.campaign.toLowerCase()}s, ${AI_TERMINOLOGY.vendorPlural.toLowerCase()}, or performance…`,
  loadingConversation: "Loading conversation…",
  newChat: "New chat",
  noConversations: "No conversations yet",
} as const;

export const CAMPAIGN_STUDIO_COPY = {
  studioLabel: "Campaign Studio",
  building: "Campaign Studio is building your plan.",
  ready: "Campaign plan ready — review each section and approve the draft.",
  approvalRequired: "Campaign draft — approval required",
  inputRequired: "Input required",
  autoInferred: "Auto-inferred",
} as const;

export const WORKFLOW_STATUS_LABELS = {
  running: "In progress",
  completed: "Complete",
  paused: "Paused",
  awaitingApproval: "Awaiting approval",
  needsClarification: "Needs clarification",
  missingInfo: "Missing information",
} as const;

/** Returns true when markdown body duplicates structured workflow UI. */
export function shouldHideWorkflowMarkdown(
  metadata: Record<string, unknown> | undefined,
  workflowId?: string
): boolean {
  if (!metadata?.workflow) return false;
  if (workflowId === "create-campaign") return true;

  const summarySections = metadata.summarySections as unknown[] | undefined;
  if (Array.isArray(summarySections) && summarySections.length > 0) return true;

  const status = metadata.workflowStatus ?? metadata.status;
  if (status === "running") return true;

  return false;
}

/** Hide assistant caption above Campaign Studio when the studio already surfaces the same state. */
export function shouldHideCampaignStudioCaption(
  metadata: Record<string, unknown> | undefined,
  caption: string
): boolean {
  if (!caption.trim()) return true;

  const actionCards = metadata?.actionCards as
    | Array<{ requiresApproval?: boolean; status?: string }>
    | undefined;
  if (
    actionCards?.some(
      (card) => card.requiresApproval && (card.status === "pending" || card.status == null)
    )
  ) {
    return true;
  }

  const normalized = caption.trim().toLowerCase();
  return (
    normalized.includes("campaign draft") ||
    normalized.includes("approval required") ||
    normalized.includes("campaign plan ready") ||
    normalized.includes("campaign studio is building")
  );
}

type ChipAction = {
  id: string;
  label: string;
  prompt: string;
  intent?: string;
  contexts?: readonly string[];
  hideWhenWorkflow?: readonly string[];
};

/** Context-aware filter for suggested action chips. */
export function filterContextualActions<T extends ChipAction>(
  actions: readonly T[],
  options: {
    workspace?: WorkspaceUrlParams;
    messages?: AiMessage[];
    isStreaming?: boolean;
  }
): T[] {
  if (options.isStreaming) return [];

  const workspaceType = options.workspace?.workspace ?? "general";
  const lastAssistant = [...(options.messages ?? [])]
    .reverse()
    .find((m) => m.role === "assistant");

  const activeWorkflowId =
    lastAssistant?.metadata?.workflow === true
      ? (lastAssistant.metadata.workflowId as string | undefined)
      : undefined;

  const workflowPaused =
    lastAssistant?.metadata?.workflowStatus === "paused" ||
    lastAssistant?.metadata?.status === "paused";

  return actions.filter((action) => {
    if (action.hideWhenWorkflow?.includes(activeWorkflowId ?? "")) return false;

    if (
      action.contexts &&
      workspaceType !== "general" &&
      !action.contexts.includes(workspaceType)
    ) {
      return false;
    }

    if (activeWorkflowId === "create-campaign" && action.id === "create-campaign") return false;
    if (activeWorkflowId === "find-creators" && action.id === "find-creators") return false;
    if (activeWorkflowId === "build-shortlist" && action.id === "build-shortlist") return false;
    if (activeWorkflowId === "analyze-campaign" && action.id === "analyze-campaign") return false;

    if (workflowPaused && action.id === "create-campaign") return false;

    if (workspaceType === "campaign" && action.id === "create-campaign") return false;

    return true;
  });
}
