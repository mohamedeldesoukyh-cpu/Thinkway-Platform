import assert from "node:assert/strict";
import { test } from "node:test";

import { performanceFactsFromAssignmentHierarchy } from "./performance-facts";

test("ready_to_invoice is not a billing lock for schedule guards", () => {
  const facts = performanceFactsFromAssignmentHierarchy({
    groups: [
      {
        line: {
          id: "line-1",
          influencer_id: "mirna",
          influencer_name: "mirnasmadness",
        },
        deliverables: [
          {
            id: "d1",
            platform: "TikTok",
            label: "TikTok video",
            deliverable_type_label: "TikTok video",
            billing_status: "ready_to_invoice",
            live_date: null,
            is_locked: false,
            posts: [
              {
                id: "p1",
                platform: "TikTok",
                deliverable_type: "tiktok_video",
                deliverable_type_label: "TikTok video",
                live_date: null,
                billing_status: "ready_to_invoice",
                is_locked: false,
              },
            ],
          },
        ],
      },
    ],
  } as never);

  assert.equal(facts[0]!.billingLocked, false);
});

test("invoiced is a billing lock for schedule guards", () => {
  const facts = performanceFactsFromAssignmentHierarchy({
    groups: [
      {
        line: {
          id: "line-1",
          influencer_id: "mirna",
          influencer_name: "mirnasmadness",
        },
        deliverables: [
          {
            id: "d1",
            platform: "TikTok",
            label: "TikTok video",
            deliverable_type_label: "TikTok video",
            billing_status: "invoiced",
            live_date: null,
            is_locked: false,
            posts: [
              {
                id: "p1",
                platform: "TikTok",
                deliverable_type: "tiktok_video",
                deliverable_type_label: "TikTok video",
                live_date: null,
                billing_status: "invoiced",
                is_locked: false,
              },
            ],
          },
        ],
      },
    ],
  } as never);

  assert.equal(facts[0]!.billingLocked, true);
});
