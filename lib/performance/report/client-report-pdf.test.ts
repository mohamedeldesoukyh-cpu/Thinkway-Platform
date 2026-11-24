import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PDFDocument, PDFArray, PDFName } from "pdf-lib";
import { prepareClientReportHtml, setClientReportActualSize } from "./client-report-pdf";

test("client report embeds static fonts and downsizes export images without cropping", async () => {
  const original = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: "#1458de" } }).png().toBuffer();
  const html = await prepareClientReportHtml(`<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');:root{--pad:15mm;--ink:#111726}</style><img src="data:image/png;base64,${original.toString("base64")}"/>`);
  assert.doesNotMatch(html, /fonts.googleapis.com/);
  assert.equal((html.match(/@font-face/g) ?? []).length, 6);
  assert.match(html, /:root\{--pad:15mm;--ink:#111726\}/);
  assert.doesNotMatch(html, /400;600;700|display=swap/);
  const data = html.match(/data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)/)![1];
  const image = Buffer.from(data, "base64");
  const meta = await sharp(image).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 1600);
  assert.ok(image.length < original.length);
});

test("PDF opens at 100% with actual-size printing and preserves A4 geometry", async () => {
  const input = await PDFDocument.create(); input.addPage([595.28, 841.89]);
  const output = await PDFDocument.load(await setClientReportActualSize(await input.save()));
  const action = output.catalog.lookup(PDFName.of("OpenAction"), PDFArray);
  assert.equal(action.get(1).toString(), "/XYZ");
  assert.equal(action.get(4).toString(), "1");
  assert.equal(output.catalog.getOrCreateViewerPreferences().getPrintScaling(), "None");
  assert.deepEqual(output.getPage(0).getSize(), input.getPage(0).getSize());
});
