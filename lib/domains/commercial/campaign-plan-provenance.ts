import type { CampaignObjectLifecycleStatus } from "@/types/database";

/**
 * Business term: Campaign Plan — the approved planning SSOT stored as
 * `campaign_objects` (+ versioned snapshots in `campaign_object_versions`).
 * Media Plan, Timeline, and Strategy are sections/outputs of the Campaign Plan.
 */
export type CampaignPlanProvenance = {
  campaignObjectId: string;
  /** Monotonic version from campaign_object_versions when a generator ran. */
  sourceCampaignObjectVersion: number | null;
};

export type CampaignPlanProvenanceInput = {
  campaign_object_id?: string | null;
  source_campaign_object_version?: number | null;
};

/** Maps DB row fields to a normalized provenance object. */
export function parseCampaignPlanProvenance(
  row: CampaignPlanProvenanceInput | null | undefined
): CampaignPlanProvenance | null {
  const campaignObjectId = row?.campaign_object_id?.trim();
  if (!campaignObjectId) return null;
  const version = row?.source_campaign_object_version;
  return {
    campaignObjectId,
    sourceCampaignObjectVersion:
      version != null && Number.isFinite(version) ? Math.floor(version) : null,
  };
}

/** Campaign Plan approval gate — lifecycle on campaign_objects, not Timeline alone. */
export function isCampaignPlanApproved(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined
): boolean {
  return lifecycleStatus === "approved" || lifecycleStatus === "published";
}

/** Whether a generator may read this Campaign Plan as its source. */
export function canGenerateFromCampaignPlan(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined
): boolean {
  return isCampaignPlanApproved(lifecycleStatus);
}
