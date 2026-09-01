import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { pptxPublicationImageSpec } from "@/lib/performance/report/performance-report-pptx";

test("PPTX publication spec keeps original data URI bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const spec = pptxPublicationImageSpec(dataUri);
  assert.deepEqual(spec, { data: `image/jpeg;base64,${jpeg.toString("base64")}` });
});

test("PPTX publication spec passes through remote URLs without rewriting", () => {
  const spec = pptxPublicationImageSpec(
    "https://abc.supabase.co/storage/v1/object/public/campaign-publication-media/shot.jpg"
  );
  assert.deepEqual(spec, {
    path: "https://abc.supabase.co/storage/v1/object/public/campaign-publication-media/shot.jpg",
  });
});

test("performance report PPTX does not Sharp-crop publication images", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "performance-report-pptx.ts"), "utf8");
  assert.match(source, /pptxPublicationImageSpec/);
  assert.doesNotMatch(source, /cropExportImageBufferCover|toCompressedExportDataUri|SHOWCASE_PUBLICATION_COMPRESS/);
});
