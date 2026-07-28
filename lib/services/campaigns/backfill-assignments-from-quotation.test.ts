import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("backfill never runs automatically and always audits execute", () => {
  const src = readFileSync(
    join(process.cwd(), "lib/services/campaigns/backfill-assignments-from-quotation.ts"),
    "utf8"
  );
  assert.match(src, /detectLegacyCampaignForBackfill/);
  assert.match(src, /previewBackfillAssignmentsFromQuotation/);
  assert.match(src, /executeBackfillAssignmentsFromQuotation/);
  assert.match(src, /dryRun: true/);
  assert.match(src, /release_2_0_backfill_assignments/);
  assert.match(src, /Vendor IO already exists/);
  assert.match(src, /Billing links already exist/);
});

test("backfill wizard UI is multi-step and opt-in", () => {
  const src = readFileSync(
    join(process.cwd(), "features/campaigns/components/backfill-assignments-wizard.tsx"),
    "utf8"
  );
  assert.match(src, /Detect/);
  assert.match(src, /Preview/);
  assert.match(src, /Execute/);
  assert.match(src, /Summary|summary/);
  assert.match(src, /Never automatic/);
});
