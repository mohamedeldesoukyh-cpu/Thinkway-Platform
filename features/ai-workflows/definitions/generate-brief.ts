import type { WorkflowDefinition } from "../types";

export const generateBriefWorkflow: WorkflowDefinition = {
  id: "generate-brief",
  name: "Generate Brief",
  description: "Create a creative brief for campaign vendor assignments.",
  minConfidence: 70,
  triggerPatterns: [
    /\bgenerate\s+(?:a\s+)?(?:creative\s+)?brief\b/i,
    /\bgenerate\s+(?:a\s+)?proposal\b/i,
    /\bcreate\s+(?:a\s+)?(?:creative\s+)?brief\b/i,
    /\bcreate\s+(?:a\s+)?proposal\b/i,
    /\bwrite\s+(?:a\s+)?brief\b/i,
    /\bcreative\s+brief\s+for\b/i,
    /\bbrief\s+for\s+(?:my|the|this)\s+campaign\b/i,
  ],
  tasks: [
    {
      id: "resolve-campaign",
      title: "Resolve campaign",
      description: "Look up campaign by name or workspace context.",
      agent: "general",
      intent: "general",
      tools: ["getCampaign"],
      readonly: true,
      buildPrompt: (ctx) => {
        const campaignId = ctx.resolvedCampaignId ?? ctx.aiContext.campaign?.id;
        if (campaignId) {
          return `Confirm campaign context for brief generation. Campaign ID: ${campaignId}.`;
        }
        return `Extract campaign name from: "${ctx.userMessage}". Campaign should be resolved by name before brief generation.`;
      },
    },
    {
      id: "gather-context",
      title: "Gather campaign context",
      description: "Load campaign, brand, and client details.",
      agent: "strategist",
      intent: "strategize",
      tools: ["getCampaign", "getClient"],
      readonly: true,
      shouldSkip: (ctx) => !ctx.resolvedCampaignId && !ctx.aiContext.campaign?.id,
      buildPrompt: (ctx) => {
        const id = ctx.resolvedCampaignId ?? ctx.aiContext.campaign?.id;
        return `Load campaign (${id}) and related brand/client context using getCampaign and getClient. Summarize key details for brief writing.`;
      },
    },
    {
      id: "generate-brief",
      title: "Generate creative brief",
      description: "Create structured creative brief with deliverables and guidelines.",
      agent: "strategist",
      intent: "strategize",
      tools: ["generateBrief"],
      readonly: true,
      buildPrompt: (ctx) =>
        `Generate a comprehensive creative brief using generateBrief. Include: campaign overview, objectives, target audience, deliverables, brand guidelines, content requirements, timeline, and approval process.\n\nContext: ${ctx.userMessage}`,
    },
    {
      id: "review-brief",
      title: "Review and finalize",
      description: "Quality check brief completeness.",
      agent: "strategist",
      intent: "strategize",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        `Review the generated brief for completeness. Flag any missing sections and suggest improvements. Present final brief summary.`,
    },
  ],
};
