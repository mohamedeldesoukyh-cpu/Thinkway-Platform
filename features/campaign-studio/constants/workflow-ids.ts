export const CREATE_CAMPAIGN_WORKFLOW_ID = "create-campaign";

export function isCampaignWorkflow(workflowId?: string): boolean {
  return workflowId === CREATE_CAMPAIGN_WORKFLOW_ID;
}
