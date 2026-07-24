import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_DENIED_REPORT_TYPES,
  AI_INTERNAL_ONLY_TOOLS,
  assertAiReportTypeAllowed,
  assertAiToolAllowedForWorkspace,
  isAiToolNameForbidden,
} from "./ai-workspace-isolation";

test("registered Discovery AI tools are not finance-shaped", () => {
  for (const name of AI_INTERNAL_ONLY_TOOLS) {
    assert.equal(
      isAiToolNameForbidden(name),
      false,
      `tool ${name} looks like finance/ops`,
    );
    assert.doesNotThrow(() => assertAiToolAllowedForWorkspace(name));
  }
});

test("billing report type denied (AI → Finance boundary)", () => {
  assert.throws(
    () => assertAiReportTypeAllowed("billing"),
    /billing|finance/i,
  );
  assert.doesNotThrow(() => assertAiReportTypeAllowed("performance"));
  assert.doesNotThrow(() => assertAiReportTypeAllowed("deliverables"));
  assert.ok(AI_DENIED_REPORT_TYPES.includes("billing"));
});

test("forbidden tool name patterns catch privilege escalation attempts", () => {
  for (const name of [
    "getFinanceInvoice",
    "listBillingPeriods",
    "fetchTreasuryBalance",
    "updateExchangeRate",
    "createCreditNote",
    "postingCenterSync",
    "collectionsAging",
  ]) {
    assert.equal(isAiToolNameForbidden(name), true, name);
    assert.throws(() => assertAiToolAllowedForWorkspace(name));
  }
});
