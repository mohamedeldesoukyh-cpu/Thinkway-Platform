import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

test("createCampaignFromQuotation wires dual-event helper", () => {
  const src = readFileSync(
    resolve("lib/services/quotations/quotation-lifecycle-service.ts"),
    "utf8"
  );
  assert.match(src, /ensureCommercialCreatorFromQuoteToCampaign/);
  assert.match(src, /quotation_operational|createCampaignFromQuotation/);
});

test("draft quotation create paths do not import CRM activation helpers", () => {
  const service = readFileSync(
    resolve("lib/services/quotations/quotation-service.ts"),
    "utf8"
  );
  const sync = readFileSync(resolve("lib/commercial-sync/engine.ts"), "utf8");
  for (const src of [service, sync]) {
    assert.equal(src.includes("ensureCommercialCreator"), false);
    assert.equal(src.includes("maybeActivateCommercialCreatorForAssignment"), false);
    assert.equal(src.includes("ensureCommercialCreatorFromQuoteToCampaign"), false);
  }
});

test("Discovery promote and Apify identity do not import CRM activation", () => {
  const promote = readFileSync(resolve("lib/discovery/promote-profile.ts"), "utf8");
  const apify = readFileSync(resolve("lib/discovery/apify-import-pipeline.ts"), "utf8");
  for (const src of [promote, apify]) {
    assert.equal(src.includes("ensureCommercialCreator"), false);
    assert.equal(src.includes("maybeActivateCommercialCreatorForAssignment"), false);
  }
});
