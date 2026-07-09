import { BaseAiAgent } from "../agents/base-agent";
import { getDefaultToolRegistry } from "../tools";
import {
  extractSearchCreatorsOutput,
  formatRankedResults,
  formatSearchResults,
  formatShortlistSuggestion,
  formatShortlistSuggestionMarkdown,
  assignCampaignRelevanceRanks,
  hasCampaignRelevanceScores,
  normalizeCreators,
  rankCreators,
  stripConversationalFiller,
} from "@/features/ai-workflows/formatters/creator-formatter";
import type {
  AgentExecuteInput,
  AgentExecuteResult,
  AiContext,
  AiRequest,
} from "../types";
import { parseCreatorSearchQuery } from "../tools/creator-search-parser";
import { buildCampaignSearchIntent, looksLikeCampaignBrief } from "../tools/campaign-search-intent";
import { AI_SEARCH_CREATORS_PAGE_SIZE } from "../tools/search-creators-browse";
import { workflowTrace } from "@/lib/creators/search-trace";
import { dedupeGroundedCreators } from "@/lib/creators/dedupe-creators";

const WORKFLOW_SEARCH_TASKS = new Set(["search-creators", "identify-creators"]);
const WORKFLOW_RANK_TASKS = new Set(["rank-results", "curate-selection", "build-shortlist"]);
const WORKFLOW_SHORTLIST_TASKS = new Set(["shortlist-option", "create-shortlist"]);

function getOriginalUserMessage(request: AiRequest): string | undefined {
  const raw = request.metadata?.originalUserMessage;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function getRawCreatorSearchMessage(input: AgentExecuteInput): string {
  const { context, request } = input;

  if (context.filters?.query?.trim()) {
    return context.filters.query.trim();
  }

  const originalUserMessage = getOriginalUserMessage(request);
  if (originalUserMessage) {
    return originalUserMessage;
  }

  const message = request.message.trim();
  return message || "creators";
}

/** Extract display query from direct messages or workflow task prompts. */
export function extractCreatorSearchQuery(input: AgentExecuteInput): string {
  const raw = getRawCreatorSearchMessage(input);
  if (looksLikeCampaignBrief(raw)) {
    const intent = buildCampaignSearchIntent(raw);
    return intent.categories.slice(0, 3).join(", ") || intent.industry;
  }
  const parsed = parseCreatorSearchQuery(raw);
  return parsed.search || raw.slice(0, 200);
}

function getWorkflowCreators(input: AgentExecuteInput) {
  const raw = input.request.metadata?.workflowCreators;
  return dedupeGroundedCreators(normalizeCreators(raw), "rankingInput").creators;
}

function buildCreatorSearchFilters(input: AgentExecuteInput): Record<string, unknown> {
  const { context } = input;
  const custom = context.filters?.custom ?? {};

  return {
    platforms: context.filters?.platforms,
    categories: context.filters?.categories,
    country:
      typeof custom.country === "string"
        ? custom.country
        : context.filters?.countries?.[0],
    language: typeof custom.language === "string" ? custom.language : undefined,
    minFollowers:
      typeof custom.minFollowers === "number" ? custom.minFollowers : undefined,
    maxFollowers:
      typeof custom.maxFollowers === "number" ? custom.maxFollowers : undefined,
    minEngagement:
      typeof custom.minEngagement === "number" ? custom.minEngagement : undefined,
    minThinkwayScore:
      typeof custom.minThinkwayScore === "number" ? custom.minThinkwayScore : undefined,
  };
}

function buildGroundedStructuredOutput(
  toolResults: AgentExecuteResult["toolResults"],
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    agentId: "scout",
    toolOutputs: toolResults
      .filter((result) => result.success)
      .map((result) => ({
        tool: result.toolName,
        output: result.output,
      })),
    ...extra,
  };
}

export class ScoutAgent extends BaseAiAgent {
  readonly id = "scout";
  readonly name = "Creator Scout";
  readonly capabilities = ["discovery"] as const;
  readonly priority = 75;
  protected readonly promptTemplateId = "agent.scout";
  protected readonly defaultToolNames = [
    "searchCreators",
    "getCreator",
    "getShortlist",
    "createShortlist",
  ] as const;

  /** @deprecated Routing handled by AgentRouter. */
  canHandle(_request: AiRequest, _context: AiContext): boolean {
    return false;
  }

  async selectTools(request: AiRequest, context: AiContext): Promise<string[]> {
    const workflowTask =
      typeof request.metadata?.workflowTask === "string"
        ? request.metadata.workflowTask
        : undefined;

    if (workflowTask && WORKFLOW_SEARCH_TASKS.has(workflowTask)) {
      return ["searchCreators"];
    }

    if (workflowTask && WORKFLOW_RANK_TASKS.has(workflowTask)) {
      return [];
    }

    if (workflowTask && WORKFLOW_SHORTLIST_TASKS.has(workflowTask)) {
      if (workflowTask === "create-shortlist") {
        return ["createShortlist"];
      }
      return [];
    }

    const tools: string[] = ["searchCreators"];
    if (context.shortlist?.id) {
      tools.push("getShortlist");
    }

    return tools;
  }

  async execute(input: AgentExecuteInput): Promise<AgentExecuteResult> {
    const workflowTask =
      typeof input.request.metadata?.workflowTask === "string"
        ? input.request.metadata.workflowTask
        : undefined;

    if (workflowTask && WORKFLOW_SEARCH_TASKS.has(workflowTask)) {
      return this.executeGroundedSearch(input);
    }

    if (workflowTask && WORKFLOW_RANK_TASKS.has(workflowTask)) {
      return this.executeGroundedRank(input);
    }

    if (workflowTask === "shortlist-option") {
      return this.executeGroundedShortlistOption(input);
    }

    if (workflowTask === "create-shortlist") {
      return this.executeGroundedCreateShortlist(input);
    }

    const toolNames =
      input.toolNames.length > 0
        ? input.toolNames
        : await this.selectTools(input.request, input.context);

    if (toolNames.length === 1 && toolNames[0] === "searchCreators") {
      return this.executeGroundedSearch(input, toolNames);
    }

    const result = await super.execute(input);
    return {
      ...result,
      rawContent: stripConversationalFiller(result.rawContent),
    };
  }

  private async executeGroundedSearch(
    input: AgentExecuteInput,
    toolNames?: string[]
  ): Promise<AgentExecuteResult> {
    const existingCreators = getWorkflowCreators(input);
    const searchAlreadyExecuted = input.request.metadata?.searchExecuted === true;
    if (searchAlreadyExecuted && existingCreators.length > 0) {
      const query = extractCreatorSearchQuery(input);
      const total =
        typeof input.request.metadata?.workflowSearchTotal === "number"
          ? input.request.metadata.workflowSearchTotal
          : existingCreators.length;
      const content = stripConversationalFiller(
        formatSearchResults(existingCreators, total, query)
      );
      return {
        rawContent: content,
        structured: {
          agentId: this.id,
          mode: "creator_search",
          searchQuery: query,
          creators: existingCreators,
          total,
          toolOutputs: [],
        },
        toolResults: [],
      };
    }

    const registry = getDefaultToolRegistry();
    const names =
      toolNames ??
      (input.toolNames.length > 0
        ? input.toolNames
        : await this.selectTools(input.request, input.context));
    const toolResults: AgentExecuteResult["toolResults"] = [];

    for (const toolName of names) {
      const result = await registry.execute(
        { toolName, input: this.buildToolInput(toolName, input) },
        input.context
      );
      toolResults.push(result);
    }

    const searchOutput = extractSearchCreatorsOutput(toolResults);
    const query = extractCreatorSearchQuery(input);
    const creators = dedupeGroundedCreators(
      normalizeCreators(searchOutput?.creators ?? [], "searchCreatorsTool"),
      "searchCreatorsTool"
    ).creators;
    const total = searchOutput?.total ?? creators.length;

    workflowTrace("3_scout_executeGroundedSearch_toolResults", { toolResults }, "toolResults", {
      searchOutputCreatorsLen: searchOutput?.creators?.length ?? null,
      normalizedCreatorsLen: creators.length,
      total,
    });

    const content = stripConversationalFiller(
      formatSearchResults(creators, total, query)
    );

    const groundedResult = {
      rawContent: content,
      structured: buildGroundedStructuredOutput(toolResults, {
        mode: "creator_search",
        searchQuery: query,
        creators,
        total,
      }),
      toolResults,
    };

    workflowTrace("4_scout_executeGroundedSearch_return", groundedResult, "scoutSearchResult");

    return groundedResult;
  }

  private executeGroundedRank(input: AgentExecuteInput): AgentExecuteResult {
    const query = extractCreatorSearchQuery(input);
    const rawWorkflowCreators = input.request.metadata?.workflowCreators;
    const creators = getWorkflowCreators(input);
    const searchTotal =
      typeof input.request.metadata?.workflowSearchTotal === "number"
        ? input.request.metadata.workflowSearchTotal
        : creators.length;

    workflowTrace("8_rank_input", { workflowCreators: rawWorkflowCreators }, "rankInput", {
      normalizedCreatorsLen: creators.length,
      searchTotal,
      metadataKeys: input.request.metadata ? Object.keys(input.request.metadata) : [],
    });

    if (creators.length === 0) {
      const content = stripConversationalFiller(
        searchTotal > 0
          ? `Discovery returned ${searchTotal} vendor(s) but ranked shortlist is unavailable — re-run search.`
          : "_No vendors matched discovery criteria. Refine audience, platform, or category filters — do not use generic placeholder recommendations._"
      );
      return {
        rawContent: content,
        structured: {
          agentId: this.id,
          mode: "ranked_creators",
          searchQuery: query,
          creators: [],
          total: searchTotal,
          toolOutputs: [],
        },
        toolResults: [],
      };
    }

    const ranked =
      hasCampaignRelevanceScores(creators) || input.context.campaignIntelligenceProfileId
        ? assignCampaignRelevanceRanks(creators)
        : rankCreators(creators, query);
    const content = stripConversationalFiller(formatRankedResults(ranked, query));

    return {
      rawContent: content,
      structured: {
        agentId: this.id,
        mode: "ranked_creators",
        searchQuery: query,
        creators: ranked,
        toolOutputs: [],
      },
      toolResults: [],
    };
  }

  private executeGroundedShortlistOption(input: AgentExecuteInput): AgentExecuteResult {
    const query = extractCreatorSearchQuery(input);
    const creators = getWorkflowCreators(input);
    const ranked =
      hasCampaignRelevanceScores(creators) || input.context.campaignIntelligenceProfileId
        ? assignCampaignRelevanceRanks(creators)
        : rankCreators(creators, query);
    const suggestion = formatShortlistSuggestion(ranked, query);
    const content = stripConversationalFiller(
      formatShortlistSuggestionMarkdown(suggestion)
    );

    return {
      rawContent: content,
      structured: {
        agentId: this.id,
        mode: "shortlist_suggestion",
        shortlist: suggestion,
        toolOutputs: [],
      },
      toolResults: [],
    };
  }

  private async executeGroundedCreateShortlist(
    input: AgentExecuteInput
  ): Promise<AgentExecuteResult> {
    const query = extractCreatorSearchQuery(input);
    const creators = getWorkflowCreators(input);
    const ranked =
      hasCampaignRelevanceScores(creators) || input.context.campaignIntelligenceProfileId
        ? assignCampaignRelevanceRanks(creators)
        : rankCreators(creators, query);
    const suggestion = formatShortlistSuggestion(ranked, query);

    const registry = getDefaultToolRegistry();
    const toolInput = {
      name: suggestion.name,
      creatorIds: suggestion.creatorIds,
    };
    const toolResult = await registry.execute(
      { toolName: "createShortlist", input: toolInput },
      input.context
    );

    const content = stripConversationalFiller(
      `${formatShortlistSuggestionMarkdown(suggestion)}\n\n**Action:** Shortlist draft prepared for approval.`
    );

    return {
      rawContent: content,
      structured: buildGroundedStructuredOutput([toolResult], {
        mode: "shortlist_draft",
        shortlist: suggestion,
      }),
      toolResults: [toolResult],
    };
  }

  protected buildToolInput(
    toolName: string,
    input: AgentExecuteInput
  ): Record<string, unknown> {
    const { context } = input;

    switch (toolName) {
      case "searchCreators": {
        if (context.campaignIntelligenceProfileId?.trim()) {
          return {
            query: "creators",
            limit: AI_SEARCH_CREATORS_PAGE_SIZE,
          };
        }
        const rawQuery = getRawCreatorSearchMessage(input);
        const contextFilters = buildCreatorSearchFilters(input);
        if (looksLikeCampaignBrief(rawQuery)) {
          const intent = buildCampaignSearchIntent(rawQuery);
          return {
            query: rawQuery,
            limit: AI_SEARCH_CREATORS_PAGE_SIZE,
            platforms: contextFilters.platforms ?? intent.platforms,
            categories: contextFilters.categories ?? intent.categories,
            country: contextFilters.country ?? intent.country,
            language: contextFilters.language ?? intent.language,
            minFollowers: contextFilters.minFollowers ?? intent.parsed.minFollowers,
            maxFollowers: contextFilters.maxFollowers ?? intent.parsed.maxFollowers,
            minEngagement: contextFilters.minEngagement ?? intent.parsed.minEngagement,
            minThinkwayScore: contextFilters.minThinkwayScore,
          };
        }
        const parsed = parseCreatorSearchQuery(rawQuery);
        return {
          query: rawQuery,
          limit: AI_SEARCH_CREATORS_PAGE_SIZE,
          platforms: contextFilters.platforms ?? parsed.platforms,
          categories: contextFilters.categories ?? parsed.categories,
          country: contextFilters.country ?? parsed.country,
          language: contextFilters.language,
          minFollowers: contextFilters.minFollowers ?? parsed.minFollowers,
          maxFollowers: contextFilters.maxFollowers ?? parsed.maxFollowers,
          minEngagement: contextFilters.minEngagement ?? parsed.minEngagement,
          minThinkwayScore: contextFilters.minThinkwayScore,
        };
      }
      case "getShortlist":
        return { shortlistId: context.shortlist?.id ?? "" };
      case "createShortlist": {
        const creators = getWorkflowCreators(input);
        const query = extractCreatorSearchQuery(input);
        const ranked =
          hasCampaignRelevanceScores(creators) || input.context.campaignIntelligenceProfileId
            ? assignCampaignRelevanceRanks(creators)
            : rankCreators(creators, query);
        const suggestion = formatShortlistSuggestion(ranked, query);
        return {
          name: suggestion.name,
          creatorIds: suggestion.creatorIds,
        };
      }
      default:
        return super.buildToolInput(toolName, input);
    }
  }
}

export const scoutAgent = new ScoutAgent();
