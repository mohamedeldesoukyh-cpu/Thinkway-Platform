import assert from "node:assert/strict";
import test from "node:test";

import { buildNormalizedPlatformAccount } from "./normalize-account";
import {
  normalizeSocialPlatform,
  platformsEqual,
  requireSocialPlatform,
} from "./normalize-platform";
import { resolvePlatformAccountFields } from "./parse-profile-url";

test("normalizeSocialPlatform accepts Snapchat casing and aliases", () => {
  assert.equal(normalizeSocialPlatform("Snapchat"), "snapchat");
  assert.equal(normalizeSocialPlatform("SNAPCHAT"), "snapchat");
  assert.equal(normalizeSocialPlatform("sc"), "snapchat");
  assert.equal(normalizeSocialPlatform("snap"), "snapchat");
});

test("platformsEqual is case-insensitive", () => {
  assert.equal(platformsEqual("Snapchat", "snapchat"), true);
  assert.equal(platformsEqual("IG", "instagram"), true);
  assert.equal(platformsEqual("tiktok", "youtube"), false);
});

test("resolvePlatformAccountFields accepts mixed-case platform + username", () => {
  const parsed = resolvePlatformAccountFields({
    username: "suhaibshashaa",
    platform: "Snapchat",
  });
  assert.ok(parsed);
  assert.equal(parsed?.platform, "snapchat");
  assert.equal(parsed?.username, "suhaibshashaa");
});

test("buildNormalizedPlatformAccount never persists mixed-case platform", () => {
  const account = buildNormalizedPlatformAccount({
    platform: "Snapchat",
    username: "@Creator",
  });
  assert.equal(account.platform, "snapchat");
  assert.equal(account.normalized_username, "creator");
});

test("requireSocialPlatform throws for unknown values", () => {
  assert.throws(() => requireSocialPlatform("myspace"), /Unsupported platform/);
});
