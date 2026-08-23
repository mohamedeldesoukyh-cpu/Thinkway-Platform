import { deliverableTypeShortLabel, getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { parseLineAssignment } from "@/lib/campaigns/line-assignment";

import { deliverablesLabel } from "./deliverables";
import {
  DATA_NOT_AVAILABLE,
  formatCompactCount,
  formatEngagementPct,
} from "./format";
import type { ClientCreatorCard } from "./types";

export const CLIENT_CAMPAIGN_POST_STATUSES = [
  "scheduling",
  "scheduled",
  "due_today",
  "overdue",
  "live",
  "completed",
] as const;

export type ClientCampaignPostStatus = (typeof CLIENT_CAMPAIGN_POST_STATUSES)[number];

export const CLIENT_CAMPAIGN_POST_STATUS_LABEL: Record<ClientCampaignPostStatus, string> = {
  scheduling: "To be confirmed",
  scheduled: "Scheduled",
  due_today: "Due today",
  overdue: "Overdue",
  live: "Live",
  completed: "Completed",
};

export const CLIENT_CAMPAIGN_POST_GROUPS = ["upcoming", "overdue", "live", "completed"] as const;

export type ClientCampaignPostGroupId = (typeof CLIENT_CAMPAIGN_POST_GROUPS)[number];

export const CLIENT_CAMPAIGN_POST_GROUP_LABEL: Record<ClientCampaignPostGroupId, string> = {
  upcoming: "Upcoming",
  overdue: "Overdue",
  live: "Live",
  completed: "Completed",
};

const LIVE_POST_STATUSES = new Set(["posted", "published", "live"]);
const COMPLETED_POST_STATUSES = new Set(["verified"]);
const HIDDEN_POST_STATUSES = new Set(["cancelled"]);

export type ClientCampaignPerformance = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  impressions: number | null;
  engagementRate: number | null;
};

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
  performance: ClientCampaignPerformance;
};

export type ClientCampaignExecution = {
  campaignHeaderId: string | null;
  posts: ClientCampaignPostRow[];
};

export type ClientCampaignViewKind = "needs_quotation_approval" | "setting_up" | "in_campaign";

export type ClientCampaignPostGroup = {
  id: ClientCampaignPostGroupId;
  label: string;
  posts: ClientCampaignPostRow[];
};

export function emptyClientCampaignPerformance(): ClientCampaignPerformance {
  return {
    views: null,
    likes: null,
    comments: null,
    shares: null,
    reach: null,
    impressions: null,
    engagementRate: null,
  };
}

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

/** Client dashboard date, e.g. `25 Aug`. */
export function formatClientDashboardDate(value: string | null | undefined): string | null {
  const day = dateOnly(value);
  if (!day) return null;
  const parsed = new Date(`${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function normalizedStatus(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

export function shouldHideClientCampaignPost(postStatus?: string | null): boolean {
  return HIDDEN_POST_STATUSES.has(normalizedStatus(postStatus));
}

export function isClientCampaignCompleted(postStatus?: string | null): boolean {
  return COMPLETED_POST_STATUSES.has(normalizedStatus(postStatus));
}

export function isClientCampaignLive(input: {
  postStatus?: string | null;
  contentUrl?: string | null;
  publicationDate?: string | null;
}): boolean {
  if (isClientCampaignCompleted(input.postStatus)) return false;
  if (LIVE_POST_STATUSES.has(normalizedStatus(input.postStatus))) return true;
  if (input.contentUrl?.trim()) return true;
  return Boolean(dateOnly(input.publicationDate));
}

export function clientCampaignPostStatus(input: {
  scheduledDate?: string | null;
  postStatus?: string | null;
  contentUrl?: string | null;
  publicationDate?: string | null;
  today?: string;
}): ClientCampaignPostStatus | null {
  if (shouldHideClientCampaignPost(input.postStatus)) return null;
  if (isClientCampaignCompleted(input.postStatus)) return "completed";
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

export function clientCampaignPostGroupId(
  status: ClientCampaignPostStatus
): ClientCampaignPostGroupId {
  if (status === "overdue") return "overdue";
  if (status === "live") return "live";
  if (status === "completed") return "completed";
  return "upcoming";
}

export function groupClientCampaignPosts(posts: ClientCampaignPostRow[]): ClientCampaignPostGroup[] {
  const buckets: Record<ClientCampaignPostGroupId, ClientCampaignPostRow[]> = {
    upcoming: [],
    overdue: [],
    live: [],
    completed: [],
  };
  for (const post of posts) {
    buckets[clientCampaignPostGroupId(post.status)].push(post);
  }
  return CLIENT_CAMPAIGN_POST_GROUPS.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: CLIENT_CAMPAIGN_POST_GROUP_LABEL[id],
    posts: buckets[id],
  }));
}

export function clientCampaignGlanceCounts(posts: ClientCampaignPostRow[]): {
  upcoming: number;
  overdue: number;
  live: number;
  completed: number;
} {
  return {
    upcoming: posts.filter((row) => clientCampaignPostGroupId(row.status) === "upcoming").length,
    overdue: posts.filter((row) => row.status === "overdue").length,
    live: posts.filter((row) => row.status === "live").length,
    completed: posts.filter((row) => row.status === "completed").length,
  };
}

function realStoredMetric(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Prefer stored actuals. Forecast-only values stay unavailable. */
export function preferActualCampaignMetric(input: {
  actual?: number | null;
  stored?: number | null;
  forecast?: number | null;
  source?: string | null;
}): number | null {
  const actual = realStoredMetric(input.actual);
  if (actual != null) return actual;
  if (normalizedStatus(input.source) === "forecast") return null;
  const stored = realStoredMetric(input.stored);
  if (stored == null) return null;
  const forecast = realStoredMetric(input.forecast);
  if (forecast != null && stored === forecast) return null;
  return stored;
}

export function projectClientCampaignPerformance(input: {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  reach?: number | null;
  actualReach?: number | null;
  forecastReach?: number | null;
  reachSource?: string | null;
  impressions?: number | null;
  actualImpressions?: number | null;
  forecastImpressions?: number | null;
  impressionsSource?: string | null;
  engagementRate?: number | null;
  engagementViews?: number | null;
  engagementLikes?: number | null;
  engagementComments?: number | null;
  engagementShares?: number | null;
} | null | undefined): ClientCampaignPerformance {
  if (!input) return emptyClientCampaignPerformance();
  return {
    views: realStoredMetric(input.views) ?? realStoredMetric(input.engagementViews),
    likes: realStoredMetric(input.likes) ?? realStoredMetric(input.engagementLikes),
    comments: realStoredMetric(input.comments) ?? realStoredMetric(input.engagementComments),
    shares: realStoredMetric(input.shares) ?? realStoredMetric(input.engagementShares),
    reach: preferActualCampaignMetric({
      actual: input.actualReach,
      stored: input.reach,
      forecast: input.forecastReach,
      source: input.reachSource,
    }),
    impressions: preferActualCampaignMetric({
      actual: input.actualImpressions,
      stored: input.impressions,
      forecast: input.forecastImpressions,
      source: input.impressionsSource,
    }),
    engagementRate: realStoredMetric(input.engagementRate),
  };
}

export function clientCampaignPerformanceHasData(
  performance: ClientCampaignPerformance | null | undefined
): boolean {
  if (!performance) return false;
  return Object.values(performance).some((value) => value != null);
}

export function formatClientCampaignPerformance(
  performance: ClientCampaignPerformance | null | undefined
): string {
  if (!clientCampaignPerformanceHasData(performance)) return DATA_NOT_AVAILABLE;
  const parts: string[] = [];
  if (performance!.views != null) parts.push(`${formatCompactCount(performance!.views)} views`);
  if (performance!.likes != null) parts.push(`${formatCompactCount(performance!.likes)} likes`);
  if (performance!.comments != null) {
    parts.push(`${formatCompactCount(performance!.comments)} comments`);
  }
  if (performance!.shares != null) parts.push(`${formatCompactCount(performance!.shares)} shares`);
  if (performance!.reach != null) parts.push(`${formatCompactCount(performance!.reach)} reach`);
  if (performance!.impressions != null) {
    parts.push(`${formatCompactCount(performance!.impressions)} impressions`);
  }
  if (performance!.engagementRate != null) {
    parts.push(formatEngagementPct(performance!.engagementRate));
  }
  return parts.length > 0 ? parts.join(" · ") : DATA_NOT_AVAILABLE;
}

export type CampaignPublicationMetrics = {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  reach?: number | null;
  actualReach?: number | null;
  forecastReach?: number | null;
  reachSource?: string | null;
  impressions?: number | null;
  actualImpressions?: number | null;
  forecastImpressions?: number | null;
  impressionsSource?: string | null;
  engagementRate?: number | null;
  engagementViews?: number | null;
  engagementLikes?: number | null;
  engagementComments?: number | null;
  engagementShares?: number | null;
};

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
  } & CampaignPublicationMetrics>;
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
    const row = buildPostRow({
      id: post.id,
      creatorName: creatorByLine.get(post.campaignLineId) ?? "Creator",
      platform,
      deliverable: deliverableTypeShortLabel(type),
      scheduledDate: post.liveDate ?? deliverable?.liveDate ?? null,
      postStatus: post.status,
      contentUrl,
      publicationDate: publication?.publicationDate ?? null,
      performance: projectClientCampaignPerformance(publication),
      today,
    });
    if (row) posts.push(row);
  }

  for (const deliverable of source.deliverables) {
    if (postedDeliverableIds.has(deliverable.id)) continue;
    const publication = pubsByDeliverable.get(deliverable.id);
    const quantity = deliverable.quantity > 1 ? ` × ${deliverable.quantity}` : "";
    const row = buildPostRow({
      id: deliverable.id,
      creatorName: creatorByLine.get(deliverable.campaignLineId) ?? "Creator",
      platform: deliverable.platform,
      deliverable: `${deliverableTypeShortLabel(deliverable.deliverableType)}${quantity}`,
      scheduledDate: deliverable.liveDate,
      postStatus: publication?.status ?? null,
      contentUrl: publication?.contentUrl ?? null,
      publicationDate: publication?.publicationDate ?? null,
      performance: projectClientCampaignPerformance(publication),
      today,
    });
    if (row) posts.push(row);
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
  return creators.flatMap((creator) => {
    const deliverable = deliverablesLabel(creator.deliverableItems, creator.deliverables);
    const platform = creator.platform ?? creator.deliverableItems?.[0]?.platform ?? "";
    const row = buildPostRow({
      id: `roster:${creator.creatorId}`,
      creatorName: creator.displayName,
      platform,
      deliverable,
      scheduledDate: null,
      today,
    });
    return row ? [row] : [];
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
  performance?: ClientCampaignPerformance;
  today: string;
}): ClientCampaignPostRow | null {
  const status = clientCampaignPostStatus({
    scheduledDate: input.scheduledDate,
    postStatus: input.postStatus,
    contentUrl: input.contentUrl,
    publicationDate: input.publicationDate,
    today: input.today,
  });
  if (!status) return null;
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
    performance: input.performance ?? emptyClientCampaignPerformance(),
  };
}
