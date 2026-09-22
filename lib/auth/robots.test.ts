import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "../../app/robots";
import { isPublicPath } from "./routes";

test("crawler discovery is public while app pages remain private", () => {
  assert.equal(isPublicPath("/robots.txt"), true);
  assert.equal(isPublicPath("/robots.txt/private"), false);
  assert.equal(isPublicPath("/campaigns"), false);
  assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/", allow: ["/review/*/share?", "/review/*/share/*?", "/api/review/share-image?"] });
});
