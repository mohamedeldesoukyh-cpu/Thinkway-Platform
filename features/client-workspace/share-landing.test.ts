import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignShareHtml, campaignShareUrl } from "./share-landing";

test("copied share links preserve access tokens and use a fresh preview URL", () => {
  const original = "https://app.thinkwaymedia.com/review/example?sign=signed%26value";
  const shared = new URL(campaignShareUrl(original));
  assert.equal(shared.pathname, "/review/example/share");
  assert.equal(shared.searchParams.get("sign"), "signed&value");
  assert.equal(shared.searchParams.get("preview"), "3");
  assert.notEqual(campaignShareUrl(original, "4"), shared.href);
  assert.equal(campaignShareUrl("https://app.thinkwaymedia.com/login"), "https://app.thinkwaymedia.com/login");
});

test("crawler metadata comes first without rendering or redirecting the full workspace", () => {
  const html = campaignShareHtml({ campaignName: "Limitless UAE September 2026", reviewId: "example", token: "signed-token", origin: "https://app.thinkwaymedia.com", version: "2" });
  assert.ok(html.indexOf('property="og:image"') < 1024);
  assert.ok(html.indexOf('property="og:title"') < html.indexOf("</head>"));
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /window.location.replace\("https:\/\/app.thinkwaymedia.com\/review\/example\?sign=signed-token"\)/);
  assert.doesNotMatch(html, /http-equiv="refresh"/);
  assert.match(html, /noindex,nofollow/);
});

test("campaign text and tokens cannot inject markup into the share response", () => {
  const html = campaignShareHtml({ campaignName: '</title><script>alert("bad")</script>', reviewId: "example", token: '</script><script>alert("bad")</script>', origin: "https://app.thinkwaymedia.com", version: '"/><script>bad</script>' });
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.ok(html.includes("&lt;/title&gt;"));
  assert.doesNotMatch(html, /<script>alert/);
});
