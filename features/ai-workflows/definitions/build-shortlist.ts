import type { WorkflowDefinition } from "../types";

export const buildShortlistWorkflow: WorkflowDefinition = {
  id: "build-shortlist",
  name: "Build Shortlist",
  description: "Curate and create a creator shortlist from search results or selections.",
  minConfidence: 70,
  triggerPatterns: [
    /\bbuild\s+(?:a\s+)?shortlist\b/i,
    /\bcreate\s+(?:a\s+)?shortlist\b/i,
    /\bshortlist\s+(?:creators?|influencers?|from)\b/i,
    /\badd\s+(?:to|creators?\s+to)\s+(?:a\s+)?shortlist\b/i,
    /\btop\s+creators?\s+(?:to|for)\s+shortlist\b/i,
  ],
  tasks: [
    {
      id: "identify-creators",
      title: "Identify creators",
      description: "Find creators from context, search, or user selection.",
      agent: "scout",
      intent: "scout",
      tools: ["searchCreators", "getShortlist"],
      readonly: true,
      buildPrompt: (ctx) => {
        const shortlistId = ctx.aiContext.shortlist?.id;
        if (shortlistId) {
          return `Load existing shortlist ${shortlistId} using getShortlist. Summarize current roster from tool output only.`;
        }
        return "Search for creators matching the user's request. Execute searchCreators.";
      },
    },
    {
      id: "curate-selection",
      title: "Curate selection",
      description: "Rank and select top creators for shortlist.",
      agent: "scout",
      intent: "scout",
      tools: [],
      readonly: true,
      requiredState: ["searchResults"],
      buildPrompt: (ctx) => {
        const count = Array.isArray(ctx.state.data.searchResults)
          ? ctx.state.data.searchResults.length
          : 0;
        return `Rank ${count} creator(s) from search results for shortlist curation. Target 5–15 creators. Use ONLY returned creator IDs and handles — no invented names.\n\nRequest: ${ctx.userMessage}`;
      },
    },
    {
      id: "create-shortlist",
      title: "Create shortlist",
      description: "Prepare shortlist creation for approval.",
      agent: "scout",
      intent: "scout",
      tools: ["createShortlist"],
      readonly: false,
      requiresApproval: true,
      approvalTool: "createShortlist",
      requiredState: ["searchResults"],
      buildPrompt: (ctx) =>
        `Prepare shortlist creation with real creator IDs from search results. Suggest a descriptive name based on search criteria.\n\nRequest: ${ctx.userMessage}`,
    },
  ],
};
