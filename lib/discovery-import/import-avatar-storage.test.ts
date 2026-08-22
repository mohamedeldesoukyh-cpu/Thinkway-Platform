import assert from "node:assert/strict";

import {
  buildImportAvatarStoragePath,
  extensionForContentType,
  isLowQualityImportedAvatarUrl,
  parseCreatorAvatarStoragePathFromUrl,
  resolveCreatorAvatarPublicUrl,
} from "./import-avatar-storage";

assert.equal(
  buildImportAvatarStoragePath("file-1", "instagram", "tasnim_zeitoun", "png"),
  "imports/file-1/instagram/tasnim_zeitoun.png"
);

assert.equal(extensionForContentType("image/jpeg"), "jpg");
assert.equal(extensionForContentType("image/png"), "png");

assert.equal(
  resolveCreatorAvatarPublicUrl(
    "https://example.supabase.co",
    "imports/file-1/instagram/tasnim_zeitoun.png"
  ),
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/file-1/instagram/tasnim_zeitoun.png"
);

assert.equal(
  parseCreatorAvatarStoragePathFromUrl(
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/file-1/instagram/tasnim_zeitoun.png"
  ),
  "imports/file-1/instagram/tasnim_zeitoun.png"
);

assert.equal(
  isLowQualityImportedAvatarUrl(
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/d843/instagram/eyadelmogy.jpg",
    4011
  ),
  true
);
assert.equal(
  isLowQualityImportedAvatarUrl(
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/id/instagram/eyadelmogy.jpg",
    4011
  ),
  false
);
assert.equal(
  isLowQualityImportedAvatarUrl(
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/d843/instagram/eyadelmogy.jpg",
    80_000
  ),
  false
);

console.log("lib/discovery-import/import-avatar-storage.test.ts — all tests passed");
