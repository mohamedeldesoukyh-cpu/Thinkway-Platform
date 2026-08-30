/**
 * Deliverables Documentation Repository — domain types.
 * Spec: docs/architecture/DELIVERABLES_DOCUMENTATION_REPOSITORY.md
 */

export const DELIVERABLE_ASSET_TYPES = [
  "draft_video",
  "final_video",
  "story_screenshot",
  "feed_image",
  "caption",
  "thumbnail",
  "brief",
  "contract",
  "invoice_support",
  "other",
] as const;

export type DeliverableAssetType = (typeof DELIVERABLE_ASSET_TYPES)[number];

export const DELIVERABLE_ASSET_TYPE_LABELS: Record<DeliverableAssetType, string> =
  {
    draft_video: "Draft Video",
    final_video: "Final Video",
    story_screenshot: "Story Screenshot",
    feed_image: "Feed Image",
    caption: "Caption",
    thumbnail: "Thumbnail",
    brief: "Brief",
    contract: "Contract",
    invoice_support: "Invoice Support",
    other: "Other",
  };

/** Suggested upload type for a slot — stories vs reels vs feed. */
export function defaultDeliverableAssetType(
  deliverableType: string | null | undefined
): DeliverableAssetType {
  const code = (deliverableType ?? "").toLowerCase();
  if (code.includes("story")) return "story_screenshot";
  if (
    code.includes("post") ||
    code.includes("feed") ||
    code.includes("image") ||
    code.includes("photo")
  ) {
    return "feed_image";
  }
  return "draft_video";
}

export type DocumentationReceiptStatus = "received" | "incomplete" | "missing";

/**
 * Received = finished file or link (D2). Incomplete = something started
 * (unfinished upload, caption) but no playable content yet.
 */
export function documentationReceiptStatus(unit: {
  received: boolean;
  totalAssetCount: number;
  contentAssetCount: number;
}): DocumentationReceiptStatus {
  if (unit.received) return "received";
  if (unit.totalAssetCount > unit.contentAssetCount) return "incomplete";
  return "missing";
}

export type DeliverableAssetMedium = "file" | "external_link" | "text";

/**
 * Matches `storage.buckets.file_size_limit` for `deliverable-assets` (150 MB).
 * Files above ~45 MB must use resumable TUS; standard signed PUT is capped at 50 MB.
 * Project-wide Storage `fileSizeLimit` must be at least this value or TUS returns 413.
 */
export const DELIVERABLE_ASSET_MAX_MB = 150;
export const DELIVERABLE_ASSET_MAX_BYTES = DELIVERABLE_ASSET_MAX_MB * 1024 * 1024;

export const DELIVERABLE_ASSET_TOO_LARGE_MESSAGE =
  `This file is too large. Reels and videos must be ${DELIVERABLE_ASSET_MAX_MB} MB or smaller.`;

/** Must stay in sync with storage.buckets.allowed_mime_types for deliverable-assets. */
export const DELIVERABLE_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const DELIVERABLE_UPLOAD_MIME_SET = new Set<string>(DELIVERABLE_UPLOAD_MIME_TYPES);

const GENERIC_UPLOAD_MIME = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/download",
  "application/force-download",
  "application/x-msdownload",
]);

const DELIVERABLE_MIME_ALIASES: Record<string, string> = {
  "video/mov": "video/quicktime",
  "video/x-quicktime": "video/quicktime",
  "video/quicktime": "video/quicktime",
  "video/x-m4v": "video/mp4",
  "image/jpg": "image/jpeg",
};

function mimeFromFileName(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  return null;
}

export function isAllowedDeliverableUploadMime(mimeType: string): boolean {
  return DELIVERABLE_UPLOAD_MIME_SET.has(mimeType);
}

export function inferDeliverableAssetMime(
  mimeType: string | null | undefined,
  fileName: string
): string {
  const raw = (mimeType ?? "").trim().toLowerCase().split(";")[0]?.trim() ?? "";
  const aliased = DELIVERABLE_MIME_ALIASES[raw] ?? raw;
  if (isAllowedDeliverableUploadMime(aliased)) return aliased;

  const fromName = mimeFromFileName(fileName);
  if (fromName) return fromName;
  if (aliased && !GENERIC_UPLOAD_MIME.has(aliased)) return aliased;
  return "application/octet-stream";
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/**
 * Read the ISO-BMFF / QuickTime brand from the file header.
 * iPhone stories are often an MP4 (`ftypisom` / `mp42`) saved as `.MOV`.
 * Declaring those as `video/quicktime` makes Storage return 400.
 */
export function sniffDeliverableContainerMime(
  header: ArrayBuffer | Uint8Array | null | undefined
): string | null {
  if (!header) return null;
  const bytes = header instanceof Uint8Array ? header : new Uint8Array(header);
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  if (bytes.length < 8) return null;
  const box = ascii(bytes, 4, 4);
  if (box === "ftyp" && bytes.length >= 12) {
    const brand = ascii(bytes, 8, 4);
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  const start = ascii(bytes, 0, 4);
  if (
    start === "moov" ||
    start === "mdat" ||
    start === "wide" ||
    start === "free" ||
    start === "skip" ||
    start === "pnot"
  ) {
    return "video/quicktime";
  }
  return null;
}

export function resolveDeliverableUploadMime(input: {
  browserType?: string | null;
  fileName: string;
  header?: ArrayBuffer | Uint8Array | null;
}): string {
  const sniffed = sniffDeliverableContainerMime(input.header);
  if (sniffed && isAllowedDeliverableUploadMime(sniffed)) return sniffed;
  return inferDeliverableAssetMime(input.browserType, input.fileName);
}

export function alternateDeliverableVideoMime(mimeType: string): string | null {
  if (mimeType === "video/quicktime") return "video/mp4";
  if (mimeType === "video/mp4") return "video/quicktime";
  return null;
}

export type DeliverableAssetPreviewKind = "video" | "image" | "pdf" | null;

export function deliverableAssetPreviewKind(
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): DeliverableAssetPreviewKind {
  const mime = inferDeliverableAssetMime(mimeType, fileName ?? "");
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return null;
}

export type DocumentationAudience = "internal" | "creator" | "client";

export type DocumentationCompleteness = "none" | "partial" | "complete";

/** Counts as "Received" for completeness (D2). */
export function mediumCountsAsReceived(medium: DeliverableAssetMedium): boolean {
  return medium === "file" || medium === "external_link";
}

/** A version is client-visible only after the file or link actually landed. */
export function versionCountsAsClientContent(version: {
  storageBucket?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
} | null | undefined): boolean {
  if (!version) return false;
  const hasFile = Boolean(version.storageBucket?.trim() && version.storagePath?.trim());
  return hasFile || Boolean(version.externalUrl?.trim());
}

/** Resume a begin-upload shell instead of creating a second unfinished file row. */
export function unfinishedFileAssetId(
  assets: ReadonlyArray<{
    id: string;
    assetType: string;
    medium: string;
    currentVersion: {
      storageBucket?: string | null;
      storagePath?: string | null;
      externalUrl?: string | null;
    } | null;
  }>,
  assetType: string
): string | null {
  const unfinished = assets.filter(
    (asset) =>
      asset.medium === "file" &&
      !versionCountsAsClientContent(asset.currentVersion)
  );
  return (
    unfinished.find((asset) => asset.assetType === assetType)?.id ??
    unfinished[0]?.id ??
    null
  );
}

export function googleDriveFilePreviewUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!/(^|\.)drive\.google\.com$/i.test(parsed.hostname) && !/(^|\.)docs\.google\.com$/i.test(parsed.hostname)) {
    return null;
  }
  const fromPath = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  const fileId = fromPath || parsed.searchParams.get("id");
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export type DocumentationUnitId = {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  /** null when quantity = 1 (deliverable-level unit). */
  assignmentPostScheduleId: string | null;
  sequenceNumber: number | null;
};

export type DocumentationUnitSummary = DocumentationUnitId & {
  unitKey: string;
  label: string;
  creatorId: string | null;
  creatorName: string | null;
  assignmentLineId: string;
  assignmentName: string;
  platform: string | null;
  deliverableType: string | null;
  dueDate: string | null;
  quantity: number;
  received: boolean;
  contentAssetCount: number;
  totalAssetCount: number;
  latestVersionLabel: string | null;
  revisionCount: number;
  lastUpdatedAt: string | null;
  publicationLinkCount: number;
};

export type DeliverableAssetVersionView = {
  id: string;
  versionNumber: number;
  storageBucket: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  textBody: string | null;
  changeSummary: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  releasedToClientAt: string | null;
};

export type DeliverableAssetView = {
  id: string;
  assetType: DeliverableAssetType;
  medium: DeliverableAssetMedium;
  label: string | null;
  sortOrder: number;
  currentVersion: DeliverableAssetVersionView | null;
  versions: DeliverableAssetVersionView[];
  createdAt: string;
  archivedAt: string | null;
};

export type DeliverableCommentView = {
  id: string;
  audience: DocumentationAudience;
  body: string;
  authorUserId: string | null;
  authorDisplayName: string | null;
  createdAt: string;
};

export type DeliverableDocumentationEventView = {
  id: string;
  eventType: string;
  actorLabel: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type DocumentationUnitDetail = DocumentationUnitSummary & {
  assets: DeliverableAssetView[];
  comments: DeliverableCommentView[];
  events: DeliverableDocumentationEventView[];
};

export function documentationUnitKey(
  deliverableId: string,
  postId: string | null
): string {
  return postId ? `p:${postId}` : `d:${deliverableId}`;
}

/** Explorer post rows must also match deliverable-level uploads (qty = 1 uses postId null). */
export function documentationRowHasUploadedContent(
  receivedKeys: ReadonlySet<string>,
  assignmentDeliverableId: string,
  assignmentPostScheduleId: string | null
): boolean {
  if (
    receivedKeys.has(
      documentationUnitKey(assignmentDeliverableId, assignmentPostScheduleId)
    )
  ) {
    return true;
  }
  if (assignmentPostScheduleId) {
    return receivedKeys.has(documentationUnitKey(assignmentDeliverableId, null));
  }
  return false;
}

export function rollupCreatorCompleteness(
  units: Array<{ received: boolean }>
): DocumentationCompleteness {
  if (units.length === 0) return "none";
  const received = units.filter((u) => u.received).length;
  if (received === 0) return "none";
  if (received === units.length) return "complete";
  return "partial";
}
