import { deliverableTypeShortLabel, getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { parseLineAssignment } from "@/lib/campaigns/line-assignment";

import { deliverablesLabel } from "./deliverables";
import type { ClientCreatorCard } from "./types";

export const CLIENT_CAMPAIGN_POST_STATUSES = [
  "scheduling",
  "scheduled",
  "due_today",
  "overdue",
  "live",
] as const;

export type ClientCampaignPostStatus = (typeof CLIENT_CAMPAIGN_POST_STATUSES)[number];

export const CLIENT_CAMPAIGN_POST_STATUS_LABEL: Record<ClientCampaignPostStatus, string> = {
  scheduling: "To be scheduled",
  scheduled: "Scheduled",
  due_today: "Due today",
  overdue: "Overdue",
  live: "Live",
};

const LIVE_POST_STATUSES = new Set(["posted", "verified", "published", "live"]);

export type ClientCampaignPostRow = {
  id: string;
  creatorName: string;
  platform: string;
  platformLabel: string;
  deliverable: string;
  scheduledDate: string | null;
  status: ClientCampaignPostStatus;
  live: boolean;
  publicationDate: string | null;
  contentUrl: string | null;
};

export type ClientCampaignExecution = {
  campaignHeaderId: string | null;
  posts: ClientCampaignPostRow[];
};

export type ClientCampaignViewKind = "needs_quotation_approval" | "setting_up" | "in_campaign";

export function emptyClientCampaignExecution(): ClientCampaignExecution {
  return { campaignHeaderId: null, posts: [] };
}

export function clientCampaignViewKind(input: {
  commerciallyApproved: boolean;
  campaignStarted: boolean;
}): ClientCampaignViewKind {
  if (input.campaignStarted) return "in_campaign";
  if (input.commerciallyApproved) return "setting_up";
  return "needs_quotation_approval";
}

export function todayYmd(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnly(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

export function formatClientScheduleDate(value: string | null | undefined): string | null {
  const day = dateOnly(value);
  if (!day) return null;
  const parsed = new Date(`${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function isClientCampaignLive(input: {
  postStatus?: string | null;
  contentUrl?: string | null;
  publicationDate?: string | null;
}): boolean {
  if (input.postStatus && LIVE_POST_STATUSES.has(input.postStatus.trim().toLowerCase())) return true;
  if (input.contentUrl?.trim()) return true;
  return Boolean(dateOnly(input.publicationDate));
}

export function clientCampaignPostStatus(input: {
  scheduledDate?: string | null;
  postStatus?: string | null;
  contentUrl?: string | null;
  publicationDate?: string | null;
  today?: string;
}): ClientCampaignPostStatus {
  if (
    isClientCampaignLive({
      postStatus: input.postStatus,
      contentUrl: input.contentUrl,
      publicationDate: input.publicationDate,
    })
  ) {
    return "live";
  }
  const scheduled = dateOnly(input.scheduledDate);
  if (!scheduled) return "scheduling";
  const today = input.today ?? todayYmd();
  if (scheduled < today) return "overdue";
  if (scheduled === today) return "due_today";
  return "scheduled";
}

export type CampaignExecutionSource = {
  lines: Array<{ id: string; name: string; metadata?: Record<string, unknown> | null }>;
  influencers: Array<{ campaignLineId: string | null; displayName: string }>;
  deliverables: Array<{
    id: string;
    campaignLineId: string;
    platform: string;
    deliverableType: string;
    quantity: number;
    liveDate: string | null;
  }>;
  posts: Array<{
    id: string;
    assignmentDeliverableId: string;
    campaignLineId: string;
    sequenceNumber: number;
    liveDate: string | null;
    status: string;
    proofUrl: string | null;
  }>;
  publications: Array<{
    id: string;
    assignmentDeliverableId: string | null;
    assignmentPostScheduleId: string | null;
    campaignLineId: string | null;
    platform: string | null;
    contentUrl: string | null;
    publicationDate: string | null;
    status: string | null;
  }>;
};

export function projectClientCampaignExecution(
  campaignHeaderId: string,
  source: CampaignExecutionSource,
  today = todayYmd()
): ClientCampaignExecution {
  const creatorByLine = new Map<string, string>();
  for (const line of source.lines) {
    const fromMeta = parseLineAssignment(line.metadata ?? null)?.influencer_name?.trim();
    creatorByLine.set(line.id, fromMeta || line.name.trim() || "Creator");
  }
  for (const row of source.influencers) {
    if (!row.campaignLineId || !row.displayName.trim()) continue;
    creatorByLine.set(row.campaignLineId, row.displayName.trim());
  }

  const deliverableById = new Map(source.deliverables.map((row) => [row.id, row]));
  const pubsByPost = new Map<string, CampaignExecutionSource["publications"][number]>();
  const pubsByDeliverable = new Map<string, CampaignExecutionSource["publications"][number]>();
  for (const publication of source.publications) {
    if (publication.assignmentPostScheduleId && !pubsByPost.has(publication.assignmentPostScheduleId)) {
      pubsByPost.set(publication.assignmentPostScheduleId, publication);
    }
    if (publication.assignmentDeliverableId && !pubsByDeliverable.has(publication.assignmentDeliverableId)) {
      pubsByDeliverable.set(publication.assignmentDeliverableId, publication);
    }
  }

  const posts: ClientCampaignPostRow[] = [];
  const postedDeliverableIds = new Set<string>();

  const sortedPosts = [...source.posts].sort((left, right) => {
    const line = left.campaignLineId.localeCompare(right.campaignLineId);
    if (line !== 0) return line;
    return left.sequenceNumber - right.sequenceNumber;
  });

  for (const post of sortedPosts) {
    postedDeliverableIds.add(post.assignmentDeliverableId);
    const deliverable = deliverableById.get(post.assignmentDeliverableId);
    const publication = pubsByPost.get(post.id) ?? pubsByDeliverable.get(post.assignmentDeliverableId);
    const platform = deliverable?.platform || publication?.platform || "";
    const type = deliverable?.deliverableType || "other";
    const contentUrl = publication?.contentUrl?.trim() || post.proofUrl?.trim() || null;
    posts.push(
      buildPostRow({
        id: post.id,
        creatorName: creatorByLine.get(post.campaignLineId) ?? "Creator",
        platform,
        deliverable: deliverableTypeShortLabel(type),
        scheduledDate: post.liveDate ?? deliverable?.liveDate ?? null,
        postStatus: post.status,
        contentUrl,
        publicationDate: publication?.publicationDate ?? null,
        today,
      })
    );
  }

  for (const deliverable of source.deliverables) {
    if (postedDeliverableIds.has(deliverable.id)) continue;
    const publication = pubsByDeliverable.get(deliverable.id);
    const quantity = deliverable.quantity > 1 ? ` × ${deliverable.quantity}` : "";
    posts.push(
      buildPostRow({
        id: deliverable.id,
        creatorName: creatorByLine.get(deliverable.campaignLineId) ?? "Creator",
        platform: deliverable.platform,
        deliverable: `${deliverableTypeShortLabel(deliverable.deliverableType)}${quantity}`,
        scheduledDate: deliverable.liveDate,
        postStatus: publication?.status ?? null,
        contentUrl: publication?.contentUrl ?? null,
        publicationDate: publication?.publicationDate ?? null,
        today,
      })
    );
  }

  posts.sort((left, right) => {
    const leftDate = left.scheduledDate ?? "9999-12-31";
    const rightDate = right.scheduledDate ?? "9999-12-31";
    return leftDate.localeCompare(rightDate) || left.creatorName.localeCompare(right.creatorName);
  });

  return { campaignHeaderId, posts };
}

export function campaignRosterFallback(
  creators: Array<Pick<ClientCreatorCard, "creatorId" | "displayName" | "platform" | "deliverableItems" | "deliverables">>,
  today = todayYmd()
): ClientCampaignPostRow[] {
  return creators.map((creator) => {
    const deliverable = deliverablesLabel(creator.deliverableItems, creator.deliverables);
    const platform = creator.platform ?? creator.deliverableItems?.[0]?.platform ?? "";
    return buildPostRow({
      id: `roster:${creator.creatorId}`,
      creatorName: creator.displayName,
      platform,
      deliverable,
      scheduledDate: null,
      today,
    });
  });
}

function buildPostRow(input: {
  id: string;
  creatorName: string;
  platform: string;
  deliverable: string;
  scheduledDate: string | null;
  postStatus?: string | null;
  contentUrl?: string | null;
  publicationDate?: string | null;
  today: string;
}): ClientCampaignPostRow {
  const status = clientCampaignPostStatus({
    scheduledDate: input.scheduledDate,
    postStatus: input.postStatus,
    contentUrl: input.contentUrl,
    publicationDate: input.publicationDate,
    today: input.today,
  });
  return {
    id: input.id,
    creatorName: input.creatorName,
    platform: input.platform,
    platformLabel: input.platform ? getPlatformOptionLabel(input.platform) : "",
    deliverable: input.deliverable,
    scheduledDate: dateOnly(input.scheduledDate),
    status,
    live: status === "live",
    publicationDate: dateOnly(input.publicationDate),
    contentUrl: input.contentUrl?.trim() || null,
  };
}
