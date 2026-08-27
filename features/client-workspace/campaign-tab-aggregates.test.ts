import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyClientCampaignPerformance, type ClientCampaignPostRow } from "./campaign-execution";
import type { ClientContentReviewItem } from "./content-approval";
import {
  clientCampaignBarSegments,
  clientOverdueStrip,
  clientReviewAttention,
  groupClientContentByCreator,
  joinClientNames,
  normalizeClientDeliverableFormat,
} from "./campaign-tab-aggregates";

function post(
  overrides: Partial<ClientCampaignPostRow> & Pick<ClientCampaignPostRow, "id" | "creatorName" | "status">
): ClientCampaignPostRow {
  return {
    platform: "instagram",
    platformLabel: "Instagram",
    deliverable: "IG Reel",
    scheduledDate: null,
    live: overrides.status === "live",
    publicationDate: null,
    contentUrl: null,
    performance: emptyClientCampaignPerformance(),
    ...overrides,
  };
}

function review(
  overrides: Partial<ClientContentReviewItem> & Pick<ClientContentReviewItem, "assetId" | "creatorName">
): ClientContentReviewItem {
  return {
    versionId: overrides.assetId,
    versionNumber: 1,
    campaignHeaderId: "hdr-1",
    assignmentDeliverableId: "del-1",
    assignmentPostScheduleId: null,
    platform: "instagram",
    platformLabel: "Instagram",
    deliverable: "IG Story",
    assetType: "final_video",
    assetTypeLabel: "Final Video",
    medium: "file",
    fileName: `${overrides.assetId}.MOV`,
    mimeType: "video/quicktime",
    uploadedAt: "2026-08-27T10:00:00.000Z",
    status: "approval_required",
    comment: null,
    canDownloadOriginal: true,
    externalUrl: null,
    previewKind: "video",
    history: [],
    ...overrides,
  };
}

test("review attention is one aggregated row, never one row per file", () => {
  const attention = clientReviewAttention([
    review({ assetId: "a", creatorName: "@omar_dem", fileName: "1st Omar Story.MOV" }),
    review({ assetId: "b", creatorName: "@omar_dem", fileName: "second.mp4" }),
  ]);
  assert.equal(attention?.count, 2);
  assert.equal(attention?.headline, "2 videos awaiting your approval");
  assert.match(attention?.detail ?? "", /From @omar_dem/);
  assert.equal(groupClientContentByCreator([
    review({ assetId: "a", creatorName: "@omar_dem" }),
    review({ assetId: "b", creatorName: "@omar_dem" }),
    review({ assetId: "c", creatorName: "@laila_tt" }),
  ]).length, 2);
});

test("joinClientNames never lists every creator past two", () => {
  assert.equal(joinClientNames(["@omar_dem", "@laila_tt"]), "@omar_dem and @laila_tt");
  assert.equal(
    joinClientNames(["@omar_dem", "@laila_tt", "@youssef_snap", "@mennaf"]),
    "@omar_dem, @laila_tt and 2 more"
  );
});

test("overdue strip aggregates publications, not one row per overdue deliverable", () => {
  const strip = clientOverdueStrip([
    post({
      id: "1",
      creatorName: "@omar_dem",
      status: "overdue",
      deliverable: "IG Story",
      scheduledDate: "2026-08-15",
    }),
    post({
      id: "2",
      creatorName: "@omar_dem",
      status: "overdue",
      deliverable: "IG Reel",
      scheduledDate: "2026-08-15",
    }),
    post({
      id: "3",
      creatorName: "@nadineladki14",
      status: "overdue",
      deliverable: "IG Story",
      scheduledDate: "2026-08-13",
    }),
    post({ id: "4", creatorName: "@flavia_creates", status: "live" }),
  ]);
  assert.equal(strip?.count, 3);
  assert.equal(strip?.creatorCount, 2);
  assert.equal(strip?.headline, "3 publications overdue across 2 creators");
  assert.match(strip?.detail ?? "", /Thinkway is chasing, no action needed from you/);
  assert.equal(clientOverdueStrip([post({ id: "4", creatorName: "@flavia_creates", status: "live" })]), null);
});

test("progress bar segments cover every status including zeros", () => {
  const segments = clientCampaignBarSegments([
    post({ id: "1", creatorName: "@a", status: "live" }),
    post({ id: "2", creatorName: "@b", status: "overdue" }),
    post({ id: "3", creatorName: "@c", status: "due_today" }),
  ]);
  assert.deepEqual(
    segments.map((segment) => [segment.key, segment.count]),
    [
      ["live", 1],
      ["overdue", 1],
      ["scheduled", 1],
      ["scheduling", 0],
      ["completed", 0],
    ]
  );
});

test("deliverable formats fold messy API casing onto one canonical label", () => {
  assert.equal(normalizeClientDeliverableFormat("ig reel", "instagram"), "IG Reel");
  assert.equal(normalizeClientDeliverableFormat("IG Reel", "instagram"), "IG Reel");
  assert.equal(normalizeClientDeliverableFormat("stories", "instagram"), "IG Story");
  assert.equal(normalizeClientDeliverableFormat("spotlight", "snapchat"), "SC Spotlight");
  assert.equal(normalizeClientDeliverableFormat("Pinned Comment Takeover", "facebook"), "Pinned Comment Takeover");
});
