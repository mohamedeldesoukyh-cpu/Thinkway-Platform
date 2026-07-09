export { CampaignStudio } from "./components/campaign-studio";
export { CampaignStudioHost } from "@/features/campaign-decision-workspace/components/campaign-studio-host";
export { StudioSectionCard } from "./components/campaign-studio-sections";
export { useCampaignStudio, buildCampaignStudioState } from "./hooks/use-campaign-studio";
export { isCampaignWorkflow, CREATE_CAMPAIGN_WORKFLOW_ID } from "./constants/workflow-ids";
export {
  applyCampaignDirectorContext,
  CAMPAIGN_DIRECTOR_CONFIDENCE_THRESHOLD,
} from "./services/campaign-director";
export type { CampaignDirectorResult } from "./services/campaign-director-context";
export type {
  CampaignStudioSectionId,
  CampaignStudioSectionStatus,
  CampaignStudioSection,
  CampaignStudioState,
  CampaignStudioInput,
  CampaignSpecialistId,
  CampaignSpecialistStatus,
} from "./types/campaign-studio";
