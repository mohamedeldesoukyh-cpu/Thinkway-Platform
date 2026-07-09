import type { AiContext } from "./context";

export type AiIntent =
  | "plan"
  | "strategize"
  | "scout"
  | "analyze"
  | "general";

export interface AiRequest {
  id: string;
  message: string;
  intent?: AiIntent;
  conversationId?: string;
  context?: Partial<AiContext>;
  metadata?: Record<string, unknown>;
}

export interface AiResponseMetadata {
  agentId: string;
  promptId?: string;
  toolsUsed?: string[];
  latencyMs?: number;
  model?: string;
}

export interface AiResponse {
  id: string;
  requestId: string;
  conversationId: string;
  content: string;
  structured?: Record<string, unknown>;
  metadata: AiResponseMetadata;
}

export type AiErrorCode =
  | "NO_AGENT"
  | "INVALID_REQUEST"
  | "TOOL_EXECUTION_FAILED"
  | "PROMPT_NOT_FOUND"
  | "MEMORY_ERROR"
  | "LLM_ERROR"
  | "EXECUTION_FAILED";

export interface AiError {
  code: AiErrorCode;
  message: string;
  details?: unknown;
}
