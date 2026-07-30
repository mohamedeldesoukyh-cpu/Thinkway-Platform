import assert from "node:assert/strict";
import test from "node:test";

import {
  collectRemoteImgSrcs,
  inlineRemoteImagesInHtml,
} from "@/lib/io/pdf-inline-remote-images";

test("collectRemoteImgSrcs finds unique http image URLs", () => {
  const html = `
    <img class="cav" src="https://example.supabase.co/storage/v1/object/public/creator-avatars/a.jpg" />
    <img src='https://cdn.example/b.png' alt="" />
    <img src="data:image/png;base64,abc" />
    <img src="https://example.supabase.co/storage/v1/object/public/creator-avatars/a.jpg" />
  `;
  const urls = collectRemoteImgSrcs(html);
  assert.equal(urls.length, 2);
  assert.ok(urls.some((url) => url.includes("creator-avatars")));
  assert.ok(urls.some((url) => url.includes("cdn.example")));
});

test("inlineRemoteImagesInHtml replaces Thinkway storage img src with data URIs", async () => {
  const storageUrl =
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/inf/instagram/creator.jpg";
  // Valid 1×1 JPEG so sharp/canvas compress does not panic on truncated bytes.
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
    "base64"
  );
  const html = `<div><img class="cav" src="${storageUrl}" alt="" /></div>`;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === storageUrl) {
      return new Response(jpeg, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const next = await inlineRemoteImagesInHtml(html);
    assert.ok(next.includes('src="data:image/'), "storage avatar must be inlined");
    assert.ok(!next.includes(storageUrl), "remote storage URL must be removed from HTML");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
