import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { IO_CLASSIC_DOCUMENT_STYLES } from "@/lib/io/io-classic-document-styles";
import { INSERTION_ORDER_PDF_OPTIONS } from "@/lib/io/vendor-io-pdf";

test("CIO classic print CSS allows sections to break across pages", () => {
  assert.match(IO_CLASSIC_DOCUMENT_STYLES, /@page\s*\{\s*size:\s*A4;\s*margin:\s*14mm\s*\}/);
  assert.match(IO_CLASSIC_DOCUMENT_STYLES, /\.qsec,\.section\{[^}]*break-inside:\s*auto/);
  assert.match(
    IO_CLASSIC_DOCUMENT_STYLES,
    /\.qh\{[^}]*break-after:\s*avoid[^}]*page-break-after:\s*avoid/
  );
  assert.match(IO_CLASSIC_DOCUMENT_STYLES, /\.qgrid2\s*>\s*\.qcard/);
  assert.match(
    IO_CLASSIC_DOCUMENT_STYLES,
    /\.qtable thead,\.deliv-table thead\{[^}]*display:\s*table-header-group/
  );
  assert.match(IO_CLASSIC_DOCUMENT_STYLES, /orphans:\s*3/);
  assert.match(IO_CLASSIC_DOCUMENT_STYLES, /widows:\s*3/);
});

test("CIO shell template keeps section break-inside auto contract", () => {
  const html = readFileSync(
    join(process.cwd(), "lib/io/templates/Thinkway_Client_IO_Global.html"),
    "utf8"
  );
  assert.match(html, /@page\s*\{/);
  assert.match(html, /margin:\s*14mm/);
  assert.match(html, /\.section\s*\{\s*[^}]*break-inside:\s*auto/);
  assert.doesNotMatch(html, /\.section\s*\{\s*page-break-inside:\s*avoid/);
  assert.match(html, /\.deliv-table thead\s*\{\s*[^}]*display:\s*table-header-group/);
});

test("INSERTION_ORDER_PDF_OPTIONS defers margins to CSS @page", () => {
  assert.equal(INSERTION_ORDER_PDF_OPTIONS.preferCSSPageSize, true);
  assert.equal(INSERTION_ORDER_PDF_OPTIONS.margin.top, "0mm");
  assert.equal(INSERTION_ORDER_PDF_OPTIONS.margin.bottom, "0mm");
});

test("Client IO document route uses INSERTION_ORDER_PDF_OPTIONS for live PDF", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/client-ios/[id]/document/route.ts"),
    "utf8"
  );
  assert.match(source, /INSERTION_ORDER_PDF_OPTIONS/);
  assert.match(source, /renderHtmlToPdf\(\s*html,\s*INSERTION_ORDER_PDF_OPTIONS\s*\)/);
  assert.doesNotMatch(source, /renderHtmlToPdf\(\s*html\s*\)/);
});

test("Vendor IO document route uses INSERTION_ORDER_PDF_OPTIONS for live PDF", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/vendor-ios/[id]/document/route.ts"),
    "utf8"
  );
  assert.match(source, /INSERTION_ORDER_PDF_OPTIONS/);
  assert.match(source, /renderHtmlToPdf\(\s*html,\s*INSERTION_ORDER_PDF_OPTIONS\s*\)/);
  assert.doesNotMatch(source, /renderHtmlToPdf\(\s*html\s*\)/);
});
