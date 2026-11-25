import assert from "node:assert/strict";
import { test } from "node:test";
import { quotationPhotoMosaic } from "./quotation-photo-mosaic";

test("background uses unique photos and both brand logos with stable placement", () => {
  const photos = ["a", "b", "a", "c", "d", "e", "f"];
  const tiles = quotationPhotoMosaic(photos, ["thinkway", "tw"], "QT-26-20-V2");
  assert.deepEqual(tiles, quotationPhotoMosaic(photos, ["thinkway", "tw"], "QT-26-20-V2"));
  assert.deepEqual(tiles.filter(t => t.kind === "portrait").map(t => t.src).sort(), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(tiles.filter(t => t.kind === "logo").map(t => t.src).sort(), ["thinkway", "tw"]);
  assert.equal(tiles.length, 8);
});
