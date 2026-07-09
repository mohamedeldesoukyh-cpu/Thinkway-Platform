import { analyzeCampaignWorkflow } from "./analyze-campaign";
import { buildShortlistWorkflow } from "./build-shortlist";
import { campaignHealthCheckWorkflow } from "./campaign-health-check";
import { createCampaignWorkflow } from "./create-campaign";
import { findCreatorsWorkflow } from "./find-creators";
import { generateBriefWorkflow } from "./generate-brief";
import type { WorkflowDefinition, WorkflowId } from "../types";

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  createCampaignWorkflow,
  findCreatorsWorkflow,
  analyzeCampaignWorkflow,
  generateBriefWorkflow,
  buildShortlistWorkflow,
  campaignHealthCheckWorkflow,
];

export const WORKFLOW_MAP: Record<WorkflowId, WorkflowDefinition> = {
  "create-campaign": createCampaignWorkflow,
  "find-creators": findCreatorsWorkflow,
  "analyze-campaign": analyzeCampaignWorkflow,
  "generate-brief": generateBriefWorkflow,
  "build-shortlist": buildShortlistWorkflow,
  "campaign-health-check": campaignHealthCheckWorkflow,
};

export {
  createCampaignWorkflow,
  findCreatorsWorkflow,
  analyzeCampaignWorkflow,
  generateBriefWorkflow,
  buildShortlistWorkflow,
  campaignHealthCheckWorkflow,
};

export function getWorkflowById(id: WorkflowId): WorkflowDefinition | undefined {
  return WORKFLOW_MAP[id];
}

export function getAllWorkflows(): WorkflowDefinition[] {
  return WORKFLOW_DEFINITIONS;
}
