import assert from "node:assert/strict";

import {
  compressExportDataUri,
  compressExportImageBuffer,
  cropExportImageBufferCover,
  exportImageBufferMeetsMinEdge,
  imageBufferLooksComplete,
  imageLongestEdge,
  isVisiblyLowResolutionImage,
  isVisiblyOvercompressedPhoto,
  jpegQualityEstimate,
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

  {
    const sharp = (await import("sharp")).default;
    const large = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 20, g: 40, b: 80 } },
    })
      .jpeg()
      .toBuffer();
    assert.equal(await imageLongestEdge(large), 800);
    assert.equal(isVisiblyLowResolutionImage(150, 640), true);
    assert.equal(isVisiblyLowResolutionImage(0, 640), false);
    assert.equal(isVisiblyLowResolutionImage(1080, 640), false);
    assert.equal(await exportImageBufferMeetsMinEdge(Buffer.alloc(8), 160), false);
    assert.equal(await exportImageBufferMeetsMinEdge(large, 160), true);
    assert.equal(await exportImageBufferMeetsMinEdge(large, 1200), false);
    assert.equal(imageBufferLooksComplete(large), true);
    const truncated = large.subarray(0, Math.max(128, large.length - 40));
    assert.equal(imageBufferLooksComplete(truncated), false, "chopped JPEG is not complete");
    assert.equal(
      await exportImageBufferMeetsMinEdge(truncated, 160),
      false,
      "truncated JPEG must not be embedded"
    );
  }

  {
    const sharp = (await import("sharp")).default;
    const posterized = await sharp({
      create: { width: 1080, height: 1080, channels: 3, background: { r: 90, g: 60, b: 40 } },
    })
      .jpeg({ quality: 8 })
      .toBuffer();
    const posterizedQuality = jpegQualityEstimate(posterized);
    assert.ok(
      posterizedQuality != null && posterizedQuality < 32,
      `e15-class JPEG quality should be <32, got ${posterizedQuality}`
    );
    assert.equal(
      isVisiblyOvercompressedPhoto(posterized),
      true,
      "Instagram e15-class JPEGs are rejected"
    );

    const solidPhotographic = await sharp({
      create: { width: 1080, height: 1080, channels: 3, background: { r: 20, g: 40, b: 80 } },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    assert.equal(
      isVisiblyOvercompressedPhoto(solidPhotographic),
      false,
      "high-quality JPEGs are not rejected even when they compress to few bytes/pixel"
    );

    const circles = Array.from({ length: 120 }, (_, i) => {
      const x = (i * 97) % 1080;
      const y = (i * 53) % 1080;
      return `<circle cx="${x}" cy="${y}" r="${10 + (i % 18)}" fill="rgb(${(i * 19) % 255},${(i * 47) % 255},${(i * 73) % 255})"/>`;
    }).join("");
    const detailed = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">${circles}</svg>`
      )
    )
      .jpeg({ quality: 90 })
      .toBuffer();
    const detailedQuality = jpegQualityEstimate(detailed);
    assert.ok(
      detailedQuality != null && detailedQuality >= 80,
      `normal JPEG quality should be high, got ${detailedQuality}`
    );
    assert.equal(
      isVisiblyOvercompressedPhoto(detailed),
      false,
      "normal-quality photos are not rejected"
    );
  }

  console.log("compress-export-image.test.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
