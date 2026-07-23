import assert from "node:assert/strict";

import {
  compressExportDataUri,
  compressExportImageBuffer,
  cropExportImageBufferCover,
  toCompressedExportDataUri,
} from "./compress-export-image";

/** Minimal valid JPEG. */
function tinyJpeg(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
    "base64"
  );
}

async function main() {
  {
    const source = tinyJpeg();
    const compressed = await compressExportImageBuffer(source, {
      maxEdge: 192,
      quality: 70,
    });
    assert.ok(compressed, "compresses JPEG via sharp or canvas");
    assert.equal(compressed.contentType, "image/jpeg");
    assert.ok(compressed.buffer.length > 0);
  }

  {
    const source = tinyJpeg();
    const dataUri = `data:image/jpeg;base64,${source.toString("base64")}`;
    const out = await compressExportDataUri(dataUri, { maxEdge: 64, quality: 60 });
    assert.ok(out.startsWith("data:image/jpeg;base64,"));
  }

  {
    const source = tinyJpeg();
    const out = await toCompressedExportDataUri(source, "image/jpeg", {
      maxEdge: 64,
      quality: 60,
    });
    assert.ok(out.startsWith("data:image/jpeg;base64,"));
  }

  {
    const source = tinyJpeg();
    const cropped = await cropExportImageBufferCover(source, {
      aspectW: 1,
      aspectH: 1,
      maxEdge: 64,
    });
    assert.ok(cropped, "center-crops to square aspect");
    assert.equal(cropped.contentType, "image/jpeg");
    assert.ok(cropped.buffer.length > 0);
  }

  console.log("compress-export-image.test.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
