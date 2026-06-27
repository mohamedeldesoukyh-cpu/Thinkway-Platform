import type { SupabaseClient } from "@supabase/supabase-js";

export {
  bulkUpdateCampaignPublicationStatus,
  deleteCampaignPublicationRow,
  fetchPublicationMetricSyncLogs,
  findCampaignPublicationIdByContentUrl,
  insertCampaignPublications,
  updateCampaignPublicationRow,
} from "./publication-repository";
