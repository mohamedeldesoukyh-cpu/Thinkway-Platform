import assert from "node:assert/strict";

import {
  canTransitionOnboardingStatus,
  computeOnboardingProgress,
  DEFAULT_PROMOTED_ONBOARDING_STATUS,
  deriveOnboardingStatusFromCompletion,
  formatOnboardingProgressDetail,
  formatOnboardingStatusProgressBadge,
  formatOnboardingStepProgress,
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
assert.equal(emptyProgress.totalCount, 3);

const halfProgress = computeOnboardingProgress({
  legal_completed_at: "2026-06-01T00:00:00.000Z",
  finance_completed_at: "2026-06-02T00:00:00.000Z",
  credit_limit_active: true,
});
assert.equal(halfProgress.percentage, 67);
assert.equal(halfProgress.completedCount, 2);
assert.equal(halfProgress.totalCount, 3);

const fullProgress = computeOnboardingProgress({
  legal_completed_at: "2026-06-01T00:00:00.000Z",
  finance_completed_at: "2026-06-02T00:00:00.000Z",
  tax_completed_at: "2026-06-04T00:00:00.000Z",
  credit_limit_active: true,
});
assert.equal(fullProgress.percentage, 100);
assert.equal(formatOnboardingStepProgress(fullProgress), "Complete");
assert.equal(
  formatOnboardingStatusProgressBadge("active", fullProgress),
  "Active · Complete"
);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
  }),
  "finance_pending"
);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    credit_limit_active: false,
  }),
  "ready"
);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    credit_limit_active: true,
  }),
  "finance_pending"
);

const financeSkippedProgress = computeOnboardingProgress({
  legal_completed_at: "2026-06-01T00:00:00.000Z",
  credit_limit_active: false,
});
assert.equal(financeSkippedProgress.completedCount, 1);
assert.equal(financeSkippedProgress.totalCount, 2);
assert.equal(financeSkippedProgress.percentage, 50);
assert.equal(
  formatOnboardingStepProgress(financeSkippedProgress),
  "1 of 2 steps complete"
);
assert.equal(
  formatOnboardingProgressDetail(financeSkippedProgress, { credit_limit_active: false }),
  "1 of 2 steps complete (Tax remaining)"
);
assert.equal(
  formatOnboardingStatusProgressBadge("ready", financeSkippedProgress),
  "Ready · 1 of 2 steps complete"
);
assert.equal(
  financeSkippedProgress.sections.find((section) => section.id === "finance")?.completed,
  true
);

const contractsExcludedProgress = computeOnboardingProgress({
  legal_completed_at: "2026-06-01T00:00:00.000Z",
  credit_limit_active: false,
});
assert.equal(
  contractsExcludedProgress.sections.find((section) => section.id === "contracts")?.completed,
  false
);
assert.equal(contractsExcludedProgress.totalCount, 2);

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
    tax_completed_at: "2026-06-04T00:00:00.000Z",
    credit_limit_active: true,
  }),
  "active"
);

assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    tax_completed_at: "2026-06-04T00:00:00.000Z",
    credit_limit_active: false,
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
