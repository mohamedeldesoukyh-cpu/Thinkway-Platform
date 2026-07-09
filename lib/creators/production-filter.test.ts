import test from "node:test";
import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { passesProductionCreatorGate } from "./production-filter";

function discoveryCreator(stage: string, username: string): UnifiedCreatorResult {
  return {
    unified_id: "dis:1",
    source_type: "public_discovery",
    influencer_id: null,
    discovered_profile_id: "1",
    document_number: null,
    display_name: username,
    status: stage,
    country_code: "EG",
    categories: [],
    metrics: { followers: { value: 1000, confidence: "medium" } },
    thinkway_score: 50,
    source_confidence: 0.7,
    is_platform_verified: false,
    platforms: [{ id: "1", platform: "instagram", handle: username, is_verified: false }],
  } as unknown as UnifiedCreatorResult;
}

test("passesProductionCreatorGate allows freshly discovered non-synthetic profiles", () => {
  assert.equal(passesProductionCreatorGate(discoveryCreator("discovered", "adidas_runner_eg")), true);
});

test("passesProductionCreatorGate blocks synthetic mock_seed handles", () => {
  assert.equal(passesProductionCreatorGate(discoveryCreator("discovered", "tw_eg_sports_01")), false);
});
