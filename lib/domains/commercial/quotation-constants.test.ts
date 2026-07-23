import assert from "node:assert/strict";
import { test } from "node:test";

import {
  quotationDetailPath,
  quotationPreviewPath,
} from "@/lib/domains/commercial/quotation-constants";

test("quotationDetailPath prefers serial over uuid", () => {
  assert.equal(
    quotationDetailPath("0abc6515-4f90-4d69-8148-831d90be569c", "QT-2026-0015"),
    "/discovery/quotations/QT-2026-0015"
  );
});

test("quotationDetailPath falls back to uuid when serial missing", () => {
  assert.equal(
    quotationDetailPath("0abc6515-4f90-4d69-8148-831d90be569c"),
    "/discovery/quotations/0abc6515-4f90-4d69-8148-831d90be569c"
  );
});

test("quotationPreviewPath includes serial and query", () => {
  assert.equal(
    quotationPreviewPath("abc", "QT-2026-0015", "template=showcase"),
    "/discovery/quotations/QT-2026-0015/preview?template=showcase"
  );
});
