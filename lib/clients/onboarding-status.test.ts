import assert from "node:assert/strict";

import {
  canTransitionOnboardingStatus,
  computeOnboardingProgress,
  DEFAULT_PROMOTED_ONBOARDING_STATUS,
  deriveOnboardingStatusFromCompletion,
  resolveClientListStatusBadges,
} from "@/lib/clients/onboarding-status";

// 7. onboarding default status
assert.equal(DEFAULT_PROMOTED_ONBOARDING_STATUS, "legal_pending");

// 8. status transitions
assert.equal(canTransitionOnboardingStatus("legal_pending", "finance_pending"), true);
assert.equal(canTransitionOnboardingStatus("legal_pending", "draft"), false);
assert.equal(canTransitionOnboardingStatus("active", "ready"), false);
assert.equal(canTransitionOnboardingStatus("ready", "active"), true);

// 9. progress calculation
const emptyProgress = computeOnboardingProgress({});
assert.equal(emptyProgress.percentage, 0);
assert.equal(emptyProgress.completedCount, 0);

const halfProgress = computeOnboardingProgress({
  legal_completed_at: "2026-06-01T00:00:00.000Z",
  finance_completed_at: "2026-06-02T00:00:00.000Z",
});
assert.equal(halfProgress.percentage, 50);
assert.equal(halfProgress.completedCount, 2);

const fullProgress = computeOnboardingProgress({
  legal_completed_at: "2026-06-01T00:00:00.000Z",
  finance_completed_at: "2026-06-02T00:00:00.000Z",
  contracts_completed_at: "2026-06-03T00:00:00.000Z",
  tax_completed_at: "2026-06-04T00:00:00.000Z",
});
assert.equal(fullProgress.percentage, 100);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
  }),
  "finance_pending"
);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    finance_completed_at: "2026-06-02T00:00:00.000Z",
  }),
  "ready"
);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    finance_completed_at: "2026-06-02T00:00:00.000Z",
    contracts_completed_at: "2026-06-03T00:00:00.000Z",
    tax_completed_at: "2026-06-04T00:00:00.000Z",
  }),
  "active"
);

assert.deepEqual(
  resolveClientListStatusBadges({ status: "active", onboardingStatus: "active" }),
  { operationalStatus: "active", onboardingStatus: null }
);

assert.deepEqual(
  resolveClientListStatusBadges({ status: "prospect", onboardingStatus: "legal_pending" }),
  { operationalStatus: "prospect", onboardingStatus: "legal_pending" }
);

assert.deepEqual(
  resolveClientListStatusBadges({ status: "active", onboardingStatus: "ready" }),
  { operationalStatus: "active", onboardingStatus: "ready" }
);

console.log("onboarding-status.test.ts: all assertions passed");
