import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("next is pinned to a patched 16.2.x release (>= 16.2.11)", () => {
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
    major > 16 || (major === 16 && (minor > 2 || (minor === 2 && patch >= 11))),
    `next ${next} is below patched 16.2.11`
  );
});

test("xlsx community package remains explicitly deferred", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  ) as { dependencies: Record<string, string> };
  assert.ok(pkg.dependencies.xlsx, "xlsx still present (deferred replacement)");
  // Documented deferral: no secure community fix path; exceljs preferred for new writers.
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
