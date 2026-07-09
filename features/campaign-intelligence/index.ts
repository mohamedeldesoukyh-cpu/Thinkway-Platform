export type {
  CampaignObjectLifecycleStatus,
  CampaignObjectRecord,
  CampaignObjectVersionMeta,
  CampaignObjectVersionRow,
  CAMPAIGN_LIFECYCLE_STATUSES,
} from "./types/campaign-lifecycle";

export type {
  CampaignObject,
  CampaignObjectMeta,
  CampaignObjectSections,
  CampaignObjectSnapshot,
  CampaignObjectStatus,
  CampaignSection,
  CampaignSectionKey,
  CampaignSectionStatus,
  CampaignSpecialistId,
  SpecialistProgress,
  SpecialistSectionUpdate,
} from "./types/campaign-object";

export {
  SPECIALIST_SECTION_MAP,
  SPECIALIST_TASK_MAP,
  TASK_SECTION_MAP,
  TASK_SPECIALIST_MAP,
  SUMMARY_SECTION_TO_CAMPAIGN,
  SPECIALIST_LABELS,
  getTaskTitle,
} from "./constants/specialist-section-map";

export {
  attachCampaignObjectToSnapshot,
  clearCampaignObjectMemory,
  CONTEXT_SNAPSHOT_KEY,
  deserializeCampaignObject,
  getCampaignObjectFromSnapshot,
  getOrCreateCampaignObject,
  getOrLoadCampaignObject,
  isAutosaveTaskStatus,
  loadCampaignObjectForConversation,
  saveCampaignObject,
  serializeCampaignObject,
} from "./services/campaign-object-store";

export type { SaveCampaignObjectOptions } from "./services/campaign-object-store";

export {
  applySpecialistUpdate,
  applySummarySectionsToCampaignObject,
  applyTaskResultToCampaignObject,
  buildSpecialistProgress,
  createEmptyCampaignObject,
  resolveCampaignObjectStatus,
  syncCampaignObjectMeta,
  syncSpecialistProgress,
} from "./services/section-updaters";

export {
  CampaignDirector,
  buildCampaignObjectFromWorkflowState,
  processWorkflowForCampaignObject,
} from "./services/campaign-director";

export type { CampaignDirectorPersistOptions } from "./services/campaign-director";

export {
  CampaignObjectPersistenceService,
} from "./services/campaign-object-persistence";

export type {
  SaveCampaignObjectVersionInput,
  SaveCampaignObjectVersionResult,
} from "./services/campaign-object-persistence";

export {
  canTransitionLifecycle,
  isValidLifecycleTransition,
  lifecycleLabel,
} from "./services/campaign-lifecycle";

export { getApprovedSnapshot } from "./services/campaign-export";

export {
  enrichCampaignObjectWithStudioData,
} from "./services/studio-section-data-builders";

export {
  campaignObjectToStudioState,
  summarySectionsToCampaignObjectSections,
} from "./services/studio-renderer";
