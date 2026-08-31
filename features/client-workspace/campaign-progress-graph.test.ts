import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyClientCampaignPerformance, type ClientCampaignPostRow } from "./campaign-execution";
import {
  campaignProgressRangeCopy,
  dateToCampaignPercent,
  projectCampaignProgressGraph,
  resolveCampaignProgressWindow,
} from "./campaign-progress-graph";

function post(
  overrides: Partial<ClientCampaignPostRow> & Pick<ClientCampaignPostRow, "id" | "creatorName" | "status">
): ClientCampaignPostRow {
  return {
    platform: "instagram",
    platformLabel: "Instagram",
    deliverable: "IG Story",
    scheduledDate: null,
    live: overrides.status === "live",
    publicationDate: null,
    contentUrl: null,
    proofImageUrl: null,
    isStory: false,
    performance: emptyClientCampaignPerformance(),
    ...overrides,
  };
}

test("campaign window uses header dates and stretches for posts outside it", () => {
  const window = resolveCampaignProgressWindow({
    posts: [
      post({
        id: "1",
        creatorName: "@omar_dem",
        status: "scheduled",
        scheduledDate: "2026-07-28",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-28",
  });
  assert.deepEqual(window, { startDate: "2026-07-28", endDate: "2026-08-31" });
});

test("progress graph stacks creators, one line per type, and fills through live checkpoints", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({
        id: "s1",
        creatorName: "@omar_dem",
        status: "live",
        scheduledDate: "2026-08-10",
        publicationDate: "2026-08-10",
      }),
      post({
        id: "s2",
        creatorName: "@omar_dem",
        status: "scheduled",
        scheduledDate: "2026-08-20",
      }),
      post({
        id: "r1",
        creatorName: "@omar_dem",
        status: "live",
        deliverable: "IG Reel",
        scheduledDate: "2026-08-12",
        publicationDate: "2026-08-12",
      }),
      post({
        id: "n1",
        creatorName: "@nadine",
        status: "overdue",
        deliverable: "IG Reel",
        scheduledDate: "2026-08-13",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-28",
  });
  assert.ok(graph);
  assert.equal(graph.startDate, "2026-08-01");
  assert.equal(graph.endDate, "2026-08-31");
  assert.equal(graph.startLabel, "1 Aug");
  assert.equal(graph.endLabel, "31 Aug");
  assert.equal(graph.startFullLabel, "1 Aug 2026");
  assert.equal(graph.endFullLabel, "31 Aug 2026");
  assert.equal(graph.creators.length, 2);
  const omar = graph.creators.find((creator) => creator.creatorName === "@omar_dem");
  assert.equal(omar?.tracks.length, 2);
  const stories = omar?.tracks.find((track) => track.format === "IG Story");
  assert.equal(stories?.checkpoints.length, 2);
  assert.equal(stories?.checkpoints[0]?.label, "10 Aug");
  assert.equal(stories?.checkpoints[0]?.showLabel, true);
  assert.equal(stories?.checkpoints[1]?.label, "20 Aug");
  assert.equal(stories?.reachedCount, 1);
  assert.equal(stories?.checkpoints[0]?.reached, true);
  assert.ok((stories?.filledPercent ?? 0) > 4);
  assert.ok((stories?.filledPercent ?? 100) < 100);
  const reel = omar?.tracks.find((track) => track.format === "IG Reel");
  assert.equal(reel?.filledPercent, 100);
  const nadine = graph.creators.find((creator) => creator.creatorName === "@nadine");
  assert.equal(nadine?.tracks[0]?.filledPercent, 4);
  assert.equal(nadine?.tracks[0]?.checkpoints[0]?.overdue, true);
});

test("all live ads on a type complete the line to campaign end", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({
        id: "1",
        creatorName: "@omar_dem",
        status: "live",
        scheduledDate: "2026-08-10",
        publicationDate: "2026-08-10",
      }),
      post({
        id: "2",
        creatorName: "@omar_dem",
        status: "completed",
        scheduledDate: "2026-08-18",
        publicationDate: "2026-08-18",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-28",
  });
  assert.equal(graph?.creators[0]?.tracks[0]?.filledPercent, 100);
});

test("same-day ads on one type stay as separate checkpoints", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({ id: "1", creatorName: "@omar_dem", status: "live", scheduledDate: "2026-08-14" }),
      post({ id: "2", creatorName: "@omar_dem", status: "scheduled", scheduledDate: "2026-08-14" }),
      post({ id: "3", creatorName: "@omar_dem", status: "scheduled", scheduledDate: "2026-08-14" }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-28",
  });
  const dots = graph?.creators[0]?.tracks[0]?.checkpoints ?? [];
  assert.equal(dots.length, 3);
  assert.equal(dots[0]?.label, "14 Aug");
  assert.equal(dots[0]?.showLabel, true);
  assert.equal(dots[1]?.showLabel, false);
  assert.equal(dots[2]?.showLabel, false);
  assert.ok((dots[1]?.percent ?? 0) > (dots[0]?.percent ?? 0));
  assert.ok((dots[2]?.percent ?? 0) > (dots[1]?.percent ?? 0));
});

test("date percent sits between campaign start and end terminals", () => {
  const mid = dateToCampaignPercent("2026-08-16", "2026-08-01", "2026-08-31");
  assert.ok(mid > 4);
  assert.ok(mid < 96);
});

test("live story checkpoints use proof images instead of expired story URLs", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({
        id: "s1",
        creatorName: "@nadine",
        status: "live",
        scheduledDate: "2026-08-14",
        isStory: true,
        contentUrl: "https://www.instagram.com/stories/nadsmarkiz/1/",
        proofImageUrl: "https://cdn.example/story.png",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-28",
  });
  assert.equal(graph?.creators[0]?.tracks[0]?.checkpoints[0]?.contentUrl, "https://cdn.example/story.png");
});

test("live stories without proof do not link out", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({
        id: "s1",
        creatorName: "@nadine",
        status: "live",
        scheduledDate: "2026-08-14",
        isStory: true,
        contentUrl: "https://www.instagram.com/stories/nadsmarkiz/1/",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-28",
  });
  assert.equal(graph?.creators[0]?.tracks[0]?.checkpoints[0]?.contentUrl, null);
});

test("live reel checkpoints open the permalink instead of the screenshot", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({
        id: "r1",
        creatorName: "@ph____alaa",
        status: "live",
        scheduledDate: "2026-08-31",
        deliverable: "IG Reel",
        contentUrl: "https://www.instagram.com/reel/PHALAA/",
        proofImageUrl: "https://cdn.example/reel-shot.jpg",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-31",
  });
  assert.equal(
    graph?.creators[0]?.tracks[0]?.checkpoints[0]?.contentUrl,
    "https://www.instagram.com/reel/PHALAA/"
  );
});

test("added-value publications sit on a separate gold track after contracted types", () => {
  const graph = projectCampaignProgressGraph({
    posts: [
      post({
        id: "r1",
        creatorName: "@ph____alaa",
        status: "live",
        scheduledDate: "2026-08-31",
        deliverable: "IG Reel",
      }),
      post({
        id: "av1",
        creatorName: "@ph____alaa",
        status: "live",
        scheduledDate: "2026-08-31",
        platform: "tiktok",
        platformLabel: "TikTok",
        deliverable: "TT Video",
        valueScope: "added_value",
      }),
    ],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    today: "2026-08-31",
  });
  const tracks = graph?.creators[0]?.tracks ?? [];
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0]?.format, "IG Reel");
  assert.equal(tracks[0]?.valueScope, "agreed");
  assert.equal(tracks[1]?.format, "TT Video");
  assert.equal(tracks[1]?.valueScope, "added_value");
  assert.match(tracks[1]?.checkpoints[0]?.title ?? "", /Added value/);
});

test("range copy names start and end dates", () => {
  assert.equal(
    campaignProgressRangeCopy("1 Aug 2026", "31 Aug 2026"),
    "Start 1 Aug 2026 · End 31 Aug 2026"
  );
});
