import type { AgentRegistry } from "../agents";
import type {
  AgentExecuteInput,
  AgentExecuteResult,
  AiAgent,
  AiContext,
  AiRequest,
  AiResponse,
  LlmProvider,
} from "../types";

import { createIntentEngine, IntentEngine } from "./intent-engine";
import type {
  AgentExecutionPlan,
  AgentRouterOptions,
  RoutingDecision,
  RoutableAgentId,
} from "./types";

export interface AgentRouterExecuteInput {
  request: AiRequest;
  context: AiContext;
  llmProvider?: LlmProvider;
}

export interface AgentRouterExecuteResult {
  decision: RoutingDecision;
  responses: AiResponse[];
  combinedResponse: AiResponse;
  executeResults: AgentExecuteResult[];
}

function createResponseId(): string {
  return `resp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Central agent router: analyze → score → select → execute.
 * General Assistant is always available as fallback.
 */
export class AgentRouter {
  private readonly registry: AgentRegistry;
  private readonly intentEngine: IntentEngine;

  constructor(registry: AgentRegistry, options: AgentRouterOptions = {}) {
    this.registry = registry;
    this.intentEngine = createIntentEngine(options);
  }

  route(request: AiRequest, context: AiContext): RoutingDecision {
    return this.intentEngine.analyze(request, context).decision;
  }

  plan(request: AiRequest, context: AiContext): AgentExecutionPlan {
    const decision = this.route(request, context);
    return {
      decision,
      agentIds: decision.selectedAgentIds,
    };
  }

  resolveAgent(agentId: RoutableAgentId): AiAgent {
    const agent = this.registry.get(agentId);
    if (agent) {
      return agent;
    }

    const fallback = this.registry.get("general");
    if (fallback) {
      return fallback;
    }

    throw new Error(`No routable agent registered for id "${agentId}"`);
  }

  async execute(input: AgentRouterExecuteInput): Promise<AgentRouterExecuteResult> {
    const plan = this.plan(input.request, input.context);
    const responses: AiResponse[] = [];
    const executeResults: AgentExecuteResult[] = [];

    for (const agentId of plan.agentIds) {
      const agent = this.resolveAgent(agentId);
      const agentContext = await agent.buildContext(input.request, input.context);
      const toolNames = await agent.selectTools(input.request, agentContext);
      const prompt = await agent.buildPrompt(input.request, agentContext);

      const executeInput: AgentExecuteInput = {
        request: input.request,
        context: agentContext,
        prompt,
        toolNames,
        llmProvider: input.llmProvider,
      };

      const executeResult = await agent.execute(executeInput);
      const response = await agent.formatResponse(
        executeResult,
        input.request,
        agentContext
      );

      responses.push(response);
      executeResults.push(executeResult);
    }

    const combinedResponse = this.combineResponses(
      input.request,
      input.context,
      plan.decision,
      responses
    );

    return {
      decision: plan.decision,
      responses,
      combinedResponse,
      executeResults,
    };
  }

  private combineResponses(
    request: AiRequest,
    context: AiContext,
    decision: RoutingDecision,
    responses: AiResponse[]
  ): AiResponse {
    if (responses.length === 1) {
      return {
        ...responses[0]!,
        structured: {
          ...(responses[0]!.structured ?? {}),
          routing: {
            primaryAgentId: decision.primaryAgentId,
            selectedAgentIds: decision.selectedAgentIds,
            multiAgent: decision.multiAgent,
            reason: decision.reason,
            confidence: decision.confidence.scores,
          },
        },
      };
    }

    const agentIds = responses.map((response) => response.metadata.agentId);
    const toolsUsed = responses.flatMap(
      (response) => response.metadata.toolsUsed ?? []
    );

    const sections = responses.map((response) => {
      const agent = this.registry.get(response.metadata.agentId);
      const label = agent?.name ?? response.metadata.agentId;
      return `## ${label}\n\n${response.content}`;
    });

    return {
      id: createResponseId(),
      requestId: request.id,
      conversationId: context.conversation?.id ?? "",
      content: sections.join("\n\n---\n\n"),
      structured: {
        multiAgent: true,
        agentResponses: responses.map((response) => ({
          agentId: response.metadata.agentId,
          content: response.content,
          structured: response.structured,
        })),
        routing: {
          primaryAgentId: decision.primaryAgentId,
          selectedAgentIds: decision.selectedAgentIds,
          multiAgent: decision.multiAgent,
          reason: decision.reason,
          confidence: decision.confidence.scores,
        },
      },
      metadata: {
        agentId: agentIds.join("+"),
        toolsUsed: [...new Set(toolsUsed)],
        promptId: responses.map((response) => response.metadata.promptId).filter(Boolean).join("+") || undefined,
      },
    };
  }
}

export function createAgentRouter(
  registry: AgentRegistry,
  options?: AgentRouterOptions
): AgentRouter {
  return new AgentRouter(registry, options);
}
