import assert from "node:assert/strict";

import {
  countryFlagImageFallbackUrls,
  countryFlagImageUrl,
  normalizeCountryCode,
} from "./creator-display-utils";

assert.equal(normalizeCountryCode(" eg "), "EG");
assert.equal(normalizeCountryCode("EGY"), null);
assert.equal(normalizeCountryCode(null), null);

assert.equal(countryFlagImageUrl("EG", 20), "https://flagcdn.com/w40/eg.png");
assert.equal(countryFlagImageUrl("EG", 14), "https://flagcdn.com/w40/eg.png");
assert.equal(countryFlagImageUrl("EG", 24), "https://flagcdn.com/w80/eg.png");

const inlineUrl = countryFlagImageUrl("AE", 14);
assert.match(inlineUrl ?? "", /w(20|40|80|160|320|640|1280|2560)\//);
assert.doesNotMatch(inlineUrl ?? "", /w(16|24|28|32|48|56)\//);

const urls = countryFlagImageFallbackUrls("EG", 20);
assert.equal(urls[0], "https://flagcdn.com/w40/eg.png");
assert.ok(urls.includes("https://flagcdn.com/40x30/eg.png"));
assert.equal(new Set(urls).size, urls.length);

console.log("creator-display-utils flag URL tests passed");
