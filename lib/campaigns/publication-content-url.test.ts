import assert from "node:assert/strict";

import {
  PUBLICATION_DUPLICATE_NOTE_MARKER,
  appendDuplicateNoteMarker,
  duplicateNormalizedUrlSet,
  findDuplicatePublicationUrls,
  normalizePublicationContentUrl,
  notesHaveDuplicateMarker,
  notesHaveCollabMarker,
  setPublicationCollab,
  publicationCollabLabel,
  isDuplicatePublicationUrl,
} from "@/lib/campaigns/publication-content-url";

assert.equal(
  normalizePublicationContentUrl("https://www.instagram.com/reel/AbC/?igsh=xyz"),
  normalizePublicationContentUrl("https://instagram.com/reel/AbC/")
);

assert.equal(
  normalizePublicationContentUrl("https://www.facebook.com/reel/123/"),
  "https://facebook.com/reel/123"
);

const dupSet = duplicateNormalizedUrlSet([
  "https://instagram.com/p/one/",
  "https://www.instagram.com/p/one",
  "https://instagram.com/p/two",
]);
assert.equal(dupSet.size, 1);
assert.ok(dupSet.has("https://instagram.com/p/one"));

const hits = findDuplicatePublicationUrls({
  candidateUrls: [
    "https://instagram.com/p/one/",
    "https://instagram.com/p/new",
    "https://instagram.com/p/new/?utm_source=x",
  ],
  existingUrls: ["https://www.instagram.com/p/one"],
});
assert.equal(hits.length, 2);
assert.ok(hits.some((h) => h.reason === "existing"));
assert.ok(hits.some((h) => h.reason === "batch"));

assert.equal(notesHaveDuplicateMarker(null), false);
assert.equal(notesHaveDuplicateMarker(PUBLICATION_DUPLICATE_NOTE_MARKER), true);
assert.equal(
  appendDuplicateNoteMarker("keep me"),
  `keep me\n${PUBLICATION_DUPLICATE_NOTE_MARKER}`
);

const original = 'Keep creator notes\nDuplicate';
const collab = setPublicationCollab(original, true);
assert.equal(notesHaveCollabMarker(collab), true);
assert.equal(notesHaveDuplicateMarker(collab), false);
assert.equal(isDuplicatePublicationUrl('https://instagram.com/p/one', dupSet, {notes:collab}), false);
assert.equal(setPublicationCollab(collab, true), collab);
assert.equal(setPublicationCollab(collab, false), original);
assert.equal(notesHaveDuplicateMarker(setPublicationCollab(collab, false)), true);
assert.equal(notesHaveCollabMarker('Discuss collab with creator'), false);
assert.equal(publicationCollabLabel('Creator A', collab), 'Creator A · Collab');
assert.equal(publicationCollabLabel('Creator A', original), 'Creator A');
console.log("publication-content-url — all tests passed");
