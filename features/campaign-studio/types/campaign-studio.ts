import type { WorkflowSummarySection } from "@/features/ai-workflows";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { AiActionCard } from "@/features/ai-workspace/types";

export type CampaignStudioSectionId =
  | "campaign-summary"
  | "executive-strategy"
  | "creator-discovery"
  | "creator-recommendations"
  | "budget-planner"
  | "timeline"
  | "kpi-forecast"
  | "risk-analysis"
  | "creative-concepts"
  | "content-plan"
  | "creator-mix"
  | "why-ai"
  | "industry-benchmark"
  | "success-probability"
  | "opportunity-finder"
  | "executive-summary"
  | "presentation-status";

export type CampaignStudioSectionStatus =
  | "pending"
  | "running"
  | "complete"
  | "blocked";

export type CampaignSpecialistId = "planner" | "strategist" | "scout" | "analyst";

export type CampaignSpecialistStatus = {
  id: CampaignSpecialistId;
  label: string;
  status: "idle" | "working" | "complete";
  currentTask?: string;
};

export type CampaignStudioSection = {
  id: CampaignStudioSectionId;
  title: string;
  status: CampaignStudioSectionStatus;
  content: string;
  taskIds: string[];
  agentId?: string;
};

export type CampaignStudioState = {
  workflowId: string;
  workflowName: string;
  workflowStatus: string;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  specialists: CampaignSpecialistStatus[];
  sections: CampaignStudioSection[];
  /** Canonical object for structured section rendering. */
  campaignObject?: CampaignObject;
  clarificationQuestion?: string;
  inferredFields?: string[];
  actionCards?: AiActionCard[];
};

export type CampaignStudioInput = {
  workflowId?: string;
  workflowName?: string;
  workflowStatus?: string;
  currentStep?: number;
  totalSteps?: number;
  progressPercent?: number;
  taskId?: string;
  taskTitle?: string;
  taskStatus?: string;
  summarySections?: WorkflowSummarySection[];
  /** Canonical campaign object — preferred over summarySections when present. */
  campaignObject?: CampaignObject;
  clarificationQuestion?: string;
  completedTasks?: string[];
  pendingTasks?: string[];
  inferredFields?: string[];
  actionCards?: AiActionCard[];
};

export const CAMPAIGN_STUDIO_SECTION_DEFS: Array<{
  id: CampaignStudioSectionId;
  title: string;
  taskIds: string[];
  summaryIds: string[];
}> = [
  {
    id: "campaign-summary",
    title: "Campaign Summary",
    taskIds: ["analyze-request", "generate-brief"],
    summaryIds: ["campaign-brief"],
  },
  {
    id: "executive-strategy",
    title: "Executive Strategy",
    taskIds: ["build-strategy"],
    summaryIds: ["campaign-strategy"],
  },
  {
    id: "creator-discovery",
    title: "Vendor Discovery",
    taskIds: ["search-creators"],
    summaryIds: ["creator-discovery"],
  },
  {
    id: "creator-recommendations",
    title: "Vendor Recommendations",
    taskIds: ["build-shortlist"],
    summaryIds: ["creator-recommendations"],
  },
  {
    id: "budget-planner",
    title: "Budget Planner",
    taskIds: ["estimate-budget"],
    summaryIds: ["budget"],
  },
  {
    id: "timeline",
    title: "Timeline",
    taskIds: ["generate-timeline"],
    summaryIds: ["timeline"],
  },
  {
    id: "kpi-forecast",
    title: "KPI Forecast",
    taskIds: ["build-strategy"],
    summaryIds: ["campaign-strategy"],
  },
  {
    id: "risk-analysis",
    title: "Risk Analysis",
    taskIds: ["build-strategy", "estimate-budget"],
    summaryIds: ["campaign-strategy", "budget"],
  },
  {
    id: "creative-concepts",
    title: "Creative Concepts",
    taskIds: ["build-strategy", "generate-brief"],
    summaryIds: ["campaign-strategy", "campaign-brief"],
  },
  {
    id: "content-plan",
    title: "Content Plan",
    taskIds: ["build-strategy", "generate-timeline"],
    summaryIds: ["campaign-strategy", "timeline"],
  },
  {
    id: "creator-mix",
    title: "Creator Mix",
    taskIds: ["build-strategy", "search-creators"],
    summaryIds: ["campaign-strategy", "creator-discovery"],
  },
  {
    id: "why-ai",
    title: "Director Decision Minutes",
    taskIds: ["analyze-request", "build-strategy"],
    summaryIds: ["campaign-strategy", "campaign-brief"],
  },
  {
    id: "industry-benchmark",
    title: "Industry Benchmark",
    taskIds: ["build-strategy", "estimate-budget"],
    summaryIds: ["campaign-strategy", "budget"],
  },
  {
    id: "success-probability",
    title: "Success Probability",
    taskIds: ["build-strategy", "estimate-budget"],
    summaryIds: ["campaign-strategy", "budget"],
  },
  {
    id: "opportunity-finder",
    title: "Strategic Opportunities",
    taskIds: ["build-strategy", "search-creators"],
    summaryIds: ["campaign-strategy", "creator-discovery"],
  },
  {
    id: "executive-summary",
    title: "Executive Summary",
    taskIds: ["prepare-approval", "build-strategy"],
    summaryIds: ["campaign-strategy", "approval"],
  },
  {
    id: "presentation-status",
    title: "Presentation Status",
    taskIds: ["prepare-approval"],
    summaryIds: ["approval"],
  },
];

export const SPECIALIST_TASK_MAP: Record<CampaignSpecialistId, string[]> = {
  planner: ["analyze-request", "generate-timeline"],
  strategist: ["build-strategy", "generate-brief", "prepare-approval"],
  scout: ["search-creators", "build-shortlist"],
  analyst: ["estimate-budget"],
};

export const SPECIALIST_LABELS: Record<CampaignSpecialistId, string> = {
  planner: "Campaign Planner",
  strategist: "Strategist",
  scout: "Scout",
  analyst: "Analyst",
};
