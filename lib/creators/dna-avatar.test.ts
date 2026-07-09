import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveCreatorAvatarWithDnaFallback,
  shouldRestoreAvatarFromDna,
} from "./dna-avatar";

test("shouldRestoreAvatarFromDna prefers durable DNA storage over TikTok CDN", () => {
  assert.equal(
    shouldRestoreAvatarFromDna(
      "https://p16-sign-va.tiktokcdn.com/avatar.jpg?x-expires=1",
      "https://example.supabase.co/storage/v1/object/public/creator-avatars/abc.jpg"
    ),
    true
  );
});

test("resolveCreatorAvatarWithDnaFallback prefers enriched DNA over missing primary", () => {
  assert.equal(
    resolveCreatorAvatarWithDnaFallback({
      primaryAvatarUrl: null,
      dnaAvatarUrl: "https://example.supabase.co/storage/v1/object/public/creator-avatars/tt.jpg",
      preferEnrichedDna: true,
    }),
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/tt.jpg"
  );
});

test("resolveCreatorAvatarWithDnaFallback prefers enriched DNA over flaky TikTok CDN", () => {
  assert.equal(
    resolveCreatorAvatarWithDnaFallback({
      primaryAvatarUrl: "https://p16-sign-va.tiktokcdn.com/stale.jpg",
      dnaAvatarUrl:
        "https://example.supabase.co/storage/v1/object/public/creator-avatars/tt-fresh.jpg",
      preferEnrichedDna: true,
    }),
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/tt-fresh.jpg"
  );
});

test("resolveCreatorAvatarWithDnaFallback keeps usable IG primary over expired DNA CDN", () => {
  const fresh =
    "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg?oe=6A539B1C";
  const expired =
    "https://scontent.cdninstagram.com/v/t51.2885-19/stale.jpg?oe=68500000";
  assert.equal(
    resolveCreatorAvatarWithDnaFallback({
      primaryAvatarUrl: fresh,
      dnaAvatarUrl: expired,
      preferEnrichedDna: true,
    }),
    fresh
  );
});

test("resolveCreatorAvatarWithDnaFallback prefers durable DNA storage over flaky IG CDN", () => {
  assert.equal(
    resolveCreatorAvatarWithDnaFallback({
      primaryAvatarUrl:
        "https://scontent.cdninstagram.com/v/t51.2885-19/live.jpg?oe=6A539B1C",
      dnaAvatarUrl:
        "https://example.supabase.co/storage/v1/object/public/creator-avatars/stable.jpg",
      preferEnrichedDna: true,
    }),
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/stable.jpg"
  );
});
