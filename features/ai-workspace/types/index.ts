import type {
  AiContext,
  AiIntent,
  WorkspaceType,
} from "@/features/ai";
import type { WorkflowResponseMetadata } from "@/features/ai-workflows";
import type { KnowledgeContext } from "@/features/knowledge-engine";

export type AiActionCardType =
  | "campaign"
  | "creator_search"
  | "shortlist"
  | "report"
  | "approval";

export type AiActionCardStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed";

export type AiActionCard = {
  id: string;
  type: AiActionCardType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  status: AiActionCardStatus;
};

export type AiConversationStatus = "active" | "archived";

export type AiConversationRow = {
  id: string;
  title: string;
  workspace_type: string;
  workspace_id: string | null;
  context_snapshot: Record<string, unknown>;
  status: AiConversationStatus;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AiMessageRole = "user" | "assistant" | "system" | "tool";

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  role: AiMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiWorkspaceContextSnapshot = Partial<AiContext> & {
  knowledgeContext?: KnowledgeContext;
  campaignObject?: Record<string, unknown>;
  pausedWorkflow?: {
    workflowId: WorkflowResponseMetadata["workflowId"];
    state: Record<string, unknown>;
    originalUserMessage: string;
  };
};

export type AiConversation = {
  id: string;
  title: string;
  workspaceType: WorkspaceType | string;
  workspaceId?: string;
  contextSnapshot: AiWorkspaceContextSnapshot;
  status: AiConversationStatus;
  isPinned: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  messages?: AiMessage[];
  /** Latest restored CampaignObject snapshot (Phase 0.3). */
  campaignObject?: Record<string, unknown>;
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  metadata: {
    agentId?: string;
    toolsUsed?: string[];
    actionCards?: AiActionCard[];
    streaming?: boolean;
    workflow?: boolean;
    workflowId?: string;
    workflowName?: string;
    workflowStatus?: string;
    workflowStep?: number;
    workflowTotalSteps?: number;
    completedTasks?: string[];
    pendingTasks?: string[];
    recommendedNextAction?: string;
    pauseReason?: string;
    clarificationQuestion?: string;
    [key: string]: unknown;
  };
  createdAt: string;
};

export type WorkspaceUrlParams = {
  workspace?: string;
  id?: string;
  campaignId?: string;
  clientId?: string;
  shortlistId?: string;
  brandId?: string;
  groupId?: string;
};

export type ChatRequestBody = {
  message: string;
  conversationId?: string;
  /** When set, updates this user message and truncates trailing messages instead of appending a duplicate. */
  rerunUserMessageId?: string;
  intent?: AiIntent;
  workspace?: WorkspaceUrlParams;
};

export type SuggestedAction = {
  id: string;
  label: string;
  prompt: string;
  intent?: AiIntent;
};

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
  {
    id: "create-campaign",
    label: "Create Campaign",
    prompt: "Help me create a new campaign with budget and timeline.",
    intent: "strategize",
  },
  {
    id: "find-creators",
    label: "Find Vendors",
    prompt: "Find vendors that match my campaign audience and platform requirements.",
    intent: "scout",
  },
  {
    id: "build-shortlist",
    label: "Build Shortlist",
    prompt: "Build a shortlist of top vendors from my search results.",
    intent: "scout",
  },
  {
    id: "generate-brief",
    label: "Generate Brief",
    prompt: "Generate a creative brief for my campaign.",
    intent: "strategize",
  },
  {
    id: "analyze-campaign",
    label: "Analyze Campaign",
    prompt: "Analyze this campaign's performance, risks, and optimization opportunities.",
    intent: "analyze",
  },
  {
    id: "generate-report",
    label: "Generate Report",
    prompt: "Generate a summary report for stakeholders.",
    intent: "analyze",
  },
  {
    id: "ask-anything",
    label: "Ask Anything",
    prompt: "What can you help me with in Thinkway?",
  },
];

export type ConversationListItem = Pick<
  AiConversation,
  "id" | "title" | "isPinned" | "status" | "updatedAt" | "workspaceType"
>;
