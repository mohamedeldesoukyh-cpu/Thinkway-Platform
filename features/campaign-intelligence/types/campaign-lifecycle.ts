import type { CampaignObject, CampaignObjectSnapshot } from "./campaign-object";

export type CampaignObjectLifecycleStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "archived"
  | "published";

export const CAMPAIGN_LIFECYCLE_STATUSES: CampaignObjectLifecycleStatus[] = [
  "draft",
  "in_review",
  "approved",
  "archived",
  "published",
];

export type CampaignObjectVersionMeta = {
  id: string;
  campaignObjectId: string;
  version: number;
  workflowId?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
};

export type CampaignObjectRecord = {
  id: string;
  conversationId: string;
  campaignHeaderId?: string | null;
  workflowId?: string | null;
  lifecycleStatus: CampaignObjectLifecycleStatus;
  currentVersion: number;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignObjectVersionRow = CampaignObjectVersionMeta & {
  snapshot: CampaignObjectSnapshot;
  campaignObject: CampaignObject;
};
