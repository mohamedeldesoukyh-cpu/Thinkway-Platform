import { createAgentRegistry, type AgentRegistry } from "../agents";
import { analystAgent } from "../analyst";
import { generalAgent } from "../general";
import type { LlmProvider } from "../llm";
import { MemoryStore, createMemoryStore } from "../memory";
import { plannerAgent } from "../planner";
import { getDefaultPromptLibrary } from "../prompts";
import { createAgentRouter, type AgentRouter } from "../routing";
import { scoutAgent } from "../scout";
import {
  ContextBuilder,
  ConversationManager,
  createContextBuilder,
  createConversationManager,
  type ContextBuilderInput,
} from "../shared";
import { strategistAgent } from "../strategist";
import { getDefaultToolRegistry, type ToolRegistry } from "../tools";
import type { AiError, AiRequest, AiResponse } from "../types";
import { LlmProviderError } from "../types";

export interface AiOrchestratorOptions {
  agentRegistry?: AgentRegistry;
  agentRouter?: AgentRouter;
  toolRegistry?: ToolRegistry;
  contextBuilder?: ContextBuilder;
  conversationManager?: ConversationManager;
  memoryStore?: MemoryStore;
  llmProvider?: LlmProvider;
}

export interface AiOrchestratorResult {
  success: true;
  response: AiResponse;
}

export interface AiOrchestratorFailure {
  success: false;
  error: AiError;
}

export type AiOrchestratorOutput = AiOrchestratorResult | AiOrchestratorFailure;

function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class AiOrchestrator {
  private readonly agentRegistry: AgentRegistry;
  private readonly agentRouter: AgentRouter;
  private readonly toolRegistry: ToolRegistry;
  private readonly contextBuilder: ContextBuilder;
  private readonly conversationManager: ConversationManager;
  private readonly memoryStore: MemoryStore;
  private readonly llmProvider?: LlmProvider;

  constructor(options: AiOrchestratorOptions = {}) {
    this.agentRegistry =
      options.agentRegistry ??
      createAgentRegistry([
        generalAgent,
        plannerAgent,
        strategistAgent,
        scoutAgent,
        analystAgent,
      ]);
    this.agentRouter =
      options.agentRouter ?? createAgentRouter(this.agentRegistry);
    this.toolRegistry = options.toolRegistry ?? getDefaultToolRegistry();
    this.contextBuilder = options.contextBuilder ?? createContextBuilder();
    this.conversationManager =
      options.conversationManager ?? createConversationManager();
    this.memoryStore = options.memoryStore ?? createMemoryStore();
    this.llmProvider = options.llmProvider;

    // Ensure default prompt library is initialized
    getDefaultPromptLibrary();
  }

  /**
   * Central entry point for all AI requests.
   * Flow: conversation → context → agent → tools → prompt → execute → format → memory
   */
  async handle(
    request: AiRequest,
    builderInput: Omit<ContextBuilderInput, "request"> = {}
  ): Promise<AiOrchestratorOutput> {
    const startedAt = Date.now();

    if (!request.message.trim()) {
      return {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Request message is required.",
        },
      };
    }

    const normalizedRequest: AiRequest = {
      ...request,
      id: request.id || createRequestId(),
    };

    try {
      const conversation = this.conversationManager.getOrCreateConversation(
        normalizedRequest.conversationId
      );

      this.conversationManager.appendMessage(conversation.id, {
        role: "user",
        content: normalizedRequest.message,
      });

      const baseContext = await this.contextBuilder.build({
        request: normalizedRequest,
        ...builderInput,
      });

      const contextWithConversation = this.conversationManager.attachToContext(
        conversation,
        baseContext
      );

      const routerResult = await this.agentRouter.execute({
        request: normalizedRequest,
        context: contextWithConversation,
        llmProvider: this.llmProvider,
      });

      const response = routerResult.combinedResponse;
      const agentIds = routerResult.decision.selectedAgentIds;

      response.metadata.latencyMs = Date.now() - startedAt;
      response.conversationId = conversation.id;

      this.conversationManager.appendMessage(conversation.id, {
        role: "assistant",
        content: response.content,
        metadata: {
          agentId: response.metadata.agentId,
          agentIds,
          toolsUsed: response.metadata.toolsUsed,
          routing: routerResult.decision.reason,
        },
      });

      this.memoryStore.save({
        conversation: this.conversationManager.getConversation(conversation.id)!,
        contextSnapshot: contextWithConversation,
        metadata: {
          lastAgentId: agentIds[agentIds.length - 1] ?? "general",
          lastAgentIds: agentIds,
          lastRequestId: normalizedRequest.id,
          routingReason: routerResult.decision.reason,
        },
      });

      return { success: true, response };
    } catch (error) {
      if (error instanceof LlmProviderError) {
        return {
          success: false,
          error: {
            code: "LLM_ERROR",
            message: error.message,
            details: error.details,
          },
        };
      }

      const message =
        error instanceof Error ? error.message : "Unknown orchestrator error";
      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message,
          details: error,
        },
      };
    }
  }

  getAgentRouter(): AgentRouter {
    return this.agentRouter;
  }

  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getMemoryStore(): MemoryStore {
    return this.memoryStore;
  }
}

export function createAiOrchestrator(
  options?: AiOrchestratorOptions
): AiOrchestrator {
  return new AiOrchestrator(options);
}

/** Singleton for server-side usage; inject dependencies in tests. */
let defaultOrchestrator: AiOrchestrator | undefined;

export function getDefaultAiOrchestrator(): AiOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = createAiOrchestrator();
  }
  return defaultOrchestrator;
}

export function resetDefaultAiOrchestrator(): void {
  defaultOrchestrator = undefined;
}
