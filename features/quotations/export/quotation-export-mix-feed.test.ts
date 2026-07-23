import assert from "node:assert/strict";

import {
  buildCollapsePackageMixFeed,
  interleavePublicationShots,
} from "@/features/quotations/export/quotation-export-mix-feed";
import type {
  QuotationDocCollapsePackageCreator,
  QuotationDocPublicationShot,
  QuotationDocument,
} from "@/features/quotations/export/quotation-document";

function shot(id: string): QuotationDocPublicationShot {
  return {
    imageUrl: `https://example.com/${id}.jpg`,
    postUrl: null,
    caption: null,
  };
}

{
  const merged = interleavePublicationShots([
    [shot("a1"), shot("a2")],
    [shot("b1"), shot("b2")],
  ]);
  assert.deepEqual(
    merged.map((entry) => entry.imageUrl),
    [
      "https://example.com/a1.jpg",
      "https://example.com/b1.jpg",
      "https://example.com/a2.jpg",
      "https://example.com/b2.jpg",
    ]
  );
}

{
  const creatorA: QuotationDocCollapsePackageCreator = {
    creator: "Creator A",
    handle: "@creator_a",
    platform: "Instagram",
    platformIcons: ["instagram"],
    avatarUrl: null,
    avatarProxyUrl: null,
    profileUrl: null,
    followers: "1M",
    engagementRate: "3%",
    tier: "Mega",
  };
  const doc = {
    template: "showcase",
    creatorGroups: [
      {
        creatorKey: "a",
        creator: "Creator A",
        handle: "@creator_a",
        profileUrl: null,
        avatarUrl: null,
        avatarProxyUrl: null,
        platform: "Instagram",
        linkedPlatforms: [],
        followers: "1M",
        engagementRate: "3%",
        country: "EG",
        categories: [],
        isVerified: false,
        optionCount: 1,
        publicationShots: [shot("a1"), shot("a2")],
        rows: [],
      },
      {
        creatorKey: "b",
        creator: "Creator B",
        handle: "@creator_b",
        profileUrl: null,
        avatarUrl: null,
        avatarProxyUrl: null,
        platform: "Instagram",
        linkedPlatforms: [],
        followers: "500K",
        engagementRate: "2%",
        country: "EG",
        categories: [],
        isVerified: false,
        optionCount: 1,
        publicationShots: [shot("b1")],
        rows: [],
      },
    ],
  } as QuotationDocument;

  const mixFeed = buildCollapsePackageMixFeed(doc, [creatorA, { ...creatorA, creator: "Creator B", handle: "@creator_b" }]);
  assert.equal(mixFeed.length, 3);
  assert.equal(mixFeed[0]?.imageUrl, "https://example.com/a1.jpg");
  assert.equal(mixFeed[1]?.imageUrl, "https://example.com/b1.jpg");
}

console.log("quotation-export-mix-feed.test.ts passed");
