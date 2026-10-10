import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignShareBrowserRedirect, campaignShareHtml, campaignShareUrl, freshCampaignShareUrl } from "./share-landing";

test("desktop and mobile browser share navigation skips the intermediate page without changing access", async () => {
  const url = "https://dev.thinkwaymedia.com/review/example/share/copy-1?sign=signed%26value";
  const response = campaignShareBrowserRedirect(new Request(url, { headers: {
    "sec-fetch-dest": "document", "sec-fetch-mode": "navigate",
  } }), "example");
  assert.equal(response?.status, 307);
  assert.equal(response?.headers.get("location"), "https://dev.thinkwaymedia.com/review/example?sign=signed%26value");
  assert.equal(await response?.text(), "");
  assert.equal(campaignShareBrowserRedirect(new Request(url), "example"), null);
  assert.equal(campaignShareBrowserRedirect(new Request(url, { headers: { "sec-fetch-dest": "image" } }), "example"), null);
});

test("copy recovers from an old failed preview without changing review access", () => {
  const original = "https://app.thinkwaymedia.com/review/example/share/3?sign=signed%26value";
  const first = new URL(freshCampaignShareUrl(original, "first"));
  const second = new URL(freshCampaignShareUrl(original, "second"));
  assert.equal(first.pathname, "/review/example/share/copy-first");
  assert.notEqual(first.pathname, second.pathname);
  assert.equal(first.origin, new URL(original).origin);
  assert.equal(first.searchParams.get("sign"), "signed&value");
  assert.equal(second.searchParams.get("sign"), "signed&value");
  const html = campaignShareHtml({ campaignName: "Test campaign", reviewId: "example", token: "signed&value", origin: first.origin, version: "copy-first" });
  assert.ok(html.includes('/share/copy-first?sign='));
  assert.ok(html.includes('v=copy-first'));
  assert.match(html, /window.location.replace\("https:\/\/app.thinkwaymedia.com\/review\/example\?sign=signed%26value"\)/);
  assert.equal(freshCampaignShareUrl("https://app.thinkwaymedia.com/login", "first"), "https://app.thinkwaymedia.com/login");
});

test("copied share links preserve access tokens and use a fresh preview URL", () => {
  const original = "https://app.thinkwaymedia.com/review/example?sign=signed%26value";
  const shared = new URL(campaignShareUrl(original));
  assert.equal(shared.pathname, "/review/example/share/3");
  assert.equal(shared.searchParams.get("sign"), "signed&value");
  assert.equal(shared.searchParams.get("preview"), null);
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

