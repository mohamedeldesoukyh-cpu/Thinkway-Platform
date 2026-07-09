import type { WorkflowDefinition } from "../types";
import {
  buildDirectorTaskPrompt,
  getCampaignFactsFromWorkflowData,
  getSpecialistDomain,
  getStrategyFromWorkflowData,
} from "@/features/campaign-director";
import { resolveSpecialistForTask } from "@/features/campaign-director/services/specialist-dispatch";

function directorPrompt(
  ctx: Parameters<NonNullable<WorkflowDefinition["tasks"][number]["buildPrompt"]>>[0],
  taskId: string,
  taskInstruction: string
): string {
  const strategy = getStrategyFromWorkflowData(ctx.state.data);
  const campaignFacts = getCampaignFactsFromWorkflowData(ctx.state.data);
  const specialistId = resolveSpecialistForTask(taskId);
  if (strategy && specialistId) {
    return buildDirectorTaskPrompt(
      strategy,
      getSpecialistDomain(specialistId),
      taskInstruction,
      campaignFacts
    );
  }
  return taskInstruction;
}

export const createCampaignWorkflow: WorkflowDefinition = {
  id: "create-campaign",
  name: "Create Campaign",
  description:
    "End-to-end campaign creation: strategy, budget, creator search, shortlist, brief, timeline, and approval.",
  minConfidence: 70,
  triggerPatterns: [
    /\bcreate\s+(?:a\s+)?(?:new\s+)?campaign\b/i,
    /\bcreate\s+(?:a\s+)?[\w-]+\s+campaign\b/i,
    /\bbuild\s+(?:a\s+)?campaign\b/i,
    /\bstart\s+(?:a\s+)?campaign\b/i,
    /\blaunch(?:ing)?\s+\w/i,
    /\blaunch(?:ing)?\s+[\w-]+(?:\s+[\w-]+){0,8}\s+in\s+[\w-]+/i,
    /\bbudget\b[\s\S]{0,220}\b(?:duration|weeks|months|objective)\b/i,
    /\bcampaign\s+for\s+\w+/i,
    /\bnew\s+\w+\s+campaign\b/i,
  ],
  tasks: [
    {
      id: "analyze-request",
      title: "Analyze request",
      description: "Parse campaign goals, brand, and constraints from user input.",
      agent: "general",
      intent: "general",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        directorPrompt(
          ctx,
          "analyze-request",
          "Analyze the campaign brief and confirm alignment with the Director strategy document. Extract brand, product, audience, budget, timeline. Summarize WHAT you found and WHY it matters for the campaign."
        ),
    },
    {
      id: "build-strategy",
      title: "Build campaign strategy",
      description: "Develop influencer marketing strategy with objectives and KPIs.",
      agent: "strategist",
      intent: "strategize",
      tools: ["getClient", "getCampaign"],
      readonly: true,
      buildPrompt: (ctx) => {
        const brand = ctx.state.data.brandName ?? extractBrandFromMessage(ctx.userMessage);
        return directorPrompt(
          ctx,
          "build-strategy",
          `Expand the Director strategy for ${brand ? `"${brand}"` : "this campaign"}. Include objectives, target audience, platform mix, content pillars, and KPIs. Every recommendation needs WHAT + WHY tied to the strategy document.`
        );
      },
    },
    {
      id: "estimate-budget",
      title: "Estimate campaign budget",
      description: "Estimate budget allocation across creators, production, and media.",
      agent: "analyst",
      intent: "analyze",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) => {
        const campaignFacts = getCampaignFactsFromWorkflowData(ctx.state.data);
        const currency =
          campaignFacts?.budget?.currency ??
          (typeof ctx.state.data.currency === "string" ? ctx.state.data.currency : "USD");
        const budgetAmount = campaignFacts?.budget?.amount;
        const budgetHint = budgetAmount
          ? `Facts SSOT budget: ${currency} ${budgetAmount.toLocaleString()}.`
          : `Estimate in ${currency}.`;
        return directorPrompt(
          ctx,
          "estimate-budget",
          `${budgetHint} Default: creator fees include production. Only add Production, Usage Rights, Paid Amplification, Events, Travel, or Celebrity Management if the strategy brief requires. Every allocation must total exactly 100% with rationale (WHAT + WHY).`
        );
      },
    },
    {
      id: "search-creators",
      title: "Search creators",
      description: "Find creators matching campaign audience and platform requirements.",
      agent: "scout",
      intent: "scout",
      tools: ["searchCreators"],
      readonly: true,
      buildPrompt: (ctx) =>
        directorPrompt(
          ctx,
          "search-creators",
          "Search for creators matching the Director strategy (audience, platforms, tier mix). Execute searchCreators with structured filters from the strategy — never pass the raw brief as the search string. Explain WHY each filter aligns with strategy."
        ),
    },
    {
      id: "build-shortlist",
      title: "Build recommended shortlist",
      description: "Curate top creator matches into a recommended shortlist.",
      agent: "scout",
      intent: "scout",
      tools: [],
      readonly: true,
      requiredState: ["searchResults"],
      buildPrompt: (ctx) => {
        const count = Array.isArray(ctx.state.data.searchResults)
          ? ctx.state.data.searchResults.length
          : 0;
        return directorPrompt(
          ctx,
          "build-shortlist",
          `Rank the ${count} vendor(s) from searchResults by campaign fit per Director strategy. Use ONLY creator IDs and handles from searchResults. For each recommendation explain WHAT (rank) and WHY (strategy fit).`
        );
      },
    },
    {
      id: "generate-brief",
      title: "Generate campaign brief",
      description: "Create creative brief for vendor assignments.",
      agent: "strategist",
      intent: "strategize",
      tools: ["generateBrief"],
      readonly: true,
      buildPrompt: (ctx) =>
        directorPrompt(
          ctx,
          "generate-brief",
          "Generate a creative brief using generateBrief aligned to the Director strategy. Include deliverables, brand guidelines, dos/don'ts. Every section needs WHAT + WHY."
        ),
    },
    {
      id: "generate-timeline",
      title: "Generate timeline",
      description: "Build campaign execution timeline with milestones.",
      agent: "planner",
      intent: "plan",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        directorPrompt(
          ctx,
          "generate-timeline",
          `Create a client-facing execution timeline only. Phases: Campaign Start, Content Production, Publishing Window, Optimization, Campaign End, Reporting, Insights, Recommendations. Include tier progression (Mega → Macro → Micro → Nano) with WHY per week. Do NOT include brief approval, vendor discovery, meetings, or internal planning. Format: "Week N: phase — activities — rationale".`
        ),
    },
    {
      id: "prepare-approval",
      title: "Prepare approval action",
      description: "Generate campaign draft for user approval.",
      agent: "strategist",
      intent: "strategize",
      tools: ["buildCampaign"],
      readonly: false,
      requiresApproval: true,
      approvalTool: "buildCampaign",
      buildPrompt: (ctx) => {
        const brand = ctx.state.data.brandName ?? extractBrandFromMessage(ctx.userMessage);
        return directorPrompt(
          ctx,
          "prepare-approval",
          `Prepare a campaign draft using buildCampaign for ${brand ? `"${brand}"` : "this campaign"}. All sections must align with the approved Director strategy — zero contradictions. Explain WHY this draft is ready for approval.`
        );
      },
    },
  ],
};

function extractBrandFromMessage(message: string): string | undefined {
  const match = message.match(
    /(?:campaign\s+for|create\s+(?:a\s+)?(?:new\s+)?campaign\s+for?)\s+([A-Za-z0-9][\w\s-]*?)(?:\s+campaign|\s*$|[.,!?])/i
  );
  return match?.[1]?.trim();
}
