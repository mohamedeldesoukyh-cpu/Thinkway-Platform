import assert from "node:assert/strict";
import test from "node:test";

import { buildPerformanceReportFileBaseName } from "@/lib/performance/report/performance-report-filename";

test("buildPerformanceReportFileBaseName sanitizes campaign name and keeps document number", () => {
  assert.equal(
    buildPerformanceReportFileBaseName(
      "Arab Bank X La Liga Event",
      "TW-2026-0042",
      "combined"
    ),
    "Arab-Bank-X-La-Liga-Event_TW-2026-0042_Combined-Report"
  );
});

test("buildPerformanceReportFileBaseName uses influencer variant label", () => {
  assert.equal(
    buildPerformanceReportFileBaseName("Summer Launch", "TW-2026-0001", "influencers"),
    "Summer-Launch_TW-2026-0001_Influencer-Report"
  );
});
