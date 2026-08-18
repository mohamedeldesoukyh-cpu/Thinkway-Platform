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
  assert.ok(href.startsWith("/api/shortlists/e182c6c2-4e66-43d9-ad0f-4ff06f549271/export?"));
  assert.ok(href.includes("format=pdf"));
  assert.ok(href.includes("download=1"));
  assert.ok(href.includes("template=showcase"));
}

{
  const href = buildShortlistExportHref("sl-1", "html", "showcase", {
    exportRevision: "2026-07-13T08:00:00.000Z",
  });
  assert.ok(href.includes("format=html"));
  assert.ok(href.includes("template=showcase"));
  assert.ok(href.includes("v="));
  assert.ok(href.includes("2026-07-13T08"));
}

{
  const href = buildShortlistExportHref("sl-1", "pptx", "showcase");
  assert.ok(href.includes("format=pptx"));
  assert.ok(href.includes("template=showcase"));
}

{
  const href = buildShortlistExportHref("sl-1", "excel", "detailed");
  assert.ok(href.includes("format=excel"));
  assert.ok(!href.includes("template="), "detailed omits template param (default)");
}

{
  const params = new URLSearchParams({ format: "preview" });
  appendShortlistTemplateParam(params, "showcase");
  assert.equal(params.get("template"), "showcase");
  appendShortlistTemplateParam(params, "detailed");
  assert.equal(params.get("template"), null);
  appendShortlistTemplateParam(params, "lump-sum");
  assert.equal(params.get("template"), "lump-sum");
}

{
  assert.equal(resolveShortlistTemplate("showcase"), "showcase");
  assert.equal(resolveShortlistTemplate("pitch"), "pitch");
  assert.equal(resolveShortlistTemplate("detailed"), "detailed");
  assert.equal(resolveShortlistTemplate("lump-sum"), "lump-sum");
  assert.equal(resolveShortlistTemplate("showcase-lump-sum"), "showcase-lump-sum");
  assert.equal(resolveShortlistTemplate("pitch-lump-sum"), "pitch-lump-sum");
  assert.equal(resolveShortlistTemplate("summary"), "lump-sum");
  assert.equal(resolveShortlistTemplate(null), "detailed");
}

{
  const href = buildShortlistExportHref("sl-1", "pptx", "pitch");
  assert.ok(href.includes("format=pptx"));
  assert.ok(href.includes("template=pitch"));
}

{
  const href = buildShortlistExportHref("sl-1", "pdf", "showcase", {
    itemIds: ["a", "b"],
  });
  assert.ok(href.includes("items=a%2Cb") || href.includes("items=a,b"));
}

{
  const href = buildShortlistExportHref("sl-1", "pptx", "detailed");
  assert.ok(href.includes("format=pptx"));
  assert.ok(!href.includes("template="));
}

console.log("shortlist-preview-downloads.test.ts: ok");
