import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("next is pinned to a patched 16.4.x release (>= 16.4.4)", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  ) as { dependencies: Record<string, string> };
  const next = pkg.dependencies.next;
  assert.ok(next, "next dependency missing");
  // Accept exact or range that resolves to patched line.
  const match = next.match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, `unexpected next version format: ${next}`);
  const major = Number(match![1]);
  const minor = Number(match![2]);
  const patch = Number(match![3]);
  assert.ok(
    major > 16 || (major === 16 && (minor > 4 || (minor === 4 && patch >= 4))),
    `next ${next} is below patched 16.4.4`
  );
});

test("xlsx uses the patched official SheetJS distribution", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  ) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies.xlsx, "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz");
  // The npm registry package is obsolete; use the vendor's patched distribution.
  assert.ok(pkg.dependencies.exceljs, "exceljs should remain available");
});

test("sanitize-html is installed for XSS sanitizer", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  ) as { dependencies: Record<string, string> };
  assert.ok(pkg.dependencies["sanitize-html"]);
});

test("sanitize-html is not server-externalized (htmlparser2 ESM-safe bundle)", () => {
  const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
  assert.equal(
    /serverExternalPackages:\s*\[[^\]]*["']sanitize-html["']/.test(config),
    false,
    "sanitize-html must be bundled — externalRequire + htmlparser2@12 throws ERR_REQUIRE_ESM"
  );
});
