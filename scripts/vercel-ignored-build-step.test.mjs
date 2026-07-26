import assert from "node:assert/strict";
import test from "node:test";

import { resolveIgnoredBuildDecision } from "./vercel-ignored-build-step.mjs";

test("preview always builds (ignore=false → exit 1)", () => {
  const decision = resolveIgnoredBuildDecision({ vercelEnv: "preview" });
  assert.equal(decision.ignore, false);
});

test("production without override is ignored (ignore=true → exit 0)", () => {
  const decision = resolveIgnoredBuildDecision({
    vercelEnv: "production",
    commitMessage: "fix: stabilize Discovery pagination",
  });
  assert.equal(decision.ignore, true);
});

test("production with [deploy-production] builds", () => {
  const decision = resolveIgnoredBuildDecision({
    vercelEnv: "production",
    commitMessage: "release: ship hotfixes [deploy-production]",
  });
  assert.equal(decision.ignore, false);
});

test("production with [force-deploy] builds", () => {
  const decision = resolveIgnoredBuildDecision({
    vercelEnv: "production",
    commitMessage: "chore: emergency [force-deploy]",
  });
  assert.equal(decision.ignore, false);
});

test("production with THINKWAY_FORCE_PRODUCTION_GIT_DEPLOY=1 builds", () => {
  const decision = resolveIgnoredBuildDecision({
    vercelEnv: "production",
    commitMessage: "no token here",
    forceEnv: "1",
  });
  assert.equal(decision.ignore, false);
});
