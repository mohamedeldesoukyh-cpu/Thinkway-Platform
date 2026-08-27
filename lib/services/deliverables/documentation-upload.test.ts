import assert from "node:assert/strict";
import { test } from "node:test";

import { isServerActionDecodeError } from "@/lib/clients/client-document-utils";
import {
  DELIVERABLE_ASSET_MAX_BYTES,
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  alternateDeliverableVideoMime,
  deliverableAssetPreviewKind,
  documentationRowHasUploadedContent,
  googleDriveFilePreviewUrl,
  inferDeliverableAssetMime,
  resolveDeliverableUploadMime,
  unfinishedFileAssetId,
  versionCountsAsClientContent,
} from "@/lib/services/deliverables/documentation-types";
import {
  applyDocumentationAggregates,
  emptyAgg,
} from "@/lib/services/deliverables/build-documentation-units";
import {
  DELIVERABLE_STANDARD_UPLOAD_MAX_BYTES,
  deliverableResumableSignedEndpoint,
  deliverableUploadFailureMessage,
  deliverableUploadMeterValue,
  deliverableUploadPercent,
  deliverableUploadProgressLabel,
  formatDeliverableUploadBytes,
  isDeliverableStoragePutSuccess,
  parseDeliverableSignedUploadTarget,
  shouldUseResumableDeliverableUpload,
} from "@/features/campaigns/deliverable-asset-upload";

test("deliverable asset size cap matches the 100 MB storage bucket", () => {
  assert.equal(DELIVERABLE_ASSET_MAX_BYTES, 100 * 1024 * 1024);
  assert.match(DELIVERABLE_ASSET_TOO_LARGE_MESSAGE, /100 MB/);
});

test("inferDeliverableAssetMime uses the file extension when the browser omits a type", () => {
  assert.equal(inferDeliverableAssetMime("video/mp4", "omar.mp4"), "video/mp4");
  assert.equal(inferDeliverableAssetMime("", "omar-reel.MOV"), "video/quicktime");
  assert.equal(inferDeliverableAssetMime(null, "draft.webm"), "video/webm");
});

test("Windows/iPhone MOV marked as octet-stream still uploads as QuickTime", () => {
  assert.equal(
    inferDeliverableAssetMime("application/octet-stream", "1st Omar Story.MOV"),
    "video/quicktime"
  );
  assert.equal(
    inferDeliverableAssetMime("video/hevc", "reel.mp4"),
    "video/mp4"
  );
  assert.equal(
    inferDeliverableAssetMime("video/x-quicktime", "story.mov"),
    "video/quicktime"
  );
});

function ftypHeader(brand: string): Uint8Array {
  const bytes = new Uint8Array(12);
  bytes.set([0, 0, 0, 20], 0);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  bytes.set(Array.from(brand, (char) => char.charCodeAt(0)), 8);
  return bytes;
}

test("iPhone story MOV with an MP4 container uploads as video/mp4, not QuickTime", () => {
  assert.equal(
    resolveDeliverableUploadMime({
      browserType: "application/octet-stream",
      fileName: "1st Omar Story.MOV",
      header: ftypHeader("isom"),
    }),
    "video/mp4"
  );
  assert.equal(
    resolveDeliverableUploadMime({
      browserType: "video/quicktime",
      fileName: "story.MOV",
      header: ftypHeader("mp42"),
    }),
    "video/mp4"
  );
  assert.equal(
    resolveDeliverableUploadMime({
      browserType: "application/octet-stream",
      fileName: "reel.MOV",
      header: ftypHeader("qt  "),
    }),
    "video/quicktime"
  );
  assert.equal(alternateDeliverableVideoMime("video/quicktime"), "video/mp4");
  assert.equal(alternateDeliverableVideoMime("video/mp4"), "video/quicktime");
});

test("server-action protocol errors are identified so Deliverables does not crash", () => {
  assert.equal(
    isServerActionDecodeError(
      new Error("An unexpected response was received from the server.")
    ),
    true
  );
});

test("deliverable upload meter reports percent and byte copy", () => {
  assert.equal(deliverableUploadPercent(40, 80), 50);
  assert.equal(formatDeliverableUploadBytes(80 * 1024 * 1024), "80.0 MB");
  assert.equal(deliverableUploadMeterValue({ phase: "preparing", loaded: 0, total: 80 }), 4);
  assert.equal(deliverableUploadMeterValue({ phase: "finishing", loaded: 80, total: 80 }), 97);
  assert.equal(
    deliverableUploadProgressLabel({
      phase: "uploading",
      fileName: "omar-reel.mp4",
      loaded: 0,
      total: 80 * 1024 * 1024,
    }),
    "Uploading omar-reel.mp4…"
  );
  assert.match(
    deliverableUploadProgressLabel({
      phase: "uploading",
      fileName: "omar-reel.mp4",
      loaded: 40 * 1024 * 1024,
      total: 80 * 1024 * 1024,
    }),
    /Uploading omar-reel\.mp4 · 50% · 40\.0 MB of 80\.0 MB/
  );
});

test("uploaded reels and images are previewable", () => {
  assert.equal(deliverableAssetPreviewKind("video/mp4", "omar-reel.mp4"), "video");
  assert.equal(deliverableAssetPreviewKind("image/jpeg", "story.jpg"), "image");
  assert.equal(deliverableAssetPreviewKind("application/pdf", "brief.pdf"), "pdf");
  assert.equal(deliverableAssetPreviewKind("text/plain", "notes.txt"), null);
});

test("incomplete file rows are not client-visible until a version lands", () => {
  assert.equal(versionCountsAsClientContent(null), false);
  assert.equal(
    versionCountsAsClientContent({
      storageBucket: "deliverable-assets",
      storagePath: null,
      externalUrl: null,
    }),
    false
  );
  assert.equal(
    versionCountsAsClientContent({
      storageBucket: "deliverable-assets",
      storagePath: "hdr/del/asset/v.mp4",
      externalUrl: null,
    }),
    true
  );
});

test("unfinished file shells are reused instead of duplicating rows", () => {
  assert.equal(
    unfinishedFileAssetId(
      [
        {
          id: "asset-final",
          assetType: "final_video",
          medium: "file",
          currentVersion: {
            storageBucket: null,
            storagePath: null,
            externalUrl: null,
          },
        },
      ],
      "draft_video"
    ),
    "asset-final"
  );
  assert.equal(
    unfinishedFileAssetId(
      [
        {
          id: "asset-playable",
          assetType: "draft_video",
          medium: "file",
          currentVersion: {
            storageBucket: "deliverable-assets",
            storagePath: "hdr/del/a/v.mp4",
            externalUrl: null,
          },
        },
      ],
      "draft_video"
    ),
    null
  );
});

test("Google Drive links use the preview embed URL", () => {
  assert.equal(
    googleDriveFilePreviewUrl("https://drive.google.com/file/d/abc123/view?usp=sharing"),
    "https://drive.google.com/file/d/abc123/preview"
  );
  assert.equal(
    googleDriveFilePreviewUrl("https://drive.google.com/open?id=abc123"),
    "https://drive.google.com/file/d/abc123/preview"
  );
  assert.equal(googleDriveFilePreviewUrl("https://instagram.com/reel/x"), null);
});

test("explorer post rows see deliverable-level uploads", () => {
  const keys = new Set(["d:del-1"]);
  assert.equal(documentationRowHasUploadedContent(keys, "del-1", "post-9"), true);
  assert.equal(documentationRowHasUploadedContent(keys, "del-1", null), true);
  assert.equal(documentationRowHasUploadedContent(keys, "del-2", "post-9"), false);
  assert.equal(
    documentationRowHasUploadedContent(new Set(["p:post-9"]), "del-1", "post-9"),
    true
  );
});

test("deliverable upload failures distinguish size vs rejected type", () => {
  assert.match(deliverableUploadFailureMessage(413), /100 MB/);
  assert.match(deliverableUploadFailureMessage(400, "maximum allowed size"), /100 MB/);
  assert.match(deliverableUploadFailureMessage(400, "invalid mime type"), /rejected this video type/i);
  assert.match(deliverableUploadFailureMessage(403), /permission/i);
  assert.match(deliverableUploadFailureMessage(0, "network"), /connection/i);
  assert.equal(isDeliverableStoragePutSuccess(200), true);
  assert.equal(isDeliverableStoragePutSuccess(409), true);
  assert.equal(isDeliverableStoragePutSuccess(400), false);
});

test("files over the standard Storage PUT cap use resumable TUS", () => {
  assert.equal(shouldUseResumableDeliverableUpload(DELIVERABLE_STANDARD_UPLOAD_MAX_BYTES), false);
  assert.equal(shouldUseResumableDeliverableUpload(DELIVERABLE_STANDARD_UPLOAD_MAX_BYTES + 1), true);
  assert.equal(shouldUseResumableDeliverableUpload(80_844 * 1024), true);
});

test("signed upload URLs parse bucket, path, and TUS endpoint", () => {
  const signedUrl =
    "https://abc123.supabase.co/storage/v1/object/upload/sign/deliverable-assets/hdr/del/asset/v-story.MOV?token=sig";
  assert.deepEqual(parseDeliverableSignedUploadTarget(signedUrl), {
    bucket: "deliverable-assets",
    storagePath: "hdr/del/asset/v-story.MOV",
  });
  assert.equal(
    deliverableResumableSignedEndpoint(signedUrl),
    "https://abc123.storage.supabase.co/storage/v1/upload/resumable/sign"
  );
  assert.equal(
    deliverableResumableSignedEndpoint("http://127.0.0.1:54321/storage/v1/object/upload/sign/b/p"),
    "http://127.0.0.1:54321/storage/v1/upload/resumable/sign"
  );
});

test("documentation aggregates mark units received without reloading hierarchy", () => {
  const units = applyDocumentationAggregates(
    [
      {
        unitKey: "d:del-1",
        campaignHeaderId: "hdr-1",
        assignmentDeliverableId: "del-1",
        assignmentPostScheduleId: null,
        sequenceNumber: null,
        label: "Reel",
        creatorId: "c1",
        creatorName: "Omar",
        assignmentLineId: "line-1",
        assignmentName: "Assignment",
        platform: "instagram",
        deliverableType: "reel",
        dueDate: null,
        quantity: 1,
        received: false,
        ...emptyAgg(),
      },
    ],
    { "d:del-1": { ...emptyAgg(), contentAssetCount: 1, totalAssetCount: 1 } }
  );
  assert.equal(units[0]?.received, true);
  assert.equal(units[0]?.contentAssetCount, 1);
});
