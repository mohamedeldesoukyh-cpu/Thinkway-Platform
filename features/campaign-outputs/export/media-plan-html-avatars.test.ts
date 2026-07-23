import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  resolveMediaPlanAvatarSrc,
  resolveMediaPlanCreatorProfileHref,
} from "@/features/campaign-outputs/export/media-plan-html-avatars";

test("resolveMediaPlanCreatorProfileHref prefers stored profile URL", () => {
  assert.equal(
    resolveMediaPlanCreatorProfileHref({
      profileUrl: "https://www.instagram.com/nour/",
      handle: "nour",
      platform: "instagram",
    }),
    "https://www.instagram.com/nour/"
  );
});

test("resolveMediaPlanCreatorProfileHref builds canonical URL from handle", () => {
  assert.equal(
    resolveMediaPlanCreatorProfileHref({
      handle: "nour",
      platform: "instagram",
    }),
    "https://www.instagram.com/nour/"
  );
});

test("resolveMediaPlanAvatarSrc uses avatar proxy in browser preview mode", () => {
  const src = resolveMediaPlanAvatarSrc(
    {
      avatarUrl:
        "https://scontent.cdninstagram.com/v/t51.2885-19/example.jpg?stp=dst-jpg_s150x150",
      profileUrl: "https://www.instagram.com/nour/",
    },
    { browserAvatarProxy: true }
  );
  assert.ok(src?.startsWith("/api/creators/avatar?"));
  assert.ok(src?.includes("profileUrl="));
});

test("resolveMediaPlanAvatarSrc keeps raw URL for export embedding", () => {
  const src = resolveMediaPlanAvatarSrc({
    avatarUrl: "data:image/png;base64,abc",
    profileUrl: "https://www.instagram.com/nour/",
  });
  assert.equal(src, "data:image/png;base64,abc");
});
