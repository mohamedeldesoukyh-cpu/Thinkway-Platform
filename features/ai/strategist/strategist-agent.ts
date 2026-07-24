import { BaseAiAgent } from "../agents/base-agent";
import { getDefaultPromptLibrary } from "../prompts";
import {
  buildPromptLayers,
  type PromptLayers,
} from "../prompts/prompt-isolation";
import { getDefaultToolRegistry } from "../tools";
import { AI_SEARCH_CREATORS_PAGE_SIZE } from "../tools/search-creators-browse";
import type {
  AgentExecuteInput,
  AgentExecuteResult,
  AiContext,
  AiRequest,
  ToolExecutionResult,
} from "../types";

import {
  buildClarificationQuestion,
  detectMissingCriticalInfo,
} from "./missing-info";
import { analyzeStrategistRequest } from "./request-analysis";
import { formatStrategyResponse } from "./strategy-formatter";

export class StrategistAgent extends BaseAiAgent {
  readonly id = "strategist";
  readonly name = "Campaign Strategist";
  readonly capabilities = ["strategy"] as const;
  readonly priority = 80;
  protected readonly promptTemplateId = "agent.strategist";
  protected readonly defaultToolNames = [
    "searchCreators",
    "getClient",
    "getCampaign",
    "buildCampaign",
    "generateBrief",
  ] as const;

  /** @deprecated Routing handled by AgentRouter. */
  canHandle(_request: AiRequest, _context: AiContext): boolean {
    return false;
  }

  async buildPromptLayers(
    request: AiRequest,
    context: AiContext
  ): Promise<PromptLayers> {
    const library = getDefaultPromptLibrary();
    const analysis = analyzeStrategistRequest(request, context);
    const missing = detectMissingCriticalInfo(analysis, context);

    if (missing) {
      const systemTemplate = library.get("agent.strategist.clarify")?.template;
      const developerTemplate = library.get(
        "agent.strategist.clarify.developer"
      )?.template;
      if (!systemTemplate) {
        throw new Error("Prompt template not found: agent.strategist.clarify");
      }
      return buildPromptLayers({
        systemTemplate,
        developerTemplate,
        systemVariables: { missingField: missing.field },
        developerVariables: {
          missingField: missing.field,
          clientName: context.client?.name ?? "",
          campaignName: context.campaign?.name ?? "",
        },
        userMessage: request.message,
      });
    }

    const systemTemplate = library.get("agent.strategist.generate")?.template;
    const developerTemplate = library.get(
      "agent.strategist.generate.developer"
    )?.template;
    if (!systemTemplate) {
      throw new Error("Prompt template not found: agent.strategist.generate");
    }

    return buildPromptLayers({
      systemTemplate,
      developerTemplate,
      developerVariables: {
        workspaceType: context.workspace.type,
        workspaceLabel: context.workspace.label ?? context.workspace.id ?? "",
        clientName: context.client?.name ?? analysis.clientName ?? "",
        campaignName: context.campaign?.name ?? analysis.campaignTitle ?? "",
        brandName: analysis.brandName ?? context.workspace.brandId ?? "",
        objective: analysis.objective ?? "",
        budget:
          analysis.budget != null
            ? String(analysis.budget)
            : context.campaign?.poAmount != null
              ? String(context.campaign.poAmount)
              : "",
        audience: analysis.audience ?? "",
        timeline: analysis.timeline ?? "",
      },
      userMessage: request.message,
    });
  }

  async buildPrompt(request: AiRequest, context: AiContext): Promise<string> {
    const layers = await this.buildPromptLayers(request, context);
    return layers.system;
  }

  async selectTools(request: AiRequest, context: AiContext): Promise<string[]> {
    const analysis = analyzeStrategistRequest(request, context);
    const missing = detectMissingCriticalInfo(analysis, context);

    if (missing) {
      return [];
    }

    const tools: string[] = ["searchCreators"];

    if (analysis.clientId && !this.hasClientSnapshot(context)) {
      tools.push("getClient");
    }

    if (analysis.campaignId && !this.hasCampaignSnapshot(context)) {
      tools.push("getCampaign");
    }

    if (analysis.brandId || context.workspace.brandId || context.campaign?.brandId) {
      tools.push("buildCampaign");
    }

    if (analysis.campaignId) {
      tools.push("generateBrief");
    }

    return tools;
  }

  async execute(input: AgentExecuteInput): Promise<AgentExecuteResult> {
    const analysis = analyzeStrategistRequest(input.request, input.context);
    const missing = detectMissingCriticalInfo(analysis, input.context);

    if (missing) {
      const question = buildClarificationQuestion(missing);
      return {
        rawContent: question,
        structured: {
          mode: "clarification",
          missingField: missing.field,
          analysis,
        },
        toolResults: [],
      };
    }

    const registry = getDefaultToolRegistry();
    const toolNames =
      input.toolNames.length > 0
        ? input.toolNames
        : await this.selectTools(input.request, input.context);
    const toolResults: ToolExecutionResult[] = [];

    for (const toolName of toolNames) {
      const result = await registry.execute(
        {
          toolName,
          input: this.buildToolInput(toolName, input),
        },
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
      const formatted = formatStrategyResponse(analysis, toolResults);

      return {
        rawContent: llmResult.content.trim() || formatted.markdown,
        structured: {
          mode: "strategy",
          sections: formatted.sections,
          analysis,
          toolOutputs: toolResults
            .filter((result) => result.success)
            .map((result) => ({
              tool: result.toolName,
              output: result.output,
            })),
          llm: {
            providerId: llmResult.providerId,
            model: llmResult.model,
            stub: llmResult.stub ?? false,
          },
        },
        toolResults,
        model: llmResult.model,
        providerId: llmResult.providerId,
        llmStub: llmResult.stub,
      };
    }

    const formatted = formatStrategyResponse(analysis, toolResults);

    return {
      rawContent: formatted.markdown,
      structured: {
        mode: "strategy",
        sections: formatted.sections,
        analysis,
        toolOutputs: toolResults
          .filter((result) => result.success)
          .map((result) => ({
            tool: result.toolName,
            output: result.output,
          })),
      },
      toolResults,
    };
  }

  protected buildToolInput(
    toolName: string,
    input: AgentExecuteInput
  ): Record<string, unknown> {
    const analysis = analyzeStrategistRequest(input.request, input.context);
    const { context } = input;
    const brandId =
      analysis.brandId ?? context.campaign?.brandId ?? context.workspace.brandId;
    const clientId =
      analysis.clientId ?? context.client?.id ?? context.workspace.clientId;
    const campaignId =
      analysis.campaignId ?? context.campaign?.id ?? context.workspace.campaignId;

    switch (toolName) {
      case "searchCreators":
        return {
          query: analysis.searchQuery ?? input.request.message,
          platforms: analysis.platforms,
          limit: AI_SEARCH_CREATORS_PAGE_SIZE,
        };
      case "getClient":
        return { clientId: clientId ?? "" };
      case "getCampaign":
        return { campaignId: campaignId ?? "" };
      case "buildCampaign": {
        const creatorIds =
          input.context.selectedCreators?.map((creator) => creator.id) ??
          undefined;
        return {
          brandId: brandId ?? "",
          name:
            analysis.campaignTitle ??
            context.campaign?.name ??
            `${analysis.brandName ?? "Campaign"} Strategy Draft`,
          poAmount: analysis.budget ?? context.campaign?.poAmount,
          creatorIds,
        };
      }
      case "generateBrief":
        return {
          campaignId: campaignId ?? "",
          tone: "professional",
        };
      default:
        return super.buildToolInput(toolName, input);
    }
  }

  private hasClientSnapshot(context: AiContext): boolean {
    return Boolean(context.client?.id && context.client.name);
  }

  private hasCampaignSnapshot(context: AiContext): boolean {
    return Boolean(
      context.campaign?.id && context.campaign.name && context.campaign.code
    );
  }
}

export const strategistAgent = new StrategistAgent();
