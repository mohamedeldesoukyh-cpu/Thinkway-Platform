import type { AiContext } from "./context";
import type { LlmProvider } from "./llm";
import type { AiRequest, AiResponse } from "./request-response";
import type { ToolExecutionResult } from "./tools";

export type AgentCapability =
  | "planning"
  | "strategy"
  | "discovery"
  | "analysis"
  | "general";

export interface AgentExecuteInput {
  request: AiRequest;
  context: AiContext;
  prompt: string;
  toolNames: string[];
  llmProvider?: LlmProvider;
}

export interface AgentExecuteResult {
  rawContent: string;
  structured?: Record<string, unknown>;
  toolResults: ToolExecutionResult[];
  model?: string;
  providerId?: string;
  llmStub?: boolean;
}

export interface AiAgent {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly AgentCapability[];
  /** Tie-break / execution ordering hint; routing is centralized in AgentRouter. */
  readonly priority: number;

  /** @deprecated Routing uses AgentRouter — kept for backward compatibility. */
  canHandle(request: AiRequest, context: AiContext): boolean | Promise<boolean>;
  buildContext(
    request: AiRequest,
    baseContext: AiContext
  ): AiContext | Promise<AiContext>;
  buildPrompt(request: AiRequest, context: AiContext): string | Promise<string>;
  selectTools(
    request: AiRequest,
    context: AiContext
  ): string[] | Promise<string[]>;
  execute(input: AgentExecuteInput): Promise<AgentExecuteResult>;
  formatResponse(
    result: AgentExecuteResult,
    request: AiRequest,
    context: AiContext
  ): AiResponse | Promise<AiResponse>;
}
