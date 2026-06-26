import assert from "node:assert/strict";

import type { ClientOnboardingAuditEvent } from "@/lib/clients/onboarding-audit";

// 10. audit event keys are stable for downstream consumers
const events: ClientOnboardingAuditEvent[] = [
  "client.promoted",
  "client.onboarding_status_changed",
  "client.duplicate_overridden",
  "client.existing_linked",
];

assert.equal(events.length, 4);
assert.equal(events[0], "client.promoted");

console.log("onboarding-audit.test.ts: all assertions passed");
