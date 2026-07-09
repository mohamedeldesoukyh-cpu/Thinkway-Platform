import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { CreatorRecentPublication } from "@/lib/creators/types";

import {
  resolveExportPublicationShotProxyUrl,
  selectShowcasePublicationShots,
} from "./quotation-export-publications";

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/p/A/",
      thumbnail: "https://scontent.cdninstagram.com/v/example.jpg",
      likes: 10,
      comments: 1,
      views: null,
      posted_at: null,
      caption: "Post A",
    },
    {
      url: "https://www.instagram.com/p/B/",
      thumbnail: null,
      likes: 5,
      comments: 0,
      views: null,
      posted_at: null,
      caption: "No thumb",
    },
  ];

  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(shots.length, 2, "Includes thumb + postUrl-only rows for OG fallback");
  assert.equal(shots[0]?.imageUrl, "https://scontent.cdninstagram.com/v/example.jpg");
  assert.equal(shots[0]?.postUrl, "https://www.instagram.com/p/A/");
  assert.equal(shots[1]?.imageUrl, "");
  assert.equal(shots[1]?.postUrl, "https://www.instagram.com/p/B/");
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/reel/ABC123/",
      thumbnail: "https://cdn.example.com/reel.jpg",
      likes: 10,
      comments: 1,
      views: 5000,
      posted_at: null,
      caption: "Reel",
    },
    {
      url: "https://www.instagram.com/p/PHOTO/",
      thumbnail: "https://cdn.example.com/photo.jpg",
      likes: 5,
      comments: 0,
      views: null,
      posted_at: null,
      caption: "Photo",
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(shots[0]?.isVideo, true);
  assert.equal(shots[1]?.isVideo, false);
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/p/REEL-VIA-VIEWS/",
      thumbnail: "https://cdn.example.com/reel-via-views.jpg",
      likes: 10,
      comments: 1,
      views: 8000,
      posted_at: null,
      caption: "Reel stored as /p/",
      isVideo: true,
    },
    {
      url: "https://vm.tiktok.com/ZMabcdef/",
      thumbnail: "https://cdn.example.com/tt-short.jpg",
      likes: 20,
      comments: 2,
      views: 12000,
      posted_at: null,
      caption: "TikTok short link",
      isVideo: true,
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.ok(shots.every((shot) => shot.isVideo), "Normalized video flags survive shot selection");
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/p/A/",
      thumbnail: "https://cdn.example.com/a.jpg",
      likes: 10,
      comments: 1,
      views: null,
      posted_at: null,
      caption: "Post A",
    },
    {
      url: "https://www.instagram.com/p/C/",
      thumbnail: "https://cdn.example.com/c.jpg",
      likes: 20,
      comments: 2,
      views: null,
      posted_at: null,
      caption: "Post C",
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(shots.length, 2);
  assert.ok(shots.every((shot) => shot.imageUrl.startsWith("http")));
}

{
  const proxy = resolveExportPublicationShotProxyUrl({
    imageUrl: "https://scontent.cdninstagram.com/v/expired.jpg",
    postUrl: "https://www.instagram.com/p/ali123/",
    caption: null,
  });
  assert.ok(proxy?.startsWith("/api/creators/publication-preview?"));
  assert.ok(proxy?.includes("postUrl="));
  assert.ok(proxy?.includes("src="));
}

{
  const proxy = resolveExportPublicationShotProxyUrl({
    imageUrl: "",
    postUrl: "https://www.instagram.com/p/ali123/",
    caption: null,
  });
  assert.ok(proxy?.startsWith("/api/creators/publication-preview?"));
  assert.ok(proxy?.includes("postUrl="));
  assert.ok(!proxy?.includes("src="));
}

{
  const proxy = resolveExportPublicationShotProxyUrl({
    imageUrl: "https://example.supabase.co/storage/v1/object/public/media/shot.jpg",
    postUrl: "https://www.instagram.com/p/ali123/",
    caption: null,
  });
  assert.equal(proxy, null, "Durable Supabase thumbs do not need proxy path");
}

{
  const proxy = resolveExportPublicationShotProxyUrl({
    imageUrl: "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123",
    postUrl: "https://www.instagram.com/p/ali123/",
    caption: null,
  });
  assert.ok(proxy?.startsWith("/api/creators/publication-preview?"));
  assert.ok(proxy?.includes("postUrl="));
  assert.ok(proxy?.includes("src="));
}

{
  // Source guard: unresolved http thumbs must not survive Showcase embed
  // (they hang Puppeteer waitUntil:load / PDF export).
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "quotation-export-publications.ts"),
    "utf8"
  );
  assert.match(
    source,
    /Do not keep http\(s\) CDN URLs/,
    "embedPublicationShot must drop unresolved CDN URLs"
  );
  assert.match(
    source,
    /toCompressedExportDataUri|compressExportDataUri/,
    "Showcase publication shots must be compressed before data-URI embed"
  );
}

console.log("quotation-export-publications tests passed");
