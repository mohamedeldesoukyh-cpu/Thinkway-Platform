import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyThinkwayLogoToDocumentHtml,
  THINKWAY_LOGO_PUBLIC_PATHS,
} from "@/lib/reports/document/thinkway-report-logo";

test("applyThinkwayLogoToDocumentHtml uses dark-theme logo on navy headers", () => {
  const html = `<html><head><style></style></head><body>
    <div class="doc-header"><div class="logo-text">THINK<span>WAY</span></div></div>
  </body></html>`;

  const result = applyThinkwayLogoToDocumentHtml(html);
  assert.match(result, /thinkway-report-logo--dark/);
  assert.match(result, new RegExp(THINKWAY_LOGO_PUBLIC_PATHS.dark.replace("/", "\\/")));
  assert.doesNotMatch(result, new RegExp(THINKWAY_LOGO_PUBLIC_PATHS.light.replace("/", "\\/")));
  assert.doesNotMatch(result, /class="logo-text"/);
});
