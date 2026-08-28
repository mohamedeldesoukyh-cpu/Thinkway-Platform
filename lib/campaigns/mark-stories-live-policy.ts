import { assignmentChildTypeLabelBesidePlatform } from "@/lib/campaigns/hierarchy-utils";
import { isEphemeralStoryDeliverableType } from "@/lib/campaigns/deliverable-taxonomy";

const STORY_LIVE_STATUSES = new Set(["posted", "published", "live", "verified"]);

export type CampaignStoryPostCandidate = {
  id: string;
  campaignLineId: string;
  assignmentDeliverableId: string;
  sequenceNumber: number;
  liveDate: string | null;
  status: string;
  alreadyLive: boolean;
  hasScreenshot: boolean;
  publicationId: string | null;
  platform: string;
  deliverableType: string;
  label: string;
};

export function dateOnlyYmd(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const day = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function todayYmd(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultStoryWentLiveDate(
  scheduledLiveDate: string | null | undefined,
  today = todayYmd()
): string {
  return dateOnlyYmd(scheduledLiveDate) ?? today;
}

export function isStoryWorkflowLive(status: string | null | undefined): boolean {
  return STORY_LIVE_STATUSES.has((status ?? "").trim().toLowerCase());
}

export function storyPostLabel(deliverableType: string, sequenceNumber: number): string {
  const typeLabel = assignmentChildTypeLabelBesidePlatform(deliverableType);
  return sequenceNumber > 0 ? `${typeLabel} ${sequenceNumber}` : typeLabel;
}

export function decideStoryLiveWrite(input: {
  deliverableType: string;
  postStatus: string | null | undefined;
  existingPublicationId: string | null;
}): {
  eligible: boolean;
  markPosted: boolean;
  insertPublication: boolean;
} {
  if (!isEphemeralStoryDeliverableType(input.deliverableType)) {
    return { eligible: false, markPosted: false, insertPublication: false };
  }
  const alreadyLive = isStoryWorkflowLive(input.postStatus);
  return {
    eligible: true,
    markPosted: !alreadyLive,
    insertPublication: !input.existingPublicationId,
  };
}
