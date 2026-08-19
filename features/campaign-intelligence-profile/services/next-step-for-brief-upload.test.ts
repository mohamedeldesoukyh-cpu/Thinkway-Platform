import assert from "node:assert/strict";
import test from "node:test";

import { nextStepForCampaignBriefUpload } from "./next-step-for-brief-upload";

test("brand_selection keeps the upload pending so Intake can finish the brand link", () => {
  const step = nextStepForCampaignBriefUpload({
    ok: true,
    phase: "brand_selection",
    pending: { documentId: "doc-1" },
  });
  assert.equal(step.kind, "select_brand");
  if (step.kind === "select_brand") {
    assert.equal(step.pending.documentId, "doc-1");
  }
});

test("complete upload applies the CIP workspace", () => {
  const step = nextStepForCampaignBriefUpload({
    ok: true,
    phase: "complete",
    workspace: { profileId: "profile-1" },
  });
  assert.equal(step.kind, "apply_workspace");
  if (step.kind === "apply_workspace") {
    assert.equal(step.workspace.profileId, "profile-1");
  }
});

test("failed upload surfaces the error", () => {
  const step = nextStepForCampaignBriefUpload({
    ok: false,
    message: "Unsupported format.",
  });
  assert.equal(step.kind, "error");
  if (step.kind === "error") {
    assert.equal(step.message, "Unsupported format.");
  }
});
