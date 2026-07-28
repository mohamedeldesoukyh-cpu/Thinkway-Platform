import { strict as assert } from "node:assert";
import { test } from "node:test";

import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

import { emptyCampaignObject } from "./hydrate";
import {
  ensureCreatorsFromAssignmentHierarchy,
  seedCreatorsFromAssignmentHierarchy,
} from "./seed-from-assignment-hierarchy";

function sampleHierarchy(): AssignmentHierarchy {
  return {
    currency_code: "EGP",
    groups: [
      {
        line: {
          id: "line-1",
          influencer_id: "inf-1",
          influencer_name: "Layla",
          influencer_avatar_url: null,
        },
        deliverables: [
          {
            id: "d1",
            label: "IG Reel",
            platform: "instagram",
            deliverable_type: "reel",
            deliverable_type_label: "IG Reel",
            live_date: "2026-04-30",
            posts: [
              {
                id: "p1",
                platform: "instagram",
                deliverable_type: "reel",
                deliverable_type_label: "IG Reel",
                live_date: "2026-04-30",
              },
            ],
          },
        ],
        rollups: {
          deliverable_count: 1,
          revenue: 0,
          cost: 0,
          gp: 0,
          margin_percent: 0,
          invoiced_value: 0,
          remaining_value: 0,
          collected_value: 0,
        },
      },
    ],
  } as unknown as AssignmentHierarchy;
}

test("seedCreatorsFromAssignmentHierarchy maps vendors and deliverables", () => {
  const creators = seedCreatorsFromAssignmentHierarchy(sampleHierarchy());
  assert.equal(creators.length, 1);
  assert.equal(creators[0]!.creatorId, "inf-1");
  assert.equal(creators[0]!.displayName, "Layla");
  assert.deepEqual(creators[0]!.serviceTypes, ["IG Reel"]);
});

test("ensureCreatorsFromAssignmentHierarchy fills empty slate only", () => {
  const empty = emptyCampaignObject();
  const filled = ensureCreatorsFromAssignmentHierarchy(empty, sampleHierarchy());
  assert.equal(resolveSlate(filled).length, 1);
  assert.equal(resolveSlate(filled)[0]!.displayName, "Layla");

  const already = ensureCreatorsFromAssignmentHierarchy(filled, {
    currency_code: "EGP",
    groups: [],
  });
  assert.equal(resolveSlate(already).length, 1);
});
