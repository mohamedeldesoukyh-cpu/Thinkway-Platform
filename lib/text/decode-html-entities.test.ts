import assert from "node:assert/strict";

import { decodeHtmlEntities, formatCreatorBio, formatCreatorDisplayName } from "./decode-html-entities";

assert.equal(decodeHtmlEntities("&amp; &quot; &lt;"), '& " <');
assert.equal(decodeHtmlEntities("&#39;"), "'");
assert.equal(decodeHtmlEntities("&#x639;"), "ع");
assert.equal(decodeHtmlEntities("&#1593;"), "ع");
assert.equal(
  decodeHtmlEntities("&#x200e;Ali Mahgoub | &#x639;&#x644;&#x649; &#x645;&#x62d;&#x62c;&#x648;&#x628;"),
  "Ali Mahgoub | على محجوب"
);
assert.equal(formatCreatorDisplayName("  &#x639;&#x644;&#x649;  "), "على");
assert.equal(formatCreatorDisplayName(null), "");
assert.equal(formatCreatorDisplayName(""), "");
assert.equal(
  formatCreatorDisplayName(
    "Ali Mahgoub | علي محجوب (@ali.mahgub) • Instagram photos and videos"
  ),
  "Ali Mahgoub | علي محجوب (@ali.mahgub)"
);
assert.equal(formatCreatorDisplayName("Jane Creator - YouTube"), "Jane Creator");
assert.equal(formatCreatorDisplayName("Jane Creator | TikTok"), "Jane Creator");
assert.equal(formatCreatorDisplayName("Jane Creator / X"), "Jane Creator");
assert.equal(formatCreatorDisplayName("The Instagram Guy"), "The Instagram Guy");
assert.equal(formatCreatorDisplayName("Photos and Videos Studio"), "Photos and Videos Studio");
assert.equal(formatCreatorBio("Beauty &amp; lifestyle"), "Beauty & lifestyle");
assert.equal(formatCreatorBio(null), null);

console.log("decode-html-entities tests passed");
