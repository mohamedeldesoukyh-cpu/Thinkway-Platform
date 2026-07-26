import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
  LlmProviderIdentity,
  LlmStreamChunk,
  LlmToolCall,
} from "../types/llm";
import { LlmProviderError } from "../types/llm";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

export interface OpenAiProviderOptions {
  apiKey?: string;
  defaultModel?: string;
  baseUrl?: string;
}

interface OpenAiChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export class OpenAiProvider implements LlmProvider {
  readonly identity: LlmProviderIdentity = {
    id: "openai",
    name: "OpenAI",
  };

  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.defaultModel = options.defaultModel ?? "gpt-4o-mini";
    this.baseUrl = options.baseUrl ?? OPENAI_CHAT_COMPLETIONS_URL;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!this.apiKey) {
      return this.createStubResponse(request);
    }

    const body = {
      model: request.model ?? this.defaultModel,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.name ? { name: message.name } : {}),
        ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
      })),
      ...(request.tools && request.tools.length > 0
        ? {
            tools: request.tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
          }
        : {}),
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...(request.maxTokens !== undefined
        ? { max_tokens: request.maxTokens }
        : {}),
    };

    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new LlmProviderError("Failed to reach OpenAI API.", error);
    }

    let payload: OpenAiChatCompletionResponse;
    try {
      payload = (await response.json()) as OpenAiChatCompletionResponse;
    } catch (error) {
      throw new LlmProviderError("OpenAI API returned invalid JSON.", error);
    }

    if (!response.ok) {
      if (response.status === 429 || payload.error?.code === "rate_limit_exceeded") {
        console.warn(
          JSON.stringify({
            event: "llm_rate_limit_exceeded",
            provider: "openai",
            model: request.model ?? this.defaultModel,
            tokens: null,
            status: response.status,
            code: payload.error?.code ?? "rate_limit_exceeded",
            type: payload.error?.type ?? null,
            message: payload.error?.message ?? null,
            requestId: response.headers.get("x-request-id"),
            retryAfter: response.headers.get("retry-after"),
            rateLimitHeaders: {
              "Retry-After": response.headers.get("retry-after"),
              "x-ratelimit-limit-requests": response.headers.get(
                "x-ratelimit-limit-requests"
              ),
              "x-ratelimit-remaining-requests": response.headers.get(
                "x-ratelimit-remaining-requests"
              ),
              "x-ratelimit-limit-tokens": response.headers.get(
                "x-ratelimit-limit-tokens"
              ),
              "x-ratelimit-remaining-tokens": response.headers.get(
                "x-ratelimit-remaining-tokens"
              ),
            },
            durationMs: null,
            retryCount: 0,
          })
        );
      }
      throw new LlmProviderError(
        payload.error?.message ??
          `OpenAI API request failed with status ${response.status}.`,
        payload.error ?? payload
      );
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim();

    const toolCalls: LlmToolCall[] = (choice?.message?.tool_calls ?? [])
      .filter((call) => call.function?.name)
      .map((call, index) => ({
        id: call.id ?? `call_${index}`,
        name: call.function!.name!,
        arguments: call.function?.arguments ?? "{}",
      }));

    // A tool-calling turn legitimately has empty content — only error when the
    // model returned neither text nor a tool call.
    if (!content && toolCalls.length === 0) {
      throw new LlmProviderError("OpenAI API returned an empty completion.");
    }

    return {
      content: content ?? "",
      model: payload.model ?? request.model ?? this.defaultModel,
      providerId: this.identity.id,
      finishReason: choice?.finish_reason ?? undefined,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(
    request: LlmCompletionRequest
  ): AsyncIterable<LlmStreamChunk> {
    if (!this.apiKey) {
      const stub = this.createStubResponse(request);
      yield { contentDelta: stub.content, done: false };
      yield { contentDelta: "", done: true };
      return;
    }

    throw new LlmProviderError(
      "OpenAI streaming is not implemented yet. Use complete() instead."
    );
  }

  private createStubResponse(
    request: LlmCompletionRequest
  ): LlmCompletionResponse {
    const userMessage =
      [...request.messages].reverse().find((message) => message.role === "user")
        ?.content ?? "your request";

    return {
      content: `[OpenAI stub] No OPENAI_API_KEY configured. Prepared response for: "${userMessage}"`,
      model: request.model ?? this.defaultModel,
      providerId: this.identity.id,
      finishReason: "stop",
      stub: true,
    };
  }
}

export function createOpenAiProvider(
  options?: OpenAiProviderOptions
): OpenAiProvider {
  return new OpenAiProvider(options);
}
