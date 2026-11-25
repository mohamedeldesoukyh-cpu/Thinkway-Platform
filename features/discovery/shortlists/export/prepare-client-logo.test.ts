import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { prepareClientLogo } from "./prepare-client-logo";

test("bounds oversized artwork before embedding, preserving aspect ratio and transparency", async () => {
  const original = await sharp({create:{width:9546,height:1488,channels:4,background:{r:10,g:30,b:60,alpha:0.5}}}).png().toBuffer();
  const png = await prepareClientLogo(original, false);
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 1260);
  assert.equal(metadata.height, 196);
  assert.equal(metadata.hasAlpha, true);
  assert.ok((metadata.width! * metadata.height!) < 9546 * 1488 / 50);
});

test("keeps small logos sharp and preserves white-on-dark treatment", async () => {
  const image = await sharp({create:{width:20,height:10,channels:4,background:'black'}}).png().toBuffer();
  const result = await prepareClientLogo(image, true);
  const {data,info}=await sharp(result).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,20);
  assert.deepEqual([...data.subarray(0,4)],[255,255,255,255]);
});
