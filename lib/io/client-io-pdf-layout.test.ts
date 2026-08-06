import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { INSERTION_ORDER_PDF_OPTIONS } from "@/lib/io/vendor-io-pdf";

test("CIO template print CSS allows sections to break across pages", () => {
  const html = readFileSync(
    join(process.cwd(), "lib/io/templates/Thinkway_Client_IO_Global.html"),
    "utf8"
  );
  assert.match(html, /@page\s*\{/);
  assert.match(html, /\.section\s*\{[^}]*break-inside:\s*auto/);
  assert.doesNotMatch(
    html,
    /\.section\s*\{\s*page-break-inside:\s*avoid/
  );
  assert.match(html, /\.deliv-table thead\s*\{[^}]*display:\s*table-header-group/);
});

test("INSERTION_ORDER_PDF_OPTIONS defers margins to CSS @page", () => {
  assert.equal(INSERTION_ORDER_PDF_OPTIONS.preferCSSPageSize, true);
  assert.equal(INSERTION_ORDER_PDF_OPTIONS.margin.top, "0mm");
  assert.equal(INSERTION_ORDER_PDF_OPTIONS.margin.bottom, "0mm");
});
