import assert from "node:assert/strict";
import test from "node:test";

import { shouldRoutePausedWorkflowToStudioOutput } from "./paused-workflow-studio-output-routing";

test("routes deterministic Executive Proposal generation through Studio when a Campaign Object exists", () => {
  assert.equal(
    shouldRoutePausedWorkflowToStudioOutput({
      hasCampaignObject: true,
      message: "Generate Executive Proposal",
    }),
    true
  );
  assert.equal(
    shouldRoutePausedWorkflowToStudioOutput({
      hasCampaignObject: true,
      message: "Regenerate Executive Proposal",
    }),
    true
  );
});

test("keeps ordinary replies and other Studio commands with the paused workflow", () => {
  assert.equal(
    shouldRoutePausedWorkflowToStudioOutput({
      hasCampaignObject: true,
      message: "The budget is EGP 500,000",
    }),
    false
  );
  assert.equal(
    shouldRoutePausedWorkflowToStudioOutput({
      hasCampaignObject: true,
      message: "Generate the Media Plan",
    }),
    false
  );
});

test("does not route an output request without a Campaign Object", () => {
  assert.equal(
    shouldRoutePausedWorkflowToStudioOutput({
      hasCampaignObject: false,
      message: "Generate Executive Proposal",
    }),
    false
  );
});
