import { deliverableTypeShortLabel, getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";
import {
  DELIVERABLE_ASSET_TYPE_LABELS,
  type DeliverableAssetType,
} from "@/lib/services/deliverables/documentation-types";

export const NO_CONTENT_TO_REVIEW_COPY = "No content to review.";
export const NO_CONTENT_TO_REVIEW_HINT =
  "This list shows reels, images, and links Thinkway uploaded for approval. It stays empty until a file finishes saving in Campaign Workspace → Deliverables. Ads that already have a live Performance link are treated as approved and do not wait here. Live story screenshots and published posts further down are proof of live content, not files waiting for review.";
export const NOTHING_WAITING_ON_YOU_COPY =
  "Nothing waiting on you — all submitted content has been reviewed.";
export const APPROVED_CONTENT_HEADING = "Approved content";
export const CONTENT_APPROVAL_REQUIRED_LABEL = "Approval Required";
export const CONTENT_CHANGES_REQUESTED_LABEL = "Changes Requested";
export const CONTENT_APPROVED_LABEL = "Approved";
export const DOWNLOAD_ORIGINAL_LABEL = "Download Original";
export const VIEW_EXTERNAL_LINK_LABEL = "View External Link";
export const APPROVE_CONTENT_LABEL = "Approve Content";
export const REQUEST_CONTENT_CHANGES_LABEL = "Request Changes";

export const CLIENT_CONTENT_DECISIONS = ["approved", "changes_requested"] as const;
export type ClientContentDecision = (typeof CLIENT_CONTENT_DECISIONS)[number];

export const CLIENT_CONTENT_STATUSES = [
  "approval_required",
  "changes_requested",
  "approved",
] as const;
export type ClientContentStatus = (typeof CLIENT_CONTENT_STATUSES)[number];

export const CLIENT_CONTENT_STATUS_LABEL: Record<ClientContentStatus, string> = {
  approval_required: CONTENT_APPROVAL_REQUIRED_LABEL,
  changes_requested: CONTENT_CHANGES_REQUESTED_LABEL,
  approved: CONTENT_APPROVED_LABEL,
};

export type ClientContentPreviewKind = "image" | "video" | "none";

export type ClientContentDecisionRecord = {
  id: string;
  versionId: string;
  decision: ClientContentDecision;
  comment: string | null;
  decidedAt: string;
  actorKind: "client" | "internal";
};

export type ClientContentVersionHistory = {
  versionId: string;
  versionNumber: number;
  uploadedAt: string;
  status: ClientContentStatus | "uploaded";
  comment: string | null;
};

export type ClientContentReviewItem = {
  assetId: string;
  versionId: string;
  versionNumber: number;
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  creatorName: string;
  platform: string;
  platformLabel: string;
  deliverable: string;
  assetType: string;
  assetTypeLabel: string;
  medium: "file" | "external_link";
  fileName: string | null;
  mimeType: string | null;
  uploadedAt: string;
  status: ClientContentStatus;
  comment: string | null;
  canDownloadOriginal: boolean;
  externalUrl: string | null;
  previewKind: ClientContentPreviewKind;
  history: ClientContentVersionHistory[];
};

export type ClientCampaignContent = {
  campaignHeaderId: string | null;
  items: ClientContentReviewItem[];
};

export type ClientContentAssetSource = {
  id: string;
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  medium: string;
  label: string | null;
  currentVersionId: string | null;
  archivedAt: string | null;
};

/** Performance publication with a live URL, used to skip Client content approval. */
export type ClientPublishedContentUnit = {
  assignmentDeliverableId: string | null;
  assignmentPostScheduleId: string | null;
};

export type ClientContentVersionSource = {
  id: string;
  assetId: string;
  versionNumber: number;
  storageBucket: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  uploadedAt: string;
};

export function emptyClientCampaignContent(): ClientCampaignContent {
  return { campaignHeaderId: null, items: [] };
}

export function latestDecisionForVersion(
  decisions: ClientContentDecisionRecord[],
  versionId: string
): ClientContentDecisionRecord | null {
  const rows = decisions
    .filter((row) => row.versionId === versionId)
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt) || right.id.localeCompare(left.id));
  return rows[0] ?? null;
}

export function clientContentStatusFromDecision(
  decision: ClientContentDecisionRecord | null
): ClientContentStatus {
  if (!decision) return "approval_required";
  return decision.decision;
}

/**
 * A live Performance URL on the same post (or the same deliverable when the
 * asset is not post-specific) means the ad is already published — the client
 * does not need to approve that draft.
 */
export function contentAssetIsLivePublished(
  asset: Pick<ClientContentAssetSource, "assignmentDeliverableId" | "assignmentPostScheduleId">,
  published: readonly ClientPublishedContentUnit[]
): boolean {
  const postId = asset.assignmentPostScheduleId?.trim() || null;
  const deliverableId = asset.assignmentDeliverableId.trim();
  if (postId) {
    return published.some((row) => row.assignmentPostScheduleId?.trim() === postId);
  }
  if (!deliverableId) return false;
  return published.some((row) => row.assignmentDeliverableId?.trim() === deliverableId);
}

export function resolveClientContentStatus(
  decision: ClientContentDecisionRecord | null,
  livePublished: boolean
): ClientContentStatus {
  if (decision?.decision === "approved") return "approved";
  if (livePublished) return "approved";
  return clientContentStatusFromDecision(decision);
}

export function currentContentVersion(
  versions: ClientContentVersionSource[],
  currentVersionId: string | null
): ClientContentVersionSource | null {
  const sorted = [...versions].sort((left, right) => left.versionNumber - right.versionNumber);
  if (sorted.length === 0) return null;
  return sorted.find((version) => version.id === currentVersionId) ?? sorted[sorted.length - 1] ?? null;
}

export function clientContentPreviewKind(mimeType: string | null | undefined): ClientContentPreviewKind {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "none";
}

export function isClientReviewableMedium(medium: string): medium is "file" | "external_link" {
  return medium === "file" || medium === "external_link";
}

/** Story screenshots are live-post proof, not pre-publish approval files. */
export function isClientApprovalContentAssetType(assetType: string | null | undefined): boolean {
  const type = (assetType ?? "").trim().toLowerCase();
  return type !== "story_screenshot";
}

export function projectClientCampaignContent(input: {
  campaignHeaderId: string;
  assets: ClientContentAssetSource[];
  versions: ClientContentVersionSource[];
  decisions: ClientContentDecisionRecord[];
  creatorNameByDeliverableId: Record<string, string>;
  platformByDeliverableId: Record<string, string>;
  deliverableTypeByDeliverableId: Record<string, string>;
  publishedUnits?: readonly ClientPublishedContentUnit[];
}): ClientCampaignContent {
  const versionsByAsset = new Map<string, ClientContentVersionSource[]>();
  for (const version of input.versions) {
    const list = versionsByAsset.get(version.assetId) ?? [];
    list.push(version);
    versionsByAsset.set(version.assetId, list);
  }

  const items: ClientContentReviewItem[] = [];
  for (const asset of input.assets) {
    if (asset.archivedAt || asset.campaignHeaderId !== input.campaignHeaderId) continue;
    if (!isClientReviewableMedium(asset.medium)) continue;
    if (!isClientApprovalContentAssetType(asset.assetType)) continue;
    const versions = [...(versionsByAsset.get(asset.id) ?? [])].sort(
      (left, right) => left.versionNumber - right.versionNumber
    );
    const current = currentContentVersion(versions, asset.currentVersionId);
    if (!current) continue;
    const hasFile = Boolean(current.storageBucket && current.storagePath);
    const externalUrl = current.externalUrl?.trim() || null;
    if (asset.medium === "file" && !hasFile) continue;
    if (asset.medium === "external_link" && !externalUrl) continue;

    const currentDecision = latestDecisionForVersion(input.decisions, current.id);
    const livePublished = contentAssetIsLivePublished(asset, input.publishedUnits ?? []);
    const status = resolveClientContentStatus(currentDecision, livePublished);
    const platform = input.platformByDeliverableId[asset.assignmentDeliverableId] ?? "";
    const type = input.deliverableTypeByDeliverableId[asset.assignmentDeliverableId] ?? "";
    const assetType = asset.assetType as DeliverableAssetType;
    items.push({
      assetId: asset.id,
      versionId: current.id,
      versionNumber: current.versionNumber,
      campaignHeaderId: asset.campaignHeaderId,
      assignmentDeliverableId: asset.assignmentDeliverableId,
      assignmentPostScheduleId: asset.assignmentPostScheduleId,
      creatorName: input.creatorNameByDeliverableId[asset.assignmentDeliverableId] ?? "Creator",
      platform,
      platformLabel: platform ? getPlatformOptionLabel(platform) : "",
      deliverable: asset.label?.trim() || deliverableTypeShortLabel(type || "other"),
      assetType: asset.assetType,
      assetTypeLabel: DELIVERABLE_ASSET_TYPE_LABELS[assetType] ?? asset.assetType,
      medium: asset.medium,
      fileName: current.fileName,
      mimeType: current.mimeType,
      uploadedAt: current.uploadedAt,
      status,
      comment: currentDecision?.comment ?? null,
      canDownloadOriginal: asset.medium === "file" && hasFile,
      externalUrl: asset.medium === "external_link" ? externalUrl : null,
      previewKind: hasFile ? clientContentPreviewKind(current.mimeType) : "none",
      history: versions.map((version) => {
        const decision = latestDecisionForVersion(input.decisions, version.id);
        const versionLive = version.id === current.id && livePublished;
        return {
          versionId: version.id,
          versionNumber: version.versionNumber,
          uploadedAt: version.uploadedAt,
          status: decision
            ? resolveClientContentStatus(decision, versionLive)
            : versionLive
              ? "approved"
              : "uploaded",
          comment: decision?.comment ?? null,
        };
      }),
    });
  }

  items.sort((left, right) => {
    const statusOrder = Number(left.status === "approved") - Number(right.status === "approved");
    if (statusOrder !== 0) return statusOrder;
    return right.uploadedAt.localeCompare(left.uploadedAt) || left.creatorName.localeCompare(right.creatorName);
  });

  return { campaignHeaderId: input.campaignHeaderId, items };
}

export function clientContentToReview(items: ClientContentReviewItem[]): ClientContentReviewItem[] {
  return items.filter((item) => item.status !== "approved");
}

export function clientContentAssetUrl(input: {
  token: string;
  versionId: string;
  mode: "preview" | "download";
  format?: "json";
}): string {
  const params = new URLSearchParams({
    sign: input.token,
    versionId: input.versionId,
    mode: input.mode,
  });
  if (input.format) params.set("format", input.format);
  return `/api/review/content?${params.toString()}`;
}

/** Chrome cannot play `video/quicktime`. Instagram/iPhone stories named .MOV are often MP4. */
export function clientContentPlaybackMime(
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): string {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  const name = fileName?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) return mime;
  if (mime === "video/webm" || name.endsWith(".webm")) return "video/webm";
  if (
    mime.startsWith("video/") ||
    name.endsWith(".mp4") ||
    name.endsWith(".m4v") ||
    name.endsWith(".mov")
  ) {
    return "video/mp4";
  }
  return mime || "application/octet-stream";
}

export const FULL_SIZE_LABEL = "Full size";
