import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Empty Content-Type previously skipped the MIME allowlist.
 * uploadEntityDocument must require a non-empty allowlisted type.
 */
function testEntityUploadRejectsEmptyMime(): void {
  const source = readFileSync(resolve("lib/supabase/storage.ts"), "utf8");
  assert.match(
    source,
    /!mimeType\s*\|\|\s*!ALLOWED_MIME_TYPES\.has\(mimeType\)/
  );
  assert.equal(
    /if\s*\(\s*params\.file\.type\s*&&\s*!ALLOWED_MIME_TYPES/.test(source),
    false,
    "empty MIME must not bypass allowlist via truthy short-circuit"
  );
}

testEntityUploadRejectsEmptyMime();
console.log("storage-mime.test.ts: PASS");
