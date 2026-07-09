import type { CampaignSectionKey, CampaignSpecialistId } from "../types/campaign-object";

/** Which campaign object sections each specialist owns. */
export const SPECIALIST_SECTION_MAP: Record<CampaignSpecialistId, CampaignSectionKey[]> = {
  strategist: ["strategy", "presentation"],
  scout: ["creators"],
  planner: ["summary", "audience", "timeline"],
  analyst: ["budget", "performance", "operations"],
};

/** Workflow task → owning specialist. */
export const TASK_SPECIALIST_MAP: Record<string, CampaignSpecialistId> = {
  "analyze-request": "planner",
  "build-strategy": "strategist",
  "estimate-budget": "analyst",
  "search-creators": "scout",
  "build-shortlist": "scout",
  "generate-brief": "strategist",
  "generate-timeline": "planner",
  "prepare-approval": "strategist",
};

/**
 * Workflow task → campaign object sections updated by that task.
 * Each section is owned by exactly one task (single responsibility).
 */
export const TASK_SECTION_MAP: Record<string, CampaignSectionKey[]> = {
  "analyze-request": ["summary", "audience"],
  "build-strategy": ["strategy", "performance"],
  "estimate-budget": ["budget", "operations"],
  "search-creators": ["creators"],
  "build-shortlist": ["creators"],
  "generate-brief": ["summary"],
  "generate-timeline": ["timeline"],
  "prepare-approval": ["presentation"],
};

/** Aggregated workflow summary section → campaign object section. */
export const SUMMARY_SECTION_TO_CAMPAIGN: Record<string, CampaignSectionKey[]> = {
  "campaign-brief": ["summary"],
  "campaign-strategy": ["strategy", "performance"],
  budget: ["budget", "operations"],
  timeline: ["timeline"],
  "creator-discovery": ["creators"],
  "creator-recommendations": ["creators"],
  approval: ["presentation"],
};

export const SPECIALIST_LABELS: Record<CampaignSpecialistId, string> = {
  planner: "Campaign Planner",
  strategist: "Strategist",
  scout: "Scout",
  analyst: "Analyst",
};

export const SPECIALIST_TASK_MAP: Record<CampaignSpecialistId, string[]> = {
  planner: ["analyze-request", "generate-timeline"],
  strategist: ["build-strategy", "generate-brief", "prepare-approval"],
  scout: ["search-creators", "build-shortlist"],
  analyst: ["estimate-budget"],
};

const TASK_ID_TO_TITLE: Record<string, string> = {
  "analyze-request": "Analyze request",
  "build-strategy": "Build campaign strategy",
  "estimate-budget": "Estimate campaign budget",
  "search-creators": "Search creators",
  "build-shortlist": "Build recommended shortlist",
  "generate-brief": "Generate campaign brief",
  "generate-timeline": "Generate timeline",
  "prepare-approval": "Prepare approval action",
};

export function getTaskTitle(taskId: string): string {
  return TASK_ID_TO_TITLE[taskId] ?? taskId;
}
