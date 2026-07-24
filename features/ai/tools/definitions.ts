import type { AiContext } from "../types";
import type { AiToolDefinition, AnyAiToolDefinition } from "../types/tools";
import {
  buildCampaignInputSchema,
  buildCampaignOutputSchema,
  createShortlistInputSchema,
  createShortlistOutputSchema,
  generateBriefInputSchema,
  generateBriefOutputSchema,
  generateReportInputSchema,
  generateReportOutputSchema,
  getCampaignInputSchema,
  getCampaignOutputSchema,
  getClientInputSchema,
  getClientOutputSchema,
  getCreatorInputSchema,
  getCreatorOutputSchema,
  getShortlistInputSchema,
  getShortlistOutputSchema,
  searchCreatorsInputSchema,
  searchCreatorsOutputSchema,
  type BuildCampaignInput,
  type BuildCampaignOutput,
  type CreateShortlistInput,
  type CreateShortlistOutput,
  type GenerateBriefInput,
  type GenerateBriefOutput,
  type GenerateReportInput,
  type GenerateReportOutput,
  type GetCampaignInput,
  type GetCampaignOutput,
  type GetClientInput,
  type GetClientOutput,
  type GetCreatorInput,
  type GetCreatorOutput,
  type GetShortlistInput,
  type GetShortlistOutput,
  type SearchCreatorsInput,
  type SearchCreatorsOutput,
} from "./schemas";
import {
  executeBuildCampaignProduction,
  executeGenerateBriefProduction,
  executeGetCampaignProduction,
  executeGetClientProduction,
  executeSearchCreatorsProduction,
} from "./production-executors";

export const searchCreatorsTool: AiToolDefinition<
  SearchCreatorsInput,
  SearchCreatorsOutput
> = {
  name: "searchCreators",
  description: "Search creators by query, platform, and filters.",
  inputSchema: searchCreatorsInputSchema,
  outputSchema: searchCreatorsOutputSchema,
  async execute(input, context: AiContext) {
    return executeSearchCreatorsProduction(input, context);
  },
};

export const getCreatorTool: AiToolDefinition<GetCreatorInput, GetCreatorOutput> = {
  name: "getCreator",
  description: "Retrieve detailed creator profile by ID.",
  inputSchema: getCreatorInputSchema,
  outputSchema: getCreatorOutputSchema,
  async execute(input, _context: AiContext) {
    return {
      id: input.creatorId,
      handle: "example_creator",
      displayName: "Example Creator",
      platform: "instagram",
      bio: "Stub creator profile for AI tooling.",
      followers: 125_000,
      engagementRate: 3.2,
      categories: ["lifestyle", "beauty"],
    };
  },
};

export const getCampaignTool: AiToolDefinition<GetCampaignInput, GetCampaignOutput> = {
  name: "getCampaign",
  description: "Retrieve campaign header details by ID.",
  inputSchema: getCampaignInputSchema,
  outputSchema: getCampaignOutputSchema,
  async execute(input, context: AiContext) {
    return executeGetCampaignProduction(input, context);
  },
};

export const getClientTool: AiToolDefinition<GetClientInput, GetClientOutput> = {
  name: "getClient",
  description: "Retrieve legal entity (client) details by ID.",
  inputSchema: getClientInputSchema,
  outputSchema: getClientOutputSchema,
  async execute(input, context: AiContext) {
    return executeGetClientProduction(input, context);
  },
};

export const getShortlistTool: AiToolDefinition<
  GetShortlistInput,
  GetShortlistOutput
> = {
  name: "getShortlist",
  description: "Retrieve shortlist with creator roster.",
  inputSchema: getShortlistInputSchema,
  outputSchema: getShortlistOutputSchema,
  async execute(input, context: AiContext) {
    const creators =
      context.selectedCreators?.map((creator) => ({
        id: creator.id,
        handle: creator.handle ?? "unknown",
        displayName: creator.displayName ?? creator.handle ?? creator.id,
      })) ?? [];

    return {
      id: input.shortlistId,
      name: context.shortlist?.name ?? "Sample Shortlist",
      status: context.shortlist?.status ?? "draft",
      creatorCount: creators.length,
      creators,
    };
  },
};

export const createShortlistTool: AiToolDefinition<
  CreateShortlistInput,
  CreateShortlistOutput
> = {
  name: "createShortlist",
  description: "Create a new creator shortlist.",
  inputSchema: createShortlistInputSchema,
  outputSchema: createShortlistOutputSchema,
  async execute(input, _context: AiContext) {
    return {
      id: `shortlist_${Date.now()}`,
      name: input.name,
      creatorCount: input.creatorIds.length,
      status: "draft",
    };
  },
};

export const buildCampaignTool: AiToolDefinition<
  BuildCampaignInput,
  BuildCampaignOutput
> = {
  name: "buildCampaign",
  description: "Draft campaign structure with suggested lines from brand and creators.",
  inputSchema: buildCampaignInputSchema,
  outputSchema: buildCampaignOutputSchema,
  async execute(input, context: AiContext) {
    return executeBuildCampaignProduction(input, context);
  },
};

export const generateBriefTool: AiToolDefinition<
  GenerateBriefInput,
  GenerateBriefOutput
> = {
  name: "generateBrief",
  description: "Generate an influencer creative brief for a campaign.",
  inputSchema: generateBriefInputSchema,
  outputSchema: generateBriefOutputSchema,
  async execute(input, context: AiContext) {
    return executeGenerateBriefProduction(input, context);
  },
};

export const generateReportTool: AiToolDefinition<
  GenerateReportInput,
  GenerateReportOutput
> = {
  name: "generateReport",
  description: "Generate campaign performance, billing, or deliverables report.",
  inputSchema: generateReportInputSchema,
  outputSchema: generateReportOutputSchema,
  async execute(input, context: AiContext) {
    const { assertAiReportTypeAllowed } = await import(
      "@/lib/security/ai-workspace-isolation"
    );
    assertAiReportTypeAllowed(input.reportType);

    return {
      title: `${input.reportType} Report — ${context.campaign?.name ?? input.campaignId}`,
      summary: "Campaign is tracking on plan with healthy delivery metrics.",
      metrics: [
        { label: "Total Reach", value: "2.4M" },
        { label: "Engagement Rate", value: "3.8%" },
      ],
      recommendations: [
        "Increase Reels allocation for top-performing creators.",
        "Review underperforming lines with the campaign owner.",
      ],
    };
  },
};

export const DEFAULT_TOOLS: AnyAiToolDefinition[] = [
  searchCreatorsTool,
  getCreatorTool,
  getCampaignTool,
  getClientTool,
  getShortlistTool,
  createShortlistTool,
  buildCampaignTool,
  generateBriefTool,
  generateReportTool,
];
