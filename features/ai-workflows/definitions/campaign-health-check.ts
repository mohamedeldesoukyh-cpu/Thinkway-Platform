import type { WorkflowDefinition } from "../types";

export const campaignHealthCheckWorkflow: WorkflowDefinition = {
  id: "campaign-health-check",
  name: "Campaign Health Check",
  description: "Operational health scan: delivery status, budget, timeline, and blockers.",
  minConfidence: 70,
  triggerPatterns: [
    /\b(?:campaign\s+)?health\s+check\b/i,
    /\bhealth\s+(?:of|for|check)\s+(?:my|the|this)\s+campaign\b/i,
    /\bcampaign\s+status\s+(?:check|report|update)\b/i,
    /\bhow\s+(?:healthy|is)\s+(?:my|the|this)\s+campaign\b/i,
    /\bcheck\s+campaign\s+(?:health|status)\b/i,
    /\bany\s+(?:issues|blockers|problems)\s+(?:with|in)\s+(?:my|the|this)\s+campaign\b/i,
    /\brun\s+(?:a\s+)?campaign\s+health\b/i,
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
          return `Campaign resolved: ${ctx.resolvedCampaignName ?? campaignId}. Proceed with health check.`;
        }
        return `Resolve campaign from request: "${ctx.userMessage}". Search by campaign name first.`;
      },
    },
    {
      id: "load-campaign",
      title: "Load campaign workspace",
      description: "Fetch campaign header, lines, and assignments.",
      agent: "analyst",
      intent: "analyze",
      tools: ["getCampaign"],
      readonly: true,
      shouldSkip: (ctx) => !ctx.resolvedCampaignId && !ctx.aiContext.campaign?.id,
      buildPrompt: (ctx) => {
        const id = ctx.resolvedCampaignId ?? ctx.aiContext.campaign?.id;
        return `Load campaign workspace for ${id} using getCampaign. Report: status, line count, total revenue/cost/GP, assignment count.`;
      },
    },
    {
      id: "delivery-status",
      title: "Check delivery status",
      description: "Review deliverable completion and vendor progress.",
      agent: "analyst",
      intent: "analyze",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        `Assess delivery status: completed vs pending deliverables, overdue items, vendor response rates. Flag any red flags.`,
    },
    {
      id: "budget-timeline",
      title: "Budget & timeline check",
      description: "Compare actuals vs plan for budget and schedule.",
      agent: "analyst",
      intent: "analyze",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        `Check budget health: PO utilization, remaining budget, margin vs target. Check timeline: milestones on track or delayed.`,
    },
    {
      id: "health-summary",
      title: "Health summary",
      description: "Overall health score with action items.",
      agent: "analyst",
      intent: "analyze",
      tools: ["generateReport"],
      readonly: true,
      buildPrompt: (ctx) =>
        `Generate campaign health summary with overall score (green/yellow/red), top 3 issues, and recommended next actions. Use generateReport if data available.`,
    },
  ],
};
