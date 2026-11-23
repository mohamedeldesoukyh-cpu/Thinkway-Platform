import assert from "node:assert/strict";
import { test } from "node:test";
import { formatClientCreatedDate } from "./client-created-date";

test("created dates match across server and browser timezones including Cairo DST", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Africa/Cairo", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = timezone;
      assert.equal(formatClientCreatedDate("2026-06-17T23:26:01.660474+00:00"), "Jun 18, 2026");
      assert.equal(formatClientCreatedDate("2026-01-01T22:30:00Z"), "Jan 2, 2026");
      assert.equal(formatClientCreatedDate("2026-06-17T21:30:00Z"), "Jun 18, 2026");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
