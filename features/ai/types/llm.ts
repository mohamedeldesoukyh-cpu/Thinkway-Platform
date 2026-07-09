export type LlmMessageRole = "system" | "user" | "assistant" | "tool";

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LlmCompletionResponse {
  content: string;
  model: string;
  providerId: string;
  finishReason?: string;
  usage?: LlmTokenUsage;
  stub?: boolean;
}

export interface LlmStreamChunk {
  contentDelta: string;
  done: boolean;
}

export interface LlmProviderIdentity {
  id: string;
  name: string;
}

export interface LlmProvider {
  readonly identity: LlmProviderIdentity;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  stream?(request: LlmCompletionRequest): AsyncIterable<LlmStreamChunk>;
}

export class LlmProviderError extends Error {
  readonly code = "LLM_ERROR" as const;

  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}
