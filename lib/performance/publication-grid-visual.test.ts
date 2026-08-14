import assert from "node:assert/strict";

import {
  resolveCreatorAvatarDisplay,
  resolvePublicationContentPreviewUrl,
} from "@/lib/performance/creator-avatar";
import { resolvePublicationPreviewUrl } from "@/lib/performance/publication-preview";
import {
  previewAvoidsCreatorAvatar,
  resolveCreatorColumnDisplay,
  resolvePlatformThumbDisplay,
  resolvePreviewColumnUrl,
} from "@/lib/performance/publication-grid-visual-resolvers";

const CREATOR_PHOTO = "https://cdn.example.com/creator.jpg";
const POST_THUMB = "https://cdn.example.com/post-thumb.jpg";
const POST_SCREEN = "https://cdn.example.com/post-screen.jpg";

const baseRow = {
  platform: "instagram",
  publication_type: "instagram_reel",
  content_url: "https://www.instagram.com/reel/abc/",
  creator_profile_image_url: CREATOR_PHOTO,
  influencer_avatar_url: CREATOR_PHOTO,
  social_profile_picture_url: CREATOR_PHOTO,
  influencer_name: "Jane Doe",
  screenshot_url: POST_SCREEN,
  thumbnail_url: POST_THUMB,
};

// --- THUMB: platform only, never creator avatars ---
{
  const thumb = resolvePlatformThumbDisplay(baseRow);
  assert.equal(thumb.kind, "platform-icon");
  assert.equal(thumb.platform, "instagram");
  assert.notEqual(thumb.kind, "image" as never);
}

// THUMB resolver has no creator URL field — cannot resolve to creator photo.
assert.equal(resolvePlatformThumbDisplay(baseRow).kind, "platform-icon");

// --- PREVIEW: content only, never creator avatars ---
assert.equal(resolvePreviewColumnUrl(baseRow), POST_SCREEN);
assert.equal(
  resolvePreviewColumnUrl({ screenshot_url: null, thumbnail_url: POST_THUMB }),
  POST_THUMB
);
assert.equal(
  resolvePreviewColumnUrl({ screenshot_url: null, thumbnail_url: null }),
  null
);

assert.equal(
  resolvePublicationPreviewUrl({
    screenshot_url: POST_SCREEN,
    thumbnail_url: POST_THUMB,
    creator_profile_image_url: CREATOR_PHOTO,
    influencer_avatar_url: CREATOR_PHOTO,
    social_profile_picture_url: CREATOR_PHOTO,
  }),
  POST_SCREEN,
  "resolvePublicationPreviewUrl must not fall back to creator avatar"
);

assert.ok(
  previewAvoidsCreatorAvatar(baseRow),
  "preview URL must differ from creator avatar when both exist"
);

// When only creator avatar exists, preview stays empty (no avatar bleed).
assert.equal(
  resolvePublicationContentPreviewUrl({
    screenshot_url: null,
    thumbnail_url: null,
  }),
  null
);
assert.equal(
  resolvePublicationContentPreviewUrl({
    screenshot_url: "  ",
    thumbnail_url: "",
  }),
  null
);

// --- CREATOR: full fallback chain, no platform icons ---
{
  const withPhoto = resolveCreatorColumnDisplay({
    platform: "instagram",
    influencer_name: "Jane Doe",
    social_profile_picture_url: CREATOR_PHOTO,
  });
  assert.equal(withPhoto.kind, "image");
  if (withPhoto.kind === "image") {
    assert.equal(withPhoto.url, CREATOR_PHOTO);
  }
}

{
  const noPhoto = resolveCreatorColumnDisplay({
    platform: "tiktok",
    influencer_name: "Jane Doe",
    social_profile_picture_url: null,
    influencer_avatar_url: null,
    apify_author_avatar_url: null,
  });
  assert.equal(noPhoto.kind, "initials");
  assert.notEqual(noPhoto.kind, "platform-icon" as never);
}

{
  const noPhotoNoName = resolveCreatorColumnDisplay({
    platform: "tiktok",
    influencer_name: null,
    social_profile_picture_url: null,
    influencer_avatar_url: null,
  });
  assert.equal(noPhotoNoName.kind, "placeholder");
  assert.notEqual(noPhotoNoName.kind, "platform-icon" as never);
}

// Creator photo present → never initials or platform icon.
{
  const display = resolveCreatorAvatarDisplay({
    platform: "instagram",
    influencer_name: "Jane Doe",
    social_profile_picture_url: CREATOR_PHOTO,
  });
  assert.equal(display.kind, "image");
}

// Initials only when no creator photo.
{
  const display = resolveCreatorAvatarDisplay({
    platform: "instagram",
    influencer_name: "Jane Doe",
    social_profile_picture_url: null,
    influencer_avatar_url: null,
    apify_author_avatar_url: null,
    creator_profile_image_url: null,
  });
  assert.equal(display.kind, "initials");
}

console.log("publication-grid-visual tests passed");
