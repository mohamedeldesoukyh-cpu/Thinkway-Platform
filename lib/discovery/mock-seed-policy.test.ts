import assert from "node:assert/strict";

import { isDemoDataEnabled } from "@/lib/discovery/demo-data";
import { resolveMockSeedDecision } from "../../services/discovery-worker/src/discovery/mock-seed-policy.js";

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

assert.equal(isDemoDataEnabled(env({ NODE_ENV: "development" })), false);
assert.equal(isDemoDataEnabled(env({ NODE_ENV: "production" })), false);
assert.equal(isDemoDataEnabled(env({ NODE_ENV: "test" })), false);
assert.equal(
  isDemoDataEnabled(env({ NODE_ENV: "production", ENABLE_DEMO_DATA: "true" })),
  false
);

assert.deepEqual(
  resolveMockSeedDecision({ crawlDiscovered: 0, demoEnabled: false, crawlError: null }),
  { attemptSeed: false, markFailed: false, failureReason: null }
);

assert.deepEqual(
  resolveMockSeedDecision({
    crawlDiscovered: 0,
    demoEnabled: false,
    crawlError: "Discovery crawl failed",
  }),
  {
    attemptSeed: false,
    markFailed: true,
    failureReason: "Discovery crawl failed",
  }
);

assert.deepEqual(
  resolveMockSeedDecision({ crawlDiscovered: 0, demoEnabled: true, crawlError: null }),
  { attemptSeed: false, markFailed: false, failureReason: null }
);

assert.deepEqual(
  resolveMockSeedDecision({ crawlDiscovered: 5, demoEnabled: true, crawlError: null }),
  { attemptSeed: false, markFailed: false, failureReason: null }
);

console.log("mock-seed-policy.test.ts: all assertions passed");
