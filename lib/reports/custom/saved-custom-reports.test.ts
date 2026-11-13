import assert from "node:assert/strict";
import test from "node:test";
import { readSavedCustomReports, savedCustomReportSchema, savedCustomReportUrl } from "./saved-custom-reports";

const saved = { id: "c32867fc-32ef-49d6-bc4b-791067ec2683", name: "Creator USD report", favorite: true, columns: ["campaignNumber", "creator", "totalRevenue"], currency: "Foreign", includeVat: true, filters: { recordCurrency: "USD", clientId: "e360040f-83c9-4eee-aef7-71fab6c3695e" } };
test("saved report round trip keeps selection, filters, VAT and favorites", () => {
  const report = savedCustomReportSchema.parse(saved);
  assert.deepEqual(readSavedCustomReports([saved]), [report]);
  const preview = new URL(savedCustomReportUrl(report, true), "https://example.test");
  assert.equal(preview.searchParams.get("columns"), "campaignNumber,creator,totalRevenue");
  assert.equal(preview.searchParams.get("includeVat"), "1");
  assert.equal(preview.searchParams.get("recordCurrency"), "USD");
  assert.equal(preview.searchParams.get("currency"), "Foreign");
  assert.equal(preview.searchParams.get("asOf"), null);
  assert.equal(preview.searchParams.get("format"), "html");
  assert.equal(new URL(savedCustomReportUrl(report), "https://example.test").searchParams.get("savedReport"), saved.id);
});
test("invalid saved selections cannot introduce arbitrary fields or filters", () => {
  assert.equal(readSavedCustomReports([{...saved, columns: ["secret"]}]).length, 0);
  assert.equal(readSavedCustomReports([{...saved, name: " "}]).length, 0);
  assert.equal(readSavedCustomReports([{...saved, filters: {clientId: "invalid"}}]).length, 0);
  const parsed = savedCustomReportSchema.parse({...saved, columns: ["creator", "creator"], filters: {...saved.filters, userId: "other"}});
  assert.deepEqual(parsed.columns, ["creator"]);
  assert.equal("userId" in parsed.filters, false);
});
