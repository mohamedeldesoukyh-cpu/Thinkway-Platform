import assert from "node:assert/strict";

import {
  extractHashtagsFromCaption,
  extractMentionsFromCaption,
  formatHashtagsForStorage,
  formatMentionsForStorage,
  normalizePublicationContent,
  normalizedContentToStorageFields,
} from "@/lib/performance/content-normalizer";
import { extractPublicationContentFromApifyRow } from "@/lib/performance/metrics-collector/extract-publication-content";

assert.deepEqual(extractHashtagsFromCaption("Hello #Fashion and #موضة"), ["Fashion", "موضة"]);
assert.deepEqual(extractMentionsFromCaption("Thanks @Creator and @brand.official"), [
  "Creator",
  "brand.official",
]);

const normalized = normalizePublicationContent({
  caption: "Summer drop #thinkway @partner",
  hashtags: ["Thinkway", "#thinkway"],
  mentions: [],
});
assert.equal(normalized.hashtag_count, 1);
assert.equal(normalized.mention_count, 1);
assert.deepEqual(normalized.hashtags, ["thinkway"]);
assert.deepEqual(normalized.mentions, ["partner"]);

const fallback = normalizePublicationContent({
  caption: "Check #beauty and @influencer today",
});
assert.equal(fallback.hashtag_count, 1);
assert.equal(fallback.mention_count, 1);

const storage = normalizedContentToStorageFields(normalized);
assert.equal(storage.hashtags, "#thinkway");
assert.equal(storage.mentions, "@partner");

const ig = extractPublicationContentFromApifyRow("instagram", {
  caption: "Launch day #brand",
  hashtags: [{ name: "campaign" }],
  mentions: [{ username: "creator" }],
  ownerUsername: "brand",
});
assert.ok(ig);
assert.equal(ig!.caption, "Launch day #brand");
assert.ok(ig!.hashtags.includes("campaign"));
assert.ok(ig!.mentions.includes("creator"));
assert.ok(ig!.mentions.includes("brand"));

const tiktok = extractPublicationContentFromApifyRow("tiktok", {
  text: "POV #fyp",
  mentions: [{ uniqueId: "apifyoffice" }],
  hashtags: [{ name: "viral" }],
});
assert.ok(tiktok);
assert.equal(tiktok!.caption, "POV #fyp");
assert.ok(tiktok!.hashtags.includes("viral"));
assert.ok(tiktok!.mentions.includes("apifyoffice"));

const tiktokParsed = extractPublicationContentFromApifyRow("tiktok", {
  text: "POV #fyp only in caption",
});
assert.ok(tiktokParsed);
assert.ok(tiktokParsed!.hashtags.includes("fyp"));

const tiktokDesc = extractPublicationContentFromApifyRow("tiktok", {
  desc: "Legacy desc field #legacy @creator",
  detailedMentions: [{ userUniqueId: "creator" }],
});
assert.ok(tiktokDesc);
assert.equal(tiktokDesc!.caption, "Legacy desc field #legacy @creator");
assert.ok(tiktokDesc!.hashtags.includes("legacy"));
assert.ok(tiktokDesc!.mentions.includes("creator"));

const tiktokTextExtra = extractPublicationContentFromApifyRow("tt", {
  text: "Shoutout",
  textExtra: [
    { type: "hashtag", hashtagName: "fyp" },
    { type: "user", userUniqueId: "brand" },
  ],
});
assert.ok(tiktokTextExtra);
assert.ok(tiktokTextExtra!.hashtags.includes("fyp"));
assert.ok(tiktokTextExtra!.mentions.includes("brand"));

const parsedOnly = extractPublicationContentFromApifyRow("instagram", {
  captionText: "No arrays #onlyparse @someone",
});
assert.ok(parsedOnly);
assert.equal(parsedOnly!.hashtag_count, 1);
assert.equal(parsedOnly!.mention_count, 1);

assert.equal(
  formatHashtagsForStorage(["#Dup", "dup", "Other"]),
  "#dup #other"
);
assert.equal(formatMentionsForStorage(["@User", "user"]), "@user");

assert.equal(extractPublicationContentFromApifyRow("instagram", { likes: 10 }), null);

console.log("content-normalizer.test.ts: ok");
