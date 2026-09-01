import assert from "node:assert/strict";

import { lineAssignmentPayloadSchema } from "@/lib/campaigns/schemas";
import { createCampaignLineSchema } from "@/features/campaigns/schemas";

{
  const empty = lineAssignmentPayloadSchema.safeParse({ platforms: [] });
  assert.equal(empty.success, true, "creator-only assignment may have no platforms");
}

{
  const missing = lineAssignmentPayloadSchema.safeParse({});
  assert.equal(missing.success, true, "missing platforms defaults to an empty list");
}

{
  const platformNoContent = lineAssignmentPayloadSchema.safeParse({
    platforms: [
      {
        account_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        handle: "ouda.5",
        deliverables: [],
      },
    ],
  });
  assert.equal(
    platformNoContent.success,
    true,
    "a platform may be stored before agreed content is chosen"
  );
}

{
  const parsed = createCampaignLineSchema.safeParse({
    campaign_id: "11111111-1111-4111-8111-111111111111",
    influencer_id: "22222222-2222-4222-8222-222222222222",
    assignment_json: JSON.stringify({ platforms: [] }),
    po_amount: 0,
    revenue: 0,
    cost: 0,
    usage_rights_amount: 0,
    usage_rights_cost: 0,
    agency_fee_percent: 0,
    revenue_vat_percent: 0,
    cost_vat_percent: 0,
    assignment_status: "assigned",
    pricing_mode: "package",
  });
  assert.equal(parsed.success, true, "create assignment accepts a creator-only line");
}

console.log("campaign assignment schema tests passed");
