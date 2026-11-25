import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuotationHtml } from "./quotation-html";
import type { QuotationDocument } from "./quotation-document";
import sharp from "sharp";
import { QUOTATION_PDF_COVER_OVERLAY, QUOTATION_PDF_CLOSING_OVERLAY } from "./quotation-pdf-overlay-images";

test("PDF cover and closing use compatible overlays without changing the HTML preview", () => {
  const doc = { name:"Campaign", clientName:"Client", serial:"QT-test", issueDateLabel:"25 Nov 2026", template:"creator-list", hideCostAndFees:false, creatorGroups:[] } as unknown as QuotationDocument;
  const preview = buildQuotationHtml(doc);
  const pdf = buildQuotationHtml(doc, {forPdf:true});
  assert.ok(!preview.includes("data-quotation-pdf-backgrounds"));
  const override = pdf.match(/<style data-quotation-pdf-backgrounds>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(override);
  assert.match(override, /\.page--cov \.veil/);
  assert.match(override, /\.page--end \.veil--end/);
  assert.equal((override.match(/data:image\/png;base64,/g) ?? []).length, 2);
  assert.doesNotMatch(override, /gradient/);
  assert.equal(pdf.replace(/<style data-quotation-pdf-backgrounds>[\s\S]*?<\/style>/,""),preview);
});

test("PDF veils retain transparent photo areas instead of hiding the mosaic", async () => {
  for (const [overlay, maximumMinAlpha, minimumFade] of [
    [QUOTATION_PDF_COVER_OVERLAY, 150, 100],
    [QUOTATION_PDF_CLOSING_OVERLAY, 200, 40],
  ] as const) {
    const { data, info } = await sharp(Buffer.from(overlay.split(",")[1], "base64")).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    let min = 255;
    let max = 0;
    for (let i = 3; i < data.length; i += 4) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
    }
    assert.ok(min < maximumMinAlpha, "Photos must retain the preview's visibility through the veil");
    assert.ok(max - min > minimumFade, "Veil must retain its original fade");
    const middleY = Math.floor(info.height / 2);
    const alphaAt = (x: number) => data[(middleY * info.width + x) * 4 + 3];
    assert.ok(alphaAt(0) - alphaAt(info.width - 1) > 100, "Left must be darker than right");
    for (let x = 1; x < info.width; x++) {
      assert.ok(alphaAt(x) <= alphaAt(x - 1) + 1, "Fade must gradually lighten to the right");
    }
  }
});
