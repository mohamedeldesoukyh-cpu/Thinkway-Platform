import assert from "node:assert/strict";

import { buildExportHref } from "./quotation-preview-downloads";
import {
  appendQuotationTemplateParam,
  resolveQuotationTemplate,
} from "@/features/quotations/export/quotation-template";

{
  const href = buildExportHref("e182c6c2-4e66-43d9-ad0f-4ff06f549271", "pdf", "showcase", {
    download: true,
  });
  assert.ok(href.includes("format=pdf"));
  assert.ok(href.includes("download=1"));
  assert.ok(href.includes("template=showcase"));
  assert.ok(href.includes("v="), "export URLs always include a revision stamp");
}

{
  const href = buildExportHref("q-1", "pdf", "showcase-lump-sum");
  assert.ok(href.includes("format=pdf"));
  assert.ok(href.includes("download=1"));
  assert.ok(href.includes("template=showcase-lump-sum"));
}

{
  const href = buildExportHref("q-1", "word", "lump-sum");
  assert.ok(href.includes("format=word"));
  assert.ok(href.includes("template=lump-sum"));
}

{
  const href = buildExportHref("q-1", "pdf", "detailed");
  assert.ok(href.includes("format=pdf"));
  assert.ok(href.includes("download=1"));
  assert.ok(!href.includes("template="), "detailed omits template param (default)");
  assert.ok(href.includes("v="));
}

{
  const href = buildExportHref("q-1", "excel", "showcase", { download: false });
  assert.ok(href.includes("format=excel"));
  assert.ok(href.includes("template=showcase"));
  assert.ok(!href.includes("download="));
}

{
  const params = new URLSearchParams({ format: "pdf" });
  appendQuotationTemplateParam(params, "showcase");
  assert.equal(params.get("template"), "showcase");
  appendQuotationTemplateParam(params, "detailed");
  assert.equal(params.get("template"), null);
}

{
  const href = buildExportHref("q-1", "pptx", "detailed");
  assert.ok(href.includes("format=pptx"));
  assert.ok(!href.includes("template="), "detailed omits template param (default)");
}

{
  const href = buildExportHref("q-1", "pptx", "showcase");
  assert.ok(href.includes("format=pptx"));
  assert.ok(href.includes("template=showcase"));
}

{
  assert.equal(resolveQuotationTemplate("showcase"), "showcase");
  assert.equal(resolveQuotationTemplate("pitch"), "pitch");
  assert.equal(resolveQuotationTemplate("pitch-lump-sum"), "pitch-lump-sum");
  assert.equal(resolveQuotationTemplate("showcase-lump-sum"), "showcase-lump-sum");
  assert.equal(
    resolveQuotationTemplate(new URLSearchParams("template=showcase").get("template")),
    "showcase"
  );
}

{
  const href = buildExportHref("q-1", "pptx", "pitch");
  assert.ok(href.includes("format=pptx"));
  assert.ok(href.includes("template=pitch"));
}

{
  const href = buildExportHref("q-1", "pdf", "showcase", {
    itemIds: ["item-a", "item-b"],
    exportRevision: "2026-08-11T12:00:00.000Z",
  });
  assert.ok(href.includes("items=item-a%2Citem-b") || href.includes("items=item-a,item-b"));
  assert.ok(href.includes("v="));
  assert.ok(href.includes("2026-08-11"));
}

{
  const href = buildExportHref("q-1", "html", "showcase", { download: true });
  assert.ok(href.includes("format=html"));
  assert.ok(href.includes("download=1"));
  assert.ok(href.includes("template=showcase"));
}

console.log("quotation-preview-downloads.test.ts: ok");
