import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatDesignDate,
  formatDesignDateRange,
  formatDesignDateRaw,
  isDesignDateMissing,
} from "@/lib/design/format-design-date";

test("D() maps mixed inputs to DD Mon YY", () => {
  assert.equal(formatDesignDateRaw("2026-08-04"), "04 Aug 26");
  assert.equal(formatDesignDateRaw("31/07/2026"), "31 Jul 26");
  assert.equal(formatDesignDateRaw("Sep 3, 2026"), "03 Sep 26");
  assert.equal(formatDesignDateRaw("Sep 1, 11:21"), "01 Sep 26 · 11:21");
  assert.equal(formatDesignDateRaw("03 Aug–05 Aug"), "03–05 Aug 26");
  assert.equal(formatDesignDateRaw("04.08.2026"), "04 Aug 26");
  assert.equal(formatDesignDateRaw("2026-08-04T11:21:00"), "04 Aug 26 · 11:21");
});

test("missing dates are not set, never em dash", () => {
  assert.equal(formatDesignDateRaw(null), "");
  assert.equal(formatDesignDateRaw("—"), "");
  assert.equal(formatDesignDate(null), "not set");
  assert.equal(formatDesignDate(""), "not set");
  assert.ok(isDesignDateMissing(null));
});

test("ranges collapse when month and year match", () => {
  assert.equal(
    formatDesignDateRange("2026-08-03", "2026-08-05"),
    "03–05 Aug 26"
  );
  assert.equal(
    formatDesignDateRange("2026-08-03", "2026-09-05"),
    "03 Aug 26 – 05 Sep 26"
  );
});
