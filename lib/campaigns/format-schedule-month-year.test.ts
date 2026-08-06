import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatScheduleMonthYear,
  formatScheduleMonthYearRange,
} from "@/lib/campaigns/format-schedule-month-year";

test("formatScheduleMonthYear formats MM/YY", () => {
  assert.equal(formatScheduleMonthYear("2026-08-06"), "08/26");
  assert.equal(formatScheduleMonthYear(null), null);
});

test("formatScheduleMonthYearRange collapses unique months", () => {
  assert.equal(
    formatScheduleMonthYearRange(["2026-08-01", "2026-08-15", "2026-09-01"]),
    "08/26 – 09/26"
  );
  assert.equal(formatScheduleMonthYearRange([]), "—");
});
