import assert from "node:assert/strict";

import {
  canOverrideOnboardingStatus,
  ONBOARDING_OVERRIDE_ROLE_SLUGS,
} from "@/lib/clients/onboarding-permissions";
import { deriveOnboardingStatusFromCompletion } from "@/lib/clients/onboarding-status";
import {
  applyChecklistToCompletion,
  buildOnboardingUpdatePayload,
  computeOnboardingTransition,
  validateManualStatusOverride,
} from "@/lib/clients/onboarding-transitions";

const NOW = "2026-06-26T12:00:00.000Z";

// Rule 2: legal complete → finance_pending
assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
  }),
  "finance_pending"
);

// Rule 3: finance complete → ready
assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    finance_completed_at: "2026-06-02T00:00:00.000Z",
  }),
  "ready"
);

// Rule 4: all sections complete → active
assert.equal(
  deriveOnboardingStatusFromCompletion({
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    finance_completed_at: "2026-06-02T00:00:00.000Z",
    contracts_completed_at: "2026-06-03T00:00:00.000Z",
    tax_completed_at: "2026-06-04T00:00:00.000Z",
  }),
  "active"
);

// Activation flow via computeOnboardingTransition
const activation = computeOnboardingTransition({
  currentStatus: "legal_pending",
  currentCompletion: {},
  checklist: { legal: true, finance: true, contracts: true, tax: true },
  now: NOW,
});

assert.equal(activation.nextStatus, "active");
assert.equal(activation.statusChanged, true);
assert.equal(activation.activated, true);
assert.ok(activation.completion.legal_completed_at);
assert.ok(activation.completion.finance_completed_at);
assert.ok(activation.completion.contracts_completed_at);
assert.ok(activation.completion.tax_completed_at);

const activationPayload = buildOnboardingUpdatePayload({
  completion: activation.completion,
  nextStatus: activation.nextStatus,
  userId: "user-1",
  now: NOW,
  activated: activation.activated,
});

assert.equal(activationPayload.onboarding_status, "active");
assert.equal(activationPayload.activated_at, NOW);
assert.equal(activationPayload.onboarding_completed_by, "user-1");
assert.equal(activationPayload.status, "active");

// Unchecking finance regresses status
const financeUnchecked = computeOnboardingTransition({
  currentStatus: "ready",
  currentCompletion: {
    legal_completed_at: "2026-06-01T00:00:00.000Z",
    finance_completed_at: "2026-06-02T00:00:00.000Z",
  },
  checklist: { legal: true, finance: false, contracts: false, tax: false },
  now: NOW,
});

assert.equal(financeUnchecked.nextStatus, "finance_pending");
assert.equal(financeUnchecked.completion.finance_completed_at, null);

// applyChecklistToCompletion preserves existing timestamps when re-checking
const preserved = applyChecklistToCompletion(
  { legal_completed_at: "2026-06-01T00:00:00.000Z" },
  { legal: true, finance: false, contracts: false, tax: false },
  NOW
);
assert.equal(preserved.legal_completed_at, "2026-06-01T00:00:00.000Z");

// Manual override validation
assert.deepEqual(validateManualStatusOverride("legal_pending", "finance_pending"), {
  ok: true,
});
assert.deepEqual(validateManualStatusOverride("legal_pending", "draft"), {
  ok: false,
  message: "Cannot change onboarding status from legal_pending to draft.",
});
assert.deepEqual(validateManualStatusOverride("ready", "active"), { ok: true });
assert.deepEqual(validateManualStatusOverride("active", "ready"), {
  ok: false,
  message: "Cannot change onboarding status from active to ready.",
});

// Permission enforcement helpers
assert.equal(canOverrideOnboardingStatus("admin"), true);
assert.equal(canOverrideOnboardingStatus("finance"), true);
assert.equal(canOverrideOnboardingStatus("account_manager"), true);
assert.equal(canOverrideOnboardingStatus("viewer"), false);
assert.equal(ONBOARDING_OVERRIDE_ROLE_SLUGS.has("super_admin"), true);

console.log("onboarding-transitions.test.ts: all assertions passed");
