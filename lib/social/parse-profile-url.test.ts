import assert from "node:assert/strict";

import { parseProfileInput } from "@/lib/social/parse-profile-url";

const tiktok = parseProfileInput("https://www.tiktok.com/@with.fatimma");
assert.ok(tiktok);
assert.equal(tiktok.platform, "tiktok");
assert.equal(tiktok.normalized_username, "with.fatimma");
assert.equal(tiktok.profile_url, "https://www.tiktok.com/@with.fatimma");

const instagram = parseProfileInput("https://www.instagram.com/jane.doe/");
assert.ok(instagram);
assert.equal(instagram.platform, "instagram");
assert.equal(instagram.normalized_username, "jane.doe");

console.log("lib/social/parse-profile-url.test.ts — all tests passed");
