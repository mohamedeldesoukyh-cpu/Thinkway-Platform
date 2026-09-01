import assert from "node:assert/strict";

import { resolveLineCommercialInput } from "@/lib/assignments/resolve-line-commercial-input";
import { lineAssignmentPayloadSchema } from "@/lib/campaigns/schemas";
import type { LinePlatformSelection } from "@/lib/campaigns/line-assignment";

function parseAssignmentJson(raw: string):
  | { ok: true; platforms: LinePlatformSelection[] }
  | { ok: false; message: string } {
  try {
    const parsed = lineAssignmentPayloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { ok: false, message: "Invalid platform selection." };
    }
    return { ok: true, platforms: parsed.data.platforms };
  } catch {
    return { ok: false, message: "Invalid platform selection." };
  }
}

const empty = resolveLineCommercialInput({
  pricing_mode: "package",
  assignment_json: JSON.stringify({ platforms: [] }),
  platformAccounts: [],
  parseAssignmentJson,
});

assert.equal(empty.ok, true, "package mode accepts no platforms yet");
if (empty.ok) {
  assert.equal(empty.value.platforms.length, 0);
  assert.equal(empty.value.deliverable_count, 0);
  assert.equal(empty.value.cost_before_vat, 0);
}

const platformNoContent = resolveLineCommercialInput({
  pricing_mode: "package",
  assignment_json: JSON.stringify({
    platforms: [
      {
        account_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        handle: "abdelrahman__elessawy",
        deliverables: [],
      },
    ],
  }),
  platformAccounts: [],
  parseAssignmentJson,
});

assert.equal(
  platformNoContent.ok,
  true,
  "package mode accepts a platform before agreed content is chosen"
);
if (platformNoContent.ok) {
  assert.equal(platformNoContent.value.platforms.length, 1);
  assert.equal(platformNoContent.value.deliverable_count, 0);
}

console.log("resolve-line-commercial-input tests passed");
