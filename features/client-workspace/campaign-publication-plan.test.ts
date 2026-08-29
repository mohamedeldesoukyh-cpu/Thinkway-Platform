import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyClientCampaignPerformance, overlayCampaignPostAvatars, type ClientCampaignPostRow } from "./campaign-execution";
import { clientCampaignDashboardPerformanceMetrics } from "./campaign-dashboard";
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

test("documentation units with scripts stay as separate publication-plan rows", () => {
  const groups = groupPublicationPlanByCreator([
    row({
      id: "s1",
      creatorName: "@omar_dem",
      status: "scheduling",
      deliverable: "IG Story",
      assignmentDeliverableId: "del-story",
      assignmentPostScheduleId: "post-1",
      quantity: 2,
    }),
    row({
      id: "s2",
      creatorName: "@omar_dem",
      status: "scheduling",
      deliverable: "IG Story",
      assignmentDeliverableId: "del-story",
      assignmentPostScheduleId: "post-2",
      quantity: 2,
    }),
  ]);
  assert.equal(groups[0]?.folded.length, 2);
  assert.equal(groups[0]?.folded.every((item) => item.count === 1), true);
});

test("publication plan creator groups stay collapsed by default", () => {
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
  assert.deepEqual(defaultExpandedCreators(groups), []);
});

test("live publication metrics keep compact values for IG-style avatars", () => {
  const metrics = clientCampaignDashboardPerformanceMetrics({
    views: 17200,
    likes: 419,
    comments: 19,
    shares: null,
    reach: null,
    impressions: null,
    engagementRate: 2.5,
  });
  assert.deepEqual(
    metrics.map((metric) => [metric.key, metric.formatted]),
    [
      ["views", "17.2K"],
      ["likes", "419"],
      ["comments", "19"],
      ["engagementRate", "2.5%"],
    ]
  );
});

test("publication plan filters and search match the campaign table", () => {
  const posts = [
    row({ id: "1", creatorName: "@omar_dem", status: "scheduling", deliverable: "IG Reel" }),
    row({ id: "2", creatorName: "@nadineladki14", status: "live", deliverable: "ig reel" }),
    row({ id: "3", creatorName: "@nadineladki14", status: "overdue", deliverable: "IG Story" }),
  ];
  assert.deepEqual(publicationPlanFilterCounts(posts), {
    all: 3,
    overdue: 1,
    live: 1,
    scheduled: 0,
    scheduling: 1,
    completed: 0,
  });
  assert.equal(filterPublicationPlanPosts(posts, "overdue", "").length, 1);
  assert.equal(filterPublicationPlanPosts(posts, "all", "story").length, 1);
  assert.equal(filterPublicationPlanPosts(posts, "all", "reel").length, 2);
  assert.equal(filterPublicationPlanPosts(posts, "all", "", "IG Reel").length, 2);
  assert.equal(creatorInitials("@omar_dem"), "OD");
});

test("ig reel and IG Reel fold as the same canonical format", () => {
  const groups = groupPublicationPlanByCreator([
    row({ id: "1", creatorName: "@omar_dem", status: "overdue", deliverable: "ig reel" }),
    row({ id: "2", creatorName: "@omar_dem", status: "overdue", deliverable: "IG Reel" }),
  ]);
  assert.equal(groups[0]?.folded.length, 1);
  assert.equal(groups[0]?.folded[0]?.count, 2);
  assert.equal(groups[0]?.folded[0]?.sample.deliverable, "IG Reel");
  assert.equal(groups[0]?.kinds.length, 1);
  assert.equal(groups[0]?.kinds[0]?.label, "IG Reel");
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
