export const CAMPAIGN_STUDIO_COPY = {
  studioLabel: "Campaign Studio",
  building: "Campaign Studio is building your plan.",
  ready: "Campaign plan ready — review each section and approve the draft.",
  approvalRequired: "Campaign draft — approval required",
  inputRequired: "Input required",
  autoInferred: "Auto-inferred",
} as const;

/** Specialist loading messages shown while a section is pending or running. */
export const SECTION_LOADING_MESSAGES: Partial<
  Record<
    import("../types/campaign-studio").CampaignStudioSectionId,
    { specialist: string; message: string }
  >
> = {
  "campaign-summary": {
    specialist: "Campaign Director",
    message: "Understanding campaign…",
  },
  "executive-strategy": {
    specialist: "Strategist",
    message: "Building strategy…",
  },
  "creative-concepts": {
    specialist: "Strategist",
    message: "Building strategy…",
  },
  "why-ai": {
    specialist: "Strategist",
    message: "Building Thinkway rationale…",
  },
  "opportunity-finder": {
    specialist: "Strategist",
    message: "Building strategy…",
  },
  "creator-discovery": {
    specialist: "Scout",
    message: "Searching creators…",
  },
  "creator-recommendations": {
    specialist: "Scout",
    message: "Searching creators…",
  },
  "creator-mix": {
    specialist: "Scout",
    message: "Searching creators…",
  },
  "timeline": {
    specialist: "Planner",
    message: "Building timeline…",
  },
  "content-plan": {
    specialist: "Planner",
    message: "Building timeline…",
  },
  "budget-planner": {
    specialist: "Finance Analyst",
    message: "Optimizing budget…",
  },
  "kpi-forecast": {
    specialist: "Finance Analyst",
    message: "Optimizing budget…",
  },
  "risk-analysis": {
    specialist: "Finance Analyst",
    message: "Optimizing budget…",
  },
  "industry-benchmark": {
    specialist: "Finance Analyst",
    message: "Optimizing budget…",
  },
  "success-probability": {
    specialist: "Finance Analyst",
    message: "Optimizing budget…",
  },
  "executive-summary": {
    specialist: "Strategist",
    message: "Building strategy…",
  },
  "presentation-status": {
    specialist: "Strategist",
    message: "Building strategy…",
  },
};
