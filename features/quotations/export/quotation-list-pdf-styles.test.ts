import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuotationHtml } from "./quotation-html";
import type { QuotationDocument } from "./quotation-document";

test("PDF cover and closing use compatible overlays without changing the HTML preview", () => {
  const doc = { name:"Campaign", clientName:"Client", serial:"QT-test", issueDateLabel:"25 Nov 2026", template:"creator-list", hideCostAndFees:false, creatorGroups:[] } as unknown as QuotationDocument;
  const preview = buildQuotationHtml(doc);
  const pdf = buildQuotationHtml(doc, {forPdf:true});
  assert.ok(!preview.includes("data-quotation-pdf-backgrounds"));
  const override = pdf.match(/<style data-quotation-pdf-backgrounds>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(override);
  assert.match(override, /\.page--cov \.veil/);
  assert.match(override, /\.page--end \.veil--end/);
  assert.match(override, /background:rgba\(5,4,67,\.96\)/);
  assert.doesNotMatch(override, /gradient/);
  assert.equal(pdf.replace(/<style data-quotation-pdf-backgrounds>[\s\S]*?<\/style>/,""),preview);
});
