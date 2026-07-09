import { getDefaultPromptLibrary } from "../prompts";
import { getDefaultToolRegistry } from "../tools";
import type {
  AgentCapability,
  AgentExecuteInput,
  AgentExecuteResult,
  AiAgent,
  AiContext,
  AiRequest,
  AiResponse,
  LlmCompletionRequest,
  LlmProvider,
  ToolExecutionResult,
} from "../types";
import { LlmProviderError } from "../types";

function createResponseId(): string {
  return `resp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface BaseAiAgentOptions {
  llmProvider?: LlmProvider;
}

export abstract class BaseAiAgent implements AiAgent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: readonly AgentCapability[];
  /** Override in subclasses; lower values are fallback-tier agents. */
  abstract readonly priority: number;
  protected abstract readonly promptTemplateId: string;
  protected abstract readonly defaultToolNames: readonly string[];
  protected readonly llmProvider?: LlmProvider;

  constructor(options: BaseAiAgentOptions = {}) {
    this.llmProvider = options.llmProvider;
  }

  abstract canHandle(request: AiRequest, context: AiContext): boolean;

  async buildContext(
    request: AiRequest,
    baseContext: AiContext
  ): Promise<AiContext> {
    return baseContext;
  }

  async buildPrompt(request: AiRequest, context: AiContext): Promise<string> {
    const library = getDefaultPromptLibrary();
    const rendered = library.render(this.promptTemplateId, {
      userMessage: request.message,
      workspaceType: context.workspace.type,
      workspaceLabel: context.workspace.label ?? context.workspace.id ?? "",
      userRole: context.user?.role ?? "unknown",
      campaignName: context.campaign?.name ?? "",
      campaignCode: context.campaign?.code ?? "",
      brandId: context.campaign?.brandId ?? context.workspace.brandId ?? "",
      clientName: context.client?.name ?? "",
      selectedCreatorCount: String(context.selectedCreators?.length ?? 0),
      filterSummary: context.filters?.query ?? "none",
    });

    return rendered.content;
  }

  async selectTools(
    _request: AiRequest,
    _context: AiContext
  ): Promise<string[]> {
    return [...this.defaultToolNames];
  }

  async execute(input: AgentExecuteInput): Promise<AgentExecuteResult> {
    const registry = getDefaultToolRegistry();
    const toolResults: ToolExecutionResult[] = [];

    for (const toolName of input.toolNames) {
      const result = await registry.execute(
        { toolName, input: this.buildToolInput(toolName, input) },
        input.context
      );
      toolResults.push(result);
    }

    const llmProvider = input.llmProvider ?? this.llmProvider;
    if (llmProvider) {
      const llmResult = await this.completeWithLlm(
        llmProvider,
        input,
        toolResults
      );
      return {
        rawContent: llmResult.content,
        structured: this.buildStructuredOutput(input, toolResults, llmResult),
        toolResults,
        model: llmResult.model,
        providerId: llmResult.providerId,
        llmStub: llmResult.stub,
      };
    }

    return {
      rawContent: this.synthesizeContent(input, toolResults),
      structured: this.buildStructuredOutput(input, toolResults),
      toolResults,
    };
  }

  async formatResponse(
    result: AgentExecuteResult,
    request: AiRequest,
    context: AiContext
  ): Promise<AiResponse> {
    return {
      id: createResponseId(),
      requestId: request.id,
      conversationId: context.conversation?.id ?? "",
      content: result.rawContent,
      structured: result.structured,
      metadata: {
        agentId: this.id,
        promptId: this.promptTemplateId,
        toolsUsed: result.toolResults
          .filter((entry) => entry.success)
          .map((entry) => entry.toolName),
        model: result.model,
      },
    };
  }

  protected buildToolInput(
    toolName: string,
    input: AgentExecuteInput
  ): Record<string, unknown> {
    const { context, request } = input;

    switch (toolName) {
      case "getCampaign":
        return { campaignId: context.campaign?.id ?? context.workspace.campaignId ?? "" };
      case "getClient":
        return { clientId: context.client?.id ?? context.workspace.clientId ?? "" };
      case "getShortlist":
        return { shortlistId: context.shortlist?.id ?? "" };
      case "searchCreators":
        return {
          query: context.filters?.query ?? request.message,
          platforms: context.filters?.platforms,
        };
      case "generateBrief":
        return {
          campaignId: context.campaign?.id ?? "",
          tone: "professional",
        };
      case "generateReport":
        return {
          campaignId: context.campaign?.id ?? "",
          reportType: "performance",
        };
      default:
        return {};
    }
  }

  protected async completeWithLlm(
    llmProvider: LlmProvider,
    input: AgentExecuteInput,
    toolResults: ToolExecutionResult[]
  ) {
    const request = this.buildLlmCompletionRequest(input, toolResults);

    try {
      return await llmProvider.complete(request);
    } catch (error) {
      if (error instanceof LlmProviderError) {
        throw error;
      }

      throw new LlmProviderError(
        error instanceof Error ? error.message : "LLM completion failed.",
        error
      );
    }
  }

  protected buildLlmCompletionRequest(
    input: AgentExecuteInput,
    toolResults: ToolExecutionResult[]
  ): LlmCompletionRequest {
    const userContent = this.buildLlmUserContent(input, toolResults);

    return {
      messages: [
        { role: "system", content: input.prompt },
        { role: "user", content: userContent },
      ],
      tools: this.buildLlmToolDefinitions(input.toolNames),
    };
  }

  protected buildLlmUserContent(
    input: AgentExecuteInput,
    toolResults: ToolExecutionResult[]
  ): string {
    const sections = [`User request:\n${input.request.message}`];

    const toolContext = this.formatToolResultsForLlm(toolResults);
    if (toolContext) {
      sections.push(`Tool results:\n${toolContext}`);
    }

    return sections.join("\n\n");
  }

  protected formatToolResultsForLlm(
    toolResults: ToolExecutionResult[]
  ): string | undefined {
    if (toolResults.length === 0) {
      return undefined;
    }

    return toolResults
      .map((result) => {
        if (result.success) {
          return `- ${result.toolName}: ${JSON.stringify(result.output)}`;
        }

        return `- ${result.toolName}: ERROR ${result.error ?? "unknown error"}`;
      })
      .join("\n");
  }

  protected buildLlmToolDefinitions(toolNames: string[]) {
    const registry = getDefaultToolRegistry();

    return toolNames
      .map((toolName) => registry.get(toolName))
      .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: {},
        },
      }));
  }

  protected synthesizeContent(
    input: AgentExecuteInput,
    toolResults: ToolExecutionResult[]
  ): string {
    const successfulTools = toolResults.filter((result) => result.success);
    const toolSummary =
      successfulTools.length > 0
        ? `Executed ${successfulTools.length} tool(s): ${successfulTools.map((t) => t.toolName).join(", ")}.`
        : "No tools executed.";

    return `[${this.name}] ${toolSummary}\n\nPrompt context prepared for: "${input.request.message}"`;
  }

  protected buildStructuredOutput(
    _input: AgentExecuteInput,
    toolResults: ToolExecutionResult[],
    llmResult?: { providerId: string; model: string; stub?: boolean }
  ): Record<string, unknown> {
    return {
      agentId: this.id,
      toolOutputs: toolResults
        .filter((result) => result.success)
        .map((result) => ({
          tool: result.toolName,
          output: result.output,
        })),
      ...(llmResult
        ? {
            llm: {
              providerId: llmResult.providerId,
              model: llmResult.model,
              stub: llmResult.stub ?? false,
            },
          }
        : {}),
    };
  }
}

export class AgentRegistry {
  private readonly agents = new Map<string, AiAgent>();

  register(agent: AiAgent): void {
    this.agents.set(agent.id, agent);
  }

  registerMany(agents: AiAgent[]): void {
    for (const agent of agents) {
      this.register(agent);
    }
  }

  get(id: string): AiAgent | undefined {
    return this.agents.get(id);
  }

  list(): AiAgent[] {
    return Array.from(this.agents.values());
  }

  async resolve(
    request: AiRequest,
    context: AiContext
  ): Promise<AiAgent | undefined> {
    const { createIntentEngine } = await import("../routing/intent-engine");
    const engine = createIntentEngine();
    const { decision } = engine.analyze(request, context);
    const primary = this.get(decision.primaryAgentId);
    if (primary) {
      return primary;
    }

    return this.get("general");
  }
}

export function createAgentRegistry(agents: AiAgent[] = []): AgentRegistry {
  const registry = new AgentRegistry();
  registry.registerMany(agents);
  return registry;
}
