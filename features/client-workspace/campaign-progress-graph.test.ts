import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyClientCampaignPerformance, type ClientCampaignPostRow } from "./campaign-execution";
import {
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
  assert.equal(graph.creators.length, 2);
  const omar = graph.creators.find((creator) => creator.creatorName === "@omar_dem");
  assert.equal(omar?.tracks.length, 2);
  const stories = omar?.tracks.find((track) => track.format === "IG Story");
  assert.equal(stories?.checkpoints.length, 2);
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
  assert.ok((dots[1]?.percent ?? 0) > (dots[0]?.percent ?? 0));
  assert.ok((dots[2]?.percent ?? 0) > (dots[1]?.percent ?? 0));
});

test("date percent sits between campaign start and end terminals", () => {
  const mid = dateToCampaignPercent("2026-08-16", "2026-08-01", "2026-08-31");
  assert.ok(mid > 4);
  assert.ok(mid < 96);
});
