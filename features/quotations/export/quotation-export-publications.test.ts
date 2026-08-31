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
  const pubs = [
    {
      url: "https://www.tiktok.com/@ouda.5/video/1",
      thumbnail: "https://p16-sign.tiktokcdn.com/tos/s150x150/tiny.jpeg",
      originalCoverUrl:
        "https://p16-common-sign.tiktokcdn-eu.com/tos-maliva-p-0068/cover~tplv-tiktokx-origin.image",
      likes: 10,
      comments: 1,
      views: 1000,
      posted_at: null,
      caption: "Origin cover",
    },
  ] as CreatorRecentPublication[];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(
    shots[0]?.imageUrl,
    "https://p16-common-sign.tiktokcdn-eu.com/tos-maliva-p-0068/cover~tplv-tiktokx-origin.image",
    "quotation chooses the canonical high-resolution publication cover over a tiny thumb"
  );
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
  assert.match(
    source,
    /isVisiblyOvercompressedPhoto/,
    "Showcase embed must reject Instagram e15-class JPEG bytes"
  );
  assert.match(
    source,
    /MIN_SHARP_PUBLICATION_EDGE/,
    "Showcase embed must reject publication bytes smaller than the tile"
  );
  assert.match(
    source,
    /fetchPublicationPreviewImage/,
    "Showcase reuses the existing publication preview resolver — no second image SSOT"
  );

  const here = dirname(fileURLToPath(import.meta.url));
  const previewSource = readFileSync(join(here, "render-quotation-preview-html.ts"), "utf8");
  const exportRouteSource = readFileSync(
    join(here, "../../../app/api/quotations/[id]/export/route.ts"),
    "utf8"
  );
  const htmlSource = readFileSync(
    join(here, "../templates/quotation-template-html.ts"),
    "utf8"
  );
  assert.match(
    previewSource,
    /embedQuotationDocumentPublicationShots/,
    "browser preview embeds publications through the same function as PDF"
  );
  assert.match(
    exportRouteSource,
    /embedQuotationDocumentPublicationShots/,
    "PDF export embeds publications through the same function as preview"
  );
  assert.doesNotMatch(
    htmlSource,
    /next\/image/,
    "quotation HTML uses plain <img>, not Next image optimization"
  );
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/p/A/",
      thumbnail: "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/avatar.jpg",
      likes: 10,
      comments: 1,
      views: null,
      posted_at: null,
      caption: "Post A",
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6, {
    creatorAvatarUrl: "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/avatar.jpg",
  });
  assert.equal(shots.length, 1);
  assert.equal(shots[0]?.imageUrl, "", "profile pics are not used as publication images");
  assert.equal(shots[0]?.postUrl, "https://www.instagram.com/p/A/");
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/p/A/",
      thumbnail:
        "https://abc.supabase.co/storage/v1/object/public/campaign-publication-media/screenshot.jpg",
      likes: 10,
      comments: 1,
      views: null,
      posted_at: null,
      caption: "Post A",
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(
    shots[0]?.imageUrl,
    "https://abc.supabase.co/storage/v1/object/public/campaign-publication-media/screenshot.jpg",
    "stored screenshots are used when they are the publication image"
  );
  assert.equal(shots[0]?.postUrl, "https://www.instagram.com/p/A/");
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: null,
      thumbnail: null,
      likes: null,
      comments: null,
      views: null,
      posted_at: null,
      caption: "No media",
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(shots.length, 0, "publications without image or permalink are omitted");
}

console.log("quotation-export-publications tests passed");
