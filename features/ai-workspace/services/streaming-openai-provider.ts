import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
  LlmProviderIdentity,
  LlmStreamChunk,
} from "@/features/ai";
import { LlmProviderError } from "@/features/ai";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

export interface StreamingOpenAiProviderOptions {
  apiKey?: string;
  defaultModel?: string;
  baseUrl?: string;
}

/**
 * OpenAI provider with streaming support for the AI workspace layer.
 * Does not modify the frozen features/ai/llm/openai-provider.ts.
 */
export class StreamingOpenAiProvider implements LlmProvider {
  readonly identity: LlmProviderIdentity = {
    id: "openai-streaming",
    name: "OpenAI (Streaming)",
  };

  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(options: StreamingOpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.defaultModel = options.defaultModel ?? "gpt-4o-mini";
    this.baseUrl = options.baseUrl ?? OPENAI_CHAT_COMPLETIONS_URL;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    let content = "";
    let done = false;

    for await (const chunk of this.stream(request)) {
      content += chunk.contentDelta;
      done = chunk.done;
      if (done) break;
    }

    return {
      content: content.trim() || this.stubContent(request),
      model: request.model ?? this.defaultModel,
      providerId: this.identity.id,
      finishReason: "stop",
      stub: !this.apiKey,
    };
  }

  async *stream(
    request: LlmCompletionRequest
  ): AsyncIterable<LlmStreamChunk> {
    if (!this.apiKey) {
      const stub = this.stubContent(request);
      const words = stub.split(" ");
      for (let i = 0; i < words.length; i++) {
        yield {
          contentDelta: (i === 0 ? "" : " ") + words[i],
          done: false,
        };
      }
      yield { contentDelta: "", done: true };
      return;
    }

    const body = {
      model: request.model ?? this.defaultModel,
      stream: true,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
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

    if (!response.ok) {
      const payload = await response.text();
      throw new LlmProviderError(
        `OpenAI streaming failed with status ${response.status}.`,
        payload
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LlmProviderError("OpenAI streaming response has no body.");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          yield { contentDelta: "", done: true };
          return;
        }

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { contentDelta: delta, done: false };
          }
        } catch {
          // skip malformed SSE chunks
        }
      }
    }

    yield { contentDelta: "", done: true };
  }

  private stubContent(request: LlmCompletionRequest): string {
    const userMessage =
      [...request.messages].reverse().find((m) => m.role === "user")?.content ??
      "your request";
    return `[AI stub] No OPENAI_API_KEY configured. Prepared response for: "${userMessage}"`;
  }
}

export function createStreamingOpenAiProvider(
  options?: StreamingOpenAiProviderOptions
): StreamingOpenAiProvider {
  return new StreamingOpenAiProvider(options);
}
