import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { campaignMediaPlanPath } from "./entity-paths";

const SAMPLE = {
  id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  document_number: "TW-2026-0042",
  name: "NBK Summer",
};

describe("campaignMediaPlanPath", () => {
  it("builds the campaign media-plan route", () => {
    assert.match(campaignMediaPlanPath(SAMPLE), /\/media-plan$/);
  });

  it("appends view, plan, and companion popup query params", () => {
    const href = campaignMediaPlanPath(SAMPLE, "actual", {
      popup: true,
      planId: "plan-1",
    });
    assert.match(href, /view=actual/);
    assert.match(href, /planId=plan-1/);
    assert.match(href, /popup=1/);
  });
});
