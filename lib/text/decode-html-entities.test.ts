import assert from "node:assert/strict";

import {
  decodeHtmlEntities,
  extractEmbeddedCreatorHandle,
  formatCreatorBio,
  formatCreatorDisplayName,
  isCreatorDocumentNumber,
  isUsernameLikeCreatorName,
  pickCreatorDisplayName,
  resolveCreatorIdentity,
} from "./decode-html-entities";

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
  "Ali Mahgoub | علي محجوب"
);
assert.equal(
  formatCreatorDisplayName(
    "Ali Mahgoub | علي محجوب (@ali.mahgub) - Ali Mahgoub | علي محجوب (@ali.mahgub) - Option 1"
  ),
  "Ali Mahgoub | علي محجوب"
);
assert.equal(formatCreatorDisplayName("Jane Creator - YouTube"), "Jane Creator");
assert.equal(formatCreatorDisplayName("Jane Creator | TikTok"), "Jane Creator");
assert.equal(formatCreatorDisplayName("Jane Creator / X"), "Jane Creator");
assert.equal(formatCreatorDisplayName("The Instagram Guy"), "The Instagram Guy");
assert.equal(formatCreatorDisplayName("Photos and Videos Studio"), "Photos and Videos Studio");
assert.equal(formatCreatorDisplayName("Instagram"), "");
assert.equal(formatCreatorDisplayName("instagram"), "");
assert.equal(formatCreatorDisplayName("TikTok"), "");
assert.equal(formatCreatorDisplayName("Instagram photos and videos"), "");
assert.equal(formatCreatorBio("Beauty &amp; lifestyle"), "Beauty & lifestyle");
assert.equal(formatCreatorBio(null), null);
assert.equal(isUsernameLikeCreatorName("salehelnawawy", "@salehelnawawy"), true);
assert.equal(isUsernameLikeCreatorName("Saleh El Nawawy", "@salehelnawawy"), false);
assert.equal(isCreatorDocumentNumber("INF-008286"), true);
assert.equal(formatCreatorDisplayName("INF-008286"), "");
assert.equal(formatCreatorDisplayName("@byasmaahesham"), "byasmaahesham");
assert.equal(
  pickCreatorDisplayName(["salehelnawawy", "Saleh El Nawawy"], "@salehelnawawy"),
  "Saleh El Nawawy"
);
assert.equal(
  pickCreatorDisplayName(["salehelnawawy", null], "salehelnawawy"),
  "salehelnawawy"
);
assert.equal(
  pickCreatorDisplayName(["INF-008286", null], "@byasmaahesham"),
  "byasmaahesham"
);
assert.equal(
  pickCreatorDisplayName(["INF-008286", "@byasmaahesham"], "@byasmaahesham"),
  "byasmaahesham"
);
assert.equal(
  extractEmbeddedCreatorHandle(
    "Ali Mahgoub | علي محجوب (@ali.mahgub) • Instagram photos and videos"
  ),
  "ali.mahgub"
);
assert.deepEqual(
  resolveCreatorIdentity(
    "Ali Mahgoub | علي محجوب (@ali.mahgub) • Instagram photos and videos",
    null
  ),
  { name: "Ali Mahgoub | علي محجوب", handle: "ali.mahgub" }
);
assert.deepEqual(resolveCreatorIdentity("Creator", "nourellah.a"), {
  name: "nourellah.a",
  handle: "nourellah.a",
});
assert.deepEqual(resolveCreatorIdentity("INF-008286", "mark.sedhom"), {
  name: "mark.sedhom",
  handle: "mark.sedhom",
});
assert.equal(formatCreatorDisplayName("Creator"), "");

console.log("decode-html-entities tests passed");
