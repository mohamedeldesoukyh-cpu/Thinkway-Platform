import assert from "node:assert/strict";

import { assessClientFinanceReadiness, isFinanceOnboardingRequired } from "./finance-readiness";

assert.equal(isFinanceOnboardingRequired(false), false);
assert.equal(isFinanceOnboardingRequired(true), true);

const notRequired = assessClientFinanceReadiness({
  credit_limit_active: false,
  finance_completed_at: null,
});
assert.equal(notRequired.required, false);
assert.equal(notRequired.complete, true);
assert.deepEqual(notRequired.missing, []);

const requiredIncomplete = assessClientFinanceReadiness({
  credit_limit_active: true,
  finance_completed_at: null,
});
assert.equal(requiredIncomplete.required, true);
assert.equal(requiredIncomplete.complete, false);
assert.deepEqual(requiredIncomplete.missing, ["Finance approval"]);

const requiredComplete = assessClientFinanceReadiness({
  credit_limit_active: true,
  finance_completed_at: "2026-06-02T00:00:00.000Z",
});
assert.equal(requiredComplete.required, true);
assert.equal(requiredComplete.complete, true);
assert.deepEqual(requiredComplete.missing, []);

console.log("finance-readiness.test.ts: all assertions passed");
