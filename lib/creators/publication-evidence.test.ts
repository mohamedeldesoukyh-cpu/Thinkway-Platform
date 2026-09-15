import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeCreatorRecentPublications,
  normalizeCreatorPublicationEvidence,
} from "./publication-evidence";
import type { CreatorRecentPublication } from "./types";

function publication(postId: string, capturedAt: string): CreatorRecentPublication {
  return {
    platformPostId: postId,
    url: `https://instagram.example.test/p/${postId}`,
    thumbnail: null,
    likes: null,
    comments: null,
    views: null,
    posted_at: null,
    caption: null,
    source: {
      provider: "apify",
      apifyRunId: `run-${capturedAt}`,
      apifyDatasetId: `dataset-${capturedAt}`,
      platformPostId: postId,
      capturedAt,
    },
  };
}

test("normalizes rich Apify publication evidence with stable source identity", () => {
  const evidence = normalizeCreatorPublicationEvidence(
    {
      id: "ig-post-1",
      type: "Video",
      productType: "clips",
      paidPartnership: false,
      taggedUsers: [{ id: "tag-1", username: "tagged", full_name: "Tagged Account" }],
      coauthorProducers: [{ id: "co-1", username: "coauthor", full_name: "Co Author" }],
      locationName: "Cairo",
      locationId: 123,
      musicInfo: { audio_id: "audio-1", artist_name: "Artist", song_name: "Song" },
      audioUrl: "https://audio.example.test/track",
      videoDuration: 14,
      videoPlayCount: 400,
      videoViewCount: 410,
      videoUrl: "https://video.example.test/post",
      displayUrl: "https://image.example.test/post",
      dimensionsWidth: 1080,
      dimensionsHeight: 1920,
      images: ["https://image.example.test/one", "https://image.example.test/two"],
      childPosts: ["https://instagram.example.test/p/child"],
    },
    {
      provider: "apify",
      apifyRunId: "run-1",
      apifyDatasetId: "dataset-1",
      platformPostId: null,
      capturedAt: "2026-09-15T00:00:00.000Z",
    }
  );

  assert.equal(evidence.platformPostId, "ig-post-1");
  assert.equal(evidence.source?.apifyDatasetId, "dataset-1");
  assert.equal(evidence.paidPartnership, false);
  assert.equal(evidence.taggedUsers?.[0]?.username, "tagged");
  assert.equal(evidence.coauthorProducers?.[0]?.username, "coauthor");
  assert.equal(evidence.locationName, "Cairo");
  assert.equal(evidence.locationId, "123");
  assert.equal(evidence.music?.songName, "Song");
  assert.equal(evidence.video?.viewCount, 410);
  assert.equal(evidence.media?.imageUrls.length, 2);
});

test("merges the same stable publication without erasing existing data or duplicating it", () => {
  const existing: CreatorRecentPublication = {
    platformPostId: "ig-post-1",
    url: "https://instagram.example.test/p/one",
    thumbnail: "https://image.example.test/one",
    likes: 10,
    comments: 2,
    views: null,
    posted_at: "2026-09-01T00:00:00.000Z",
    caption: "Existing caption",
    media: {
      displayUrl: "https://image.example.test/one",
      width: 1080,
      height: 1080,
      originalWidth: 1080,
      originalHeight: 1080,
      imageUrls: ["https://image.example.test/one"],
      childPostUrls: [],
    },
  };
  const incoming: CreatorRecentPublication = {
    platformPostId: "ig-post-1",
    url: "https://instagram.example.test/p/one",
    thumbnail: null,
    likes: null,
    comments: null,
    views: 100,
    posted_at: null,
    caption: null,
    video: { durationSeconds: 12, playCount: 100, viewCount: null, url: null },
    media: {
      displayUrl: null,
      width: null,
      height: null,
      originalWidth: null,
      originalHeight: null,
      imageUrls: ["https://image.example.test/two"],
      childPostUrls: [],
    },
  };

  const merged = mergeCreatorRecentPublications([existing, existing], [incoming, incoming]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.caption, "Existing caption");
  assert.equal(merged[0]?.thumbnail, "https://image.example.test/one");
  assert.equal(merged[0]?.views, 100);
  assert.equal(merged[0]?.video?.durationSeconds, 12);
  assert.deepEqual(merged[0]?.media?.imageUrls, [
    "https://image.example.test/one",
    "https://image.example.test/two",
  ]);
  assert.equal(merged[0]?.likes, 10, "existing observed values remain authoritative");
});

test("preserves existing provenance when retained runs contain the same post", () => {
  const older = publication("post-2", "2026-01-01T00:00:00.000Z");
  const newer = publication("post-2", "2026-02-01T00:00:00.000Z");
  const forward = mergeCreatorRecentPublications([older], [newer]);
  const reverse = mergeCreatorRecentPublications([newer], [older]);

  assert.equal(forward[0]?.source?.capturedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(reverse[0]?.source?.capturedAt, "2026-02-01T00:00:00.000Z");
});

test("deduplicates publication people by stable account identity without losing a display name", () => {
  const current = publication("post-people", "2026-01-01T00:00:00.000Z");
  current.taggedUsers = [
    { id: "account-1", username: "creator", displayName: "Creator", isVerified: true },
    { id: "account-1", username: "creator", displayName: null, isVerified: true },
  ];
  const merged = mergeCreatorRecentPublications([current], [current]);

  assert.equal(merged[0]?.taggedUsers?.length, 1);
  assert.equal(merged[0]?.taggedUsers?.[0]?.displayName, "Creator");
});

test("deduplicates signed CDN media variants by stable asset path", () => {
  const existing = publication("post-media", "2026-01-01T00:00:00.000Z");
  existing.media = {
    displayUrl: null,
    width: null,
    height: null,
    originalWidth: null,
    originalHeight: null,
    imageUrls: ["https://old-cdn.example.test/assets/post-media.jpg?signature=first"],
    childPostUrls: [],
  };
  const incoming = publication("post-media", "2026-02-01T00:00:00.000Z");
  incoming.media = {
    displayUrl: null,
    width: null,
    height: null,
    originalWidth: null,
    originalHeight: null,
    imageUrls: ["https://new-cdn.example.test/assets/post-media.jpg?signature=second"],
    childPostUrls: [],
  };

  const merged = mergeCreatorRecentPublications([existing], [incoming]);

  assert.deepEqual(merged[0]?.media?.imageUrls, [
    "https://old-cdn.example.test/assets/post-media.jpg?signature=first",
  ]);
});
