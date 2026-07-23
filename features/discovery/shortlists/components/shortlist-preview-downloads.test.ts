import assert from "node:assert/strict";

import { buildShortlistExportHref } from "./shortlist-preview-downloads";
import {
  appendShortlistTemplateParam,
  resolveShortlistTemplate,
} from "@/features/discovery/shortlists/export/shortlist-template";

{
  const href = buildShortlistExportHref("e182c6c2-4e66-43d9-ad0f-4ff06f549271", "pdf", "showcase", {
    download: true,
  });
  assert.equal(
    href,
    "/api/shortlists/e182c6c2-4e66-43d9-ad0f-4ff06f549271/export?format=pdf&download=1&template=showcase"
  );
}

{
  const href = buildShortlistExportHref("sl-1", "html", "showcase", {
    exportRevision: "2026-07-13T08:00:00.000Z",
  });
  assert.ok(href.includes("format=html"));
  assert.ok(href.includes("template=showcase"));
  assert.ok(href.includes("v=2026-07-13T08%3A00%3A00.000Z"));
}

{
  const href = buildShortlistExportHref("sl-1", "pptx", "showcase");
  assert.ok(href.includes("format=pptx"));
  assert.ok(href.includes("template=showcase"));
}

{
  const href = buildShortlistExportHref("sl-1", "excel", "summary");
  assert.ok(href.includes("format=excel"));
  assert.ok(!href.includes("template="), "summary omits template param (default)");
}

{
  const params = new URLSearchParams({ format: "preview" });
  appendShortlistTemplateParam(params, "showcase");
  assert.equal(params.get("template"), "showcase");
  appendShortlistTemplateParam(params, "summary");
  assert.equal(params.get("template"), null);
}

{
  assert.equal(resolveShortlistTemplate("showcase"), "showcase");
  assert.equal(resolveShortlistTemplate("pitch"), "pitch");
  assert.equal(resolveShortlistTemplate("detailed"), "detailed");
  assert.equal(resolveShortlistTemplate(null), "summary");
}

{
  const href = buildShortlistExportHref("sl-1", "pptx", "pitch");
  assert.ok(href.includes("format=pptx"));
  assert.ok(href.includes("template=pitch"));
}

console.log("shortlist-preview-downloads.test.ts: ok");
