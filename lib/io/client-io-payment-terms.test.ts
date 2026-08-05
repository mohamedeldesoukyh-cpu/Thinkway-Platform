import { strict as assert } from "node:assert";
import { test } from "node:test";

import { CLIENT_IO_DEFAULT_TERMS } from "./client-io-default-terms";
import { buildClientIoMilestoneTemplate, validateClientIoMilestones } from "./client-io-milestones";
import {
  applyPaymentTermsClause,
  detectClientIoPaymentTermsPreset,
  getClientIoPaymentTermsPreset,
  isPaymentTermsClauseTitle,
} from "./client-io-payment-terms";

test("net day milestone templates total 100%", () => {
  for (const id of ["net_30", "net_60", "net_90"] as const) {
    const result = validateClientIoMilestones(buildClientIoMilestoneTemplate(id));
    assert.equal(result.ok, true, id);
  }
});

test("applyPaymentTermsClause updates Payment Terms body", () => {
  const preset = getClientIoPaymentTermsPreset("net_30");
  const next = applyPaymentTermsClause(CLIENT_IO_DEFAULT_TERMS, preset.clauseBody);
  const payment = next.find((term) => isPaymentTermsClauseTitle(term.title));
  assert.ok(payment);
  assert.match(payment!.body, /thirty \(30\) days/i);
  assert.equal(next.length, CLIENT_IO_DEFAULT_TERMS.length);
});

test("detectClientIoPaymentTermsPreset reads net offset milestones", () => {
  assert.equal(
    detectClientIoPaymentTermsPreset({
      billingTerms: null,
      milestones: buildClientIoMilestoneTemplate("net_60"),
    }),
    "net_60"
  );
  assert.equal(
    detectClientIoPaymentTermsPreset({
      billingTerms: "Advance — Prior to campaign launch",
      milestones: [],
    }),
    "advance"
  );
});
