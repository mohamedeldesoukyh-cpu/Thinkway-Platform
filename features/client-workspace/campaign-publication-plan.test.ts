import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyClientCampaignPerformance, overlayCampaignPostAvatars, type ClientCampaignPostRow } from "./campaign-execution";
import {
  creatorInitials,
  defaultExpandedCreators,
  filterPublicationPlanPosts,
  groupPublicationPlanByCreator,
  publicationPlanFilterCounts,
} from "./campaign-publication-plan";

function row(
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

test("identical tbc deliverables fold into one counted child row", () => {
  const groups = groupPublicationPlanByCreator([
    row({ id: "1", creatorName: "@omar_dem", status: "scheduling", deliverable: "IG Reel" }),
    row({ id: "2", creatorName: "@omar_dem", status: "scheduling", deliverable: "IG Reel" }),
    row({ id: "3", creatorName: "@omar_dem", status: "scheduling", deliverable: "IG Story" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.total, 3);
  assert.equal(groups[0]?.folded.length, 2);
  assert.equal(groups[0]?.folded.find((item) => item.sample.deliverable === "IG Reel")?.count, 2);
});

test("creators with live or overdue rows expand by default", () => {
  const groups = groupPublicationPlanByCreator([
    row({ id: "1", creatorName: "@omar_dem", status: "scheduling" }),
    row({
      id: "2",
      creatorName: "@nadineladki14",
      status: "live",
      deliverable: "ig reel",
      publicationDate: "2026-08-13",
    }),
    row({
      id: "3",
      creatorName: "@nadineladki14",
      status: "overdue",
      deliverable: "IG Story",
      scheduledDate: "2026-08-13",
    }),
  ]);
  assert.deepEqual(defaultExpandedCreators(groups), ["@nadineladki14"]);
});

test("publication plan filters and search match the campaign table", () => {
  const posts = [
    row({ id: "1", creatorName: "@omar_dem", status: "scheduling", deliverable: "IG Reel" }),
    row({ id: "2", creatorName: "@nadineladki14", status: "live", deliverable: "ig reel" }),
    row({ id: "3", creatorName: "@nadineladki14", status: "overdue", deliverable: "IG Story" }),
  ];
  assert.deepEqual(publicationPlanFilterCounts(posts), {
    all: 3,
    live: 1,
    overdue: 1,
    scheduling: 1,
  });
  assert.equal(filterPublicationPlanPosts(posts, "overdue", "").length, 1);
  assert.equal(filterPublicationPlanPosts(posts, "all", "story").length, 1);
  assert.equal(creatorInitials("@omar_dem"), "OD");
});

test("campaign tab avatars overlay from creator cards by name or handle", () => {
  const posts = [
    row({ id: "1", creatorName: "@omar_dem", status: "scheduling" }),
    row({ id: "2", creatorName: "Nadine", status: "live", avatarUrl: "https://cdn.example/keep.jpg" }),
  ];
  const overlaid = overlayCampaignPostAvatars(posts, [
    { displayName: "Omar Dem", handle: "omar_dem", avatarUrl: "https://cdn.example/omar.jpg" },
    { displayName: "Nadine", handle: "nadineladki14", avatarUrl: "https://cdn.example/nadine.jpg" },
  ]);
  assert.equal(overlaid[0]?.avatarUrl, "https://cdn.example/omar.jpg");
  assert.equal(overlaid[1]?.avatarUrl, "https://cdn.example/keep.jpg");
});
