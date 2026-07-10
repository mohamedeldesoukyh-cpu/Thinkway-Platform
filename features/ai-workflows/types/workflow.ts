import type { AiContext, AiIntent, AiRequest } from "@/features/ai";
import type { RoutableAgentId } from "@/features/ai/routing/types";

import type { AiActionCard } from "@/features/ai-workspace/types";

export type WorkflowId =
  | "create-campaign"
  | "find-creators"
  | "analyze-campaign"
  | "generate-brief"
  | "build-shortlist"
  | "campaign-health-check";

export type WorkflowStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type WorkflowPauseReason =
  | "missing_info"
  | "approval_required"
  | "disambiguation";

export type WorkflowTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "blocked"
  | "awaiting_approval"
  | "failed";

export interface WorkflowTaskDefinition {
  id: string;
  title: string;
  description: string;
  agent: RoutableAgentId;
  intent: AiIntent;
  tools: string[];
  /** Read-only tasks auto-execute without user prompts. */
  readonly: boolean;
  /** Mutating tasks pause for approval before execution. */
  requiresApproval?: boolean;
  approvalTool?: string;
  /** Prompt sent to orchestrator for this task. */
  buildPrompt: (ctx: WorkflowExecutionContext) => string;
  /** Auto-continue when conditions met. */
  shouldSkip?: (ctx: WorkflowExecutionContext) => boolean;
  /** Required state keys before task can run. */
  requiredState?: string[];
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  description: string;
  /** Regex patterns to match user goals (case-insensitive). */
  triggerPatterns: RegExp[];
  /** Minimum confidence score (0-100) to activate workflow. */
  minConfidence: number;
  tasks: WorkflowTaskDefinition[];
}

export interface WorkflowTaskResult {
  taskId: string;
  status: WorkflowTaskStatus;
  agentId?: string;
  content?: string;
  structured?: Record<string, unknown>;
  toolsUsed?: string[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowState {
  workflowId: WorkflowId;
  workflowName: string;
  currentTaskIndex: number;
  taskResults: Record<string, WorkflowTaskResult>;
  /** Accumulated workflow context (campaignId, creators, etc.). */
  data: Record<string, unknown>;
  status: WorkflowStatus;
  pauseReason?: WorkflowPauseReason;
  pauseMessage?: string;
  disambiguationOptions?: Array<{ id: string; label: string; meta?: Record<string, unknown> }>;
}

export interface WorkflowExecutionContext {
  request: AiRequest;
  aiContext: AiContext;
  state: WorkflowState;
  definition: WorkflowDefinition;
  resolvedCampaignId?: string;
  resolvedCampaignName?: string;
  userMessage: string;
}

export interface WorkflowMatchResult {
  matched: boolean;
  workflow?: WorkflowDefinition;
  confidence: number;
  reason: string;
}

export interface WorkflowExecutionResult {
  success: boolean;
  state: WorkflowState;
  dashboardContent: string;
  actionCards: AiActionCard[];
  metadata: WorkflowResponseMetadata;
  error?: string;
}

export interface WorkflowSummarySection {
  id: string;
  title: string;
  content: string;
  taskId: string;
  agentId?: string;
}

export interface WorkflowResponseMetadata {
  workflow: true;
  workflowId: WorkflowId;
  workflowName: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  completedTasks: string[];
  pendingTasks: string[];
  currentTaskTitle?: string;
  recommendedNextAction?: string;
  pauseReason?: WorkflowPauseReason;
  clarificationQuestion?: string;
  /** Aggregated task outputs shown after workflow execution finishes. */
  summarySections?: WorkflowSummarySection[];
  /** Fields auto-inferred by Campaign Director (knowledge engine). */
  inferredFields?: string[];
  /** Canonical campaign state for create-campaign workflow (Sprint 8). */
  campaignObject?: Record<string, unknown>;
  /** Set when the campaign_objects DB write failed and the object survives via message metadata only. */
  campaignObjectDbPersistError?: string;
}

export interface WorkflowProgressEvent {
  workflowId: WorkflowId;
  step: number;
  totalSteps: number;
  taskId: string;
  taskTitle: string;
  status: WorkflowTaskStatus;
  progress: number;
}
