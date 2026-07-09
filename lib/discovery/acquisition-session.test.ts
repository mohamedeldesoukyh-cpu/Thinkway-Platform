import assert from "node:assert/strict";

import {
  acquisitionJobCancelRedisKey,
  acquisitionSessionRedisKey,
  getAcquisitionSessionConfig,
} from "./acquisition-session";

const config = getAcquisitionSessionConfig();
assert.ok(config.heartbeatIntervalMs > 0, "heartbeat interval should be positive");
assert.ok(config.sessionTtlMs > config.heartbeatIntervalMs, "session TTL should exceed heartbeat interval");
assert.ok(config.jobCancelFlagTtlMs > 0, "job cancel flag TTL should be positive");

assert.equal(
  acquisitionSessionRedisKey("abc-123"),
  "thinkway:discovery:acquisition:session:abc-123"
);
assert.equal(
  acquisitionJobCancelRedisKey("job-1"),
  "thinkway:discovery:acquisition:job:job-1:cancel"
);

const originalHeartbeat = process.env.DISCOVERY_ACQUISITION_HEARTBEAT_INTERVAL_MS;
const originalTtl = process.env.DISCOVERY_ACQUISITION_SESSION_TTL_MS;
process.env.DISCOVERY_ACQUISITION_HEARTBEAT_INTERVAL_MS = "5000";
process.env.DISCOVERY_ACQUISITION_SESSION_TTL_MS = "20000";
const overridden = getAcquisitionSessionConfig();
assert.equal(overridden.heartbeatIntervalMs, 5000);
assert.equal(overridden.sessionTtlMs, 20000);

if (originalHeartbeat !== undefined) {
  process.env.DISCOVERY_ACQUISITION_HEARTBEAT_INTERVAL_MS = originalHeartbeat;
} else {
  delete process.env.DISCOVERY_ACQUISITION_HEARTBEAT_INTERVAL_MS;
}
if (originalTtl !== undefined) {
  process.env.DISCOVERY_ACQUISITION_SESSION_TTL_MS = originalTtl;
} else {
  delete process.env.DISCOVERY_ACQUISITION_SESSION_TTL_MS;
}

console.log("lib/discovery/acquisition-session.test.ts — all tests passed");
