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
  publicationCollabCreator, attributeCollabPublications, uniqueCollabPublications, collabCellStyle,
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

const linked = setPublicationCollab('Keep notes', true, {id:'b',name:'Creator B'});
assert.deepEqual(publicationCollabCreator(linked), {id:'b',name:'Creator B'});
assert.equal(publicationCollabLabel('Creator A',linked),'Creator A · Collab with Creator B');
assert.equal(setPublicationCollab(linked,false),'Keep notes');
const sharedRows = [
 {id:'a-post',campaign_line_id:'a',content_url:'https://instagram.com/p/shared',notes:linked,influencer_name:'Creator A',views:null},
 {id:'b-post',campaign_line_id:'b',content_url:'https://instagram.com/p/shared/',notes:null,influencer_name:'Creator B',views:100},
 {id:'c-post',campaign_line_id:'c',content_url:'https://instagram.com/p/other',notes:null,influencer_name:'Creator C',views:50},
];
const attributed = attributeCollabPublications(sharedRows);
assert.equal(publicationCollabCreator(attributed[1].notes)?.name,'Creator A');
assert.deepEqual(collabCellStyle(sharedRows[0],sharedRows),collabCellStyle(sharedRows[1],sharedRows));
assert.equal(collabCellStyle(sharedRows[2],sharedRows),undefined);
const unique = uniqueCollabPublications(sharedRows);
assert.equal(unique.length,2);
assert.equal(unique.reduce((sum,row)=>sum+(row.views??0),0),150);
assert.equal(sharedRows[1].notes,null);
assert.equal(uniqueCollabPublications(sharedRows.map(row=>({...row,notes:null}))).length,3);
