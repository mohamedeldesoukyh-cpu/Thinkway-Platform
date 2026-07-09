import type { WorkflowDefinition } from "../types";

export const findCreatorsWorkflow: WorkflowDefinition = {
  id: "find-creators",
  name: "Find Creators",
  description: "Search and rank creators matching specific criteria with immediate execution.",
  minConfidence: 75,
  triggerPatterns: [
    /\bfind\s+(?:\w+\s+){0,4}creators?\b/i,
    /\bsearch\s+(?:for\s+)?creators?\b/i,
    /\bdiscover\s+creators?\b/i,
    /\bfind\s+(?:\w+\s+){0,4}influencers?\b/i,
    /\bwho\s+(?:are|can)\s+(?:the\s+)?(?:best|top)\s+creators?\b/i,
    /\bluxury\s+\w+\s+creators?\s+in\s+\w+/i,
  ],
  tasks: [
    {
      id: "parse-criteria",
      title: "Parse search criteria",
      description: "Extract niche, location, platform, and audience filters.",
      agent: "general",
      intent: "general",
      tools: [],
      readonly: true,
      buildPrompt: (ctx) =>
        `Extract creator search criteria from this request: niche/category, geography, platform, follower range, engagement requirements. List extracted filters only — no creator names.\n\nRequest: ${ctx.userMessage}`,
    },
    {
      id: "search-creators",
      title: "Search creators",
      description: "Execute creator search with extracted criteria.",
      agent: "scout",
      intent: "scout",
      tools: ["searchCreators"],
      readonly: true,
      buildPrompt: () =>
        "Execute searchCreators once with structured filters derived from the campaign brief (industry, categories, country, platforms). Do not pass the raw brief as the search string.",
    },
    {
      id: "rank-results",
      title: "Rank and summarize results",
      description: "Rank creators by fit and present operational summary.",
      agent: "scout",
      intent: "scout",
      tools: [],
      readonly: true,
      requiredState: ["searchResults"],
      buildPrompt: (ctx) => {
        const count = Array.isArray(ctx.state.data.searchResults)
          ? ctx.state.data.searchResults.length
          : 0;
        return `Rank ${count} creator(s) from search results by campaign fit, engagement, followers, and niche relevance. Use ONLY creators already in workflow state — do not invent names.\n\nOriginal request: ${ctx.userMessage}`;
      },
    },
    {
      id: "shortlist-option",
      title: "Prepare shortlist option",
      description: "Suggest building a shortlist from results (no approval required).",
      agent: "scout",
      intent: "scout",
      tools: [],
      readonly: true,
      requiredState: ["searchResults"],
      buildPrompt: (ctx) => {
        const count = Array.isArray(ctx.state.data.searchResults)
          ? ctx.state.data.searchResults.length
          : 0;
        return `Prepare a shortlist suggestion from ${count} search result creator(s). Include shortlist name, creator IDs, usernames, and rationale. Use ONLY returned creators — never placeholder names.\n\nRequest: ${ctx.userMessage}`;
      },
    },
  ],
};
