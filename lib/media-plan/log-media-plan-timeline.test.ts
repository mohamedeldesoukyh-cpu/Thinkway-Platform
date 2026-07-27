import { strict as assert } from "node:assert";
import { test } from "node:test";

import { mediaPlanEventsForCampaignTimeline } from "./timeline-events";
import type { MediaPlanTimelineEvent } from "./types";

test("Campaign Timeline filter includes approval and revision events, excludes schedule_edited", () => {
  const events: MediaPlanTimelineEvent[] = [
    {
      type: "schedule_edited",
      mediaPlanId: "mp",
      campaignId: "c",
      version: 2,
      at: "2026-07-27T00:00:00.000Z",
      summary: "moved",
    },
    {
      type: "draft_created",
      mediaPlanId: "mp",
      campaignId: "c",
      version: 2,
      at: "2026-07-27T00:00:00.000Z",
      summary: "draft",
    },
    {
      type: "changes_requested",
      mediaPlanId: "mp",
      campaignId: "c",
      version: 2,
      at: "2026-07-27T00:00:00.000Z",
      summary: "changes",
    },
    {
      type: "rejected",
      mediaPlanId: "mp",
      campaignId: "c",
      version: 2,
      at: "2026-07-27T00:00:00.000Z",
      summary: "rejected",
    },
    {
      type: "baseline_published",
      mediaPlanId: "mp",
      campaignId: "c",
      version: 2,
      at: "2026-07-27T00:00:00.000Z",
      summary: "published",
    },
  ];

  const filtered = mediaPlanEventsForCampaignTimeline(events);
  assert.deepEqual(
    filtered.map((event) => event.type),
    ["draft_created", "changes_requested", "rejected", "baseline_published"]
  );
});
