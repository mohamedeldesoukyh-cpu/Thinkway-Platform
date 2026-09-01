import assert from "node:assert/strict";

import { buildInitialSelections } from "@/features/campaigns/components/platform-account-selector";
import type { InfluencerAssignmentProfile } from "@/features/campaigns/types";

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Abdelrahman",
  platforms: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      platform: "instagram",
      handle: "abdelrahman__elessawy",
      profile_url: null,
      follower_count: 1000,
      engagement_rate: null,
      audience_country: null,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      platform: "tiktok",
      handle: "abdelrahman__elessawy",
      profile_url: null,
      follower_count: 800,
      engagement_rate: null,
      audience_country: null,
    },
  ],
  rate_card: {},
  payment_details: {},
  suggested_cost: 0,
  vat_registered: false,
  default_vat_percent: 0,
  tax_registration_number: null,
  suggested_cost_vat_percent: 0,
} as InfluencerAssignmentProfile;

const initial = buildInitialSelections(profile);
assert.equal(initial.length, 2);
assert.ok(
  initial.every((row) => row.selected === false && row.deliverables.length === 0),
  "new assignment must not auto-select a platform or invent agreed content"
);

const restored = buildInitialSelections(profile, [
  {
    account_id: "33333333-3333-4333-8333-333333333333",
    platform: "instagram",
    handle: "abdelrahman__elessawy",
    profile_url: null,
    follower_count: 1000,
    engagement_rate: null,
    audience_country: null,
    deliverables: ["instagram_reel"],
    selected: true,
  },
]);
assert.equal(restored[0]?.selected, true);
assert.deepEqual(restored[0]?.deliverables, ["instagram_reel"]);
assert.equal(restored[1]?.selected, false);

console.log("platform-account-selector tests passed");
