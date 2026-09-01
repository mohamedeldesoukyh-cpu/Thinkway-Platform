import assert from "node:assert/strict";
import test from "node:test";

import {
  facebookMediaIdFromUrl,
  tryFacebookOembedThumbnail,
} from "./facebook-oembed";

test("facebookMediaIdFromUrl reads reel and reels permalinks", () => {
  assert.equal(
    facebookMediaIdFromUrl("https://www.facebook.com/reel/1849794332663999"),
    "1849794332663999"
  );
  assert.equal(
    facebookMediaIdFromUrl("https://www.facebook.com/reels/1849794332663999"),
    "1849794332663999"
  );
  assert.equal(
    facebookMediaIdFromUrl("https://www.facebook.com/watch/?v=123"),
    "123"
  );
});

test("tryFacebookOembedThumbnail uses Graph picture when a token is set", async () => {
  const previous = process.env.META_GRAPH_ACCESS_TOKEN;
  process.env.META_GRAPH_ACCESS_TOKEN = "test-token";
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetched.push(url);
    if (url.startsWith("https://graph.facebook.com/v21.0/1849794332663999")) {
      return Response.json({
        picture: "https://scontent.xx.fbcdn.net/v/t15/graph-thumb.jpg",
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const result = await tryFacebookOembedThumbnail({
      contentUrl: "https://www.facebook.com/reel/1849794332663999",
    });
    assert.equal(result.imageUrl, "https://scontent.xx.fbcdn.net/v/t15/graph-thumb.jpg");
    assert.ok(fetched.some((url) => url.includes("access_token=test-token")));
    assert.equal(
      fetched.some((url) => url.includes("plugins/video/oembed")),
      false,
      "Graph picture should short-circuit plugin oEmbed"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previous == null) delete process.env.META_GRAPH_ACCESS_TOKEN;
    else process.env.META_GRAPH_ACCESS_TOKEN = previous;
  }
});
