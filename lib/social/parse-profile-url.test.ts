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

const facebookPage = parseProfileInput("https://www.facebook.com/zuck");
assert.ok(facebookPage);
assert.equal(facebookPage.platform, "facebook");
assert.equal(facebookPage.normalized_username, "zuck");
assert.equal(facebookPage.profile_url, "https://www.facebook.com/zuck");

const facebookId = parseProfileInput("https://www.facebook.com/profile.php?id=123456789");
assert.ok(facebookId);
assert.equal(facebookId.platform, "facebook");
assert.equal(facebookId.normalized_username, "id:123456789");
assert.equal(
  facebookId.profile_url,
  "https://www.facebook.com/profile.php?id=123456789"
);
assert.equal(
  facebookId.normalized_profile_url,
  "https://www.facebook.com/profile.php?id=123456789"
);

const facebookIdDistinct = parseProfileInput(
  "https://www.facebook.com/profile.php?id=100090186279"
);
assert.ok(facebookIdDistinct);
assert.notEqual(
  facebookId.normalized_profile_url,
  facebookIdDistinct.normalized_profile_url,
  "different Facebook numeric ids must not collapse to the same normalized URL"
);

const facebookPeople = parseProfileInput("https://www.facebook.com/people/Jane-Doe/987654321");
assert.ok(facebookPeople);
assert.equal(facebookPeople.normalized_username, "id:987654321");

assert.equal(parseProfileInput("https://www.facebook.com/watch/?v=123"), null);

// Bare words are not Instagram profiles — discovery search must keep them thematic.
assert.equal(parseProfileInput("travel"), null);
assert.equal(parseProfileInput("reem"), null);
assert.equal(parseProfileInput("#foodie"), null);

const atHandle = parseProfileInput("@reemalmasryyy");
assert.ok(atHandle);
assert.equal(atHandle.platform, "instagram");
assert.equal(atHandle.normalized_username, "reemalmasryyy");

const hinted = parseProfileInput("reemalmasryyy", "tiktok");
assert.ok(hinted);
assert.equal(hinted.platform, "tiktok");
assert.equal(hinted.normalized_username, "reemalmasryyy");

console.log("lib/social/parse-profile-url.test.ts — all tests passed");
