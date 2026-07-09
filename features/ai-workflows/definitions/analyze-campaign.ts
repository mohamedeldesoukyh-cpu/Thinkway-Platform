import type { WorkflowDefinition } from "../types";

export const analyzeCampaignWorkflow: WorkflowDefinition = {
  id: "analyze-campaign",
  name: "Analyze Campaign",
  description: "Deep-dive campaign performance analysis with risks and optimization recommendations.",
  minConfidence: 70,
  triggerPatterns: [
    /\banaly[sz]e\s+(?:this\s+)?campaign\b/i,
    /\bcampaign\s+(?:performance|analysis|metrics)\b/i,
    /\bhow\s+(?:is|are)\s+(?:my|the|this)\s+campaign\s+(?:performing|doing)\b/i,
    /\bwhy\s+did\s+(?:engagement|reach|performance)\b/i,
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
      requiredState: [],
      buildPrompt: (ctx) => {
        const campaignId = ctx.resolvedCampaignId ?? ctx.aiContext.campaign?.id;
        const campaignName = ctx.resolvedCampaignName ?? ctx.aiContext.campaign?.name;
        if (campaignId) {
          return `Load campaign ${campaignName ?? campaignId} using getCampaign (ID: ${campaignId}). Confirm campaign details.`;
        }
        return `The user wants to analyze a campaign. Campaign name from request: "${extractCampaignName(ctx.userMessage) ?? "unknown"}". Note that campaign lookup should happen via name search.`;
      },
    },
    {
      id: "load-data",
      title: "Load campaign data",
      description: "Fetch campaign metrics, lines, and assignments.",
      agent: "analyst",
      intent: "analyze",
      tools: ["getCampaign"],
      readonly: true,
      shouldSkip: (ctx) => !ctx.resolvedCampaignId && !ctx.aiContext.campaign?.id,
      buildPrompt: (ctx) => {
        const id = ctx.resolvedCampaignId ?? ctx.aiContext.campaign?.id;
        return `Load full campaign data for ID ${id} using getCampaign. Summarize key metrics: revenue, cost, GP, margin, line count, assignment count.`;
      },
    },
    {
      id: "performance-analysis",
      title: "Performance analysis",
      description: "Analyze engagement, reach, and ROI trends.",
      agent: "analyst",
      intent: "analyze",
      tools: ["generateReport"],
      readonly: true,
      buildPrompt: (ctx) =>
        `Analyze campaign performance. Identify trends, anomalies, and KPI attainment. Use generateReport if campaign data is available.\n\nFocus: ${ctx.userMessage}`,
    },
    {
      id: "risk-assessment",
      title: "Risk assessment",
      description: "Identify risks, blockers, and delivery issues.",
      agent: "analyst",
      intent: "analyze",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        `Assess campaign risks: delivery delays, budget overruns, underperforming lines, vendor issues. Rate severity (high/medium/low).`,
    },
    {
      id: "recommendations",
      title: "Optimization recommendations",
      description: "Actionable recommendations for campaign improvement.",
      agent: "analyst",
      intent: "analyze",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        `Provide 3-5 actionable optimization recommendations for this campaign. Each recommendation should be specific and operational.`,
    },
  ],
};

function extractCampaignName(message: string): string | undefined {
  const patterns = [
    /(?:analyze|review|check)\s+(?:campaign\s+)?["']?([^"'.!?]+?)["']?(?:\s+campaign|\s*$|[.,!?])/i,
    /campaign\s+["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}
