import { groupCollabPublications, withPublicationCollabColors } from './publication-content-url';
import assert from "node:assert/strict";

import {
  PUBLICATION_DUPLICATE_NOTE_MARKER,
  publicationCollabEditor,
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

const instagramShared = sharedRows.slice(0, 2).map((row, i) => ({...row, content_url: i ? 'https://www.instagram.com/reel/DgKum7sx6DR/?igsh=test' : 'https://www.instagram.com/p/DgKum7sx6DR/'}));
assert.equal(normalizePublicationContentUrl(instagramShared[0].content_url), normalizePublicationContentUrl(instagramShared[1].content_url));
assert.equal(uniqueCollabPublications(instagramShared).length, 1);
assert.equal(publicationCollabCreator(attributeCollabPublications(instagramShared)[1].notes)?.id, 'a');
assert.notEqual(normalizePublicationContentUrl('https://instagram.com/p/AbC'), normalizePublicationContentUrl('https://instagram.com/p/abc'));

const choices = [{id:'a',name:'Adham'}, {id:'b',name:'Wagdi'}];
const adhamEditor = publicationCollabEditor(instagramShared[0], instagramShared, choices);
assert.equal(adhamEditor.publication.campaign_line_id, 'a');
assert.deepEqual(adhamEditor.options, [{value:'b',label:'Wagdi'}]);
const wagdiEditor = publicationCollabEditor(instagramShared[1], instagramShared, choices);
assert.equal(wagdiEditor.publication.campaign_line_id, 'b');
assert.deepEqual(wagdiEditor.options, [{value:'a',label:'Adham'}]);

// Full-campaign palette remains identical after filtering and report splitting.
const ttShared = instagramShared.map(row => ({...row, content_url:'https://www.tiktok.com/@creator/video/123'}));
const ytShared = instagramShared.map(row => ({...row, content_url:'https://www.youtube.com/shorts/QkAbwNDH_OM'}));
const nextIgShared = instagramShared.map(row => ({...row, content_url:'https://instagram.com/reel/AnotherPost'}));
const paletteRows = [...instagramShared,...ttShared,...ytShared,...nextIgShared].map((row,i)=>({...row,id:String(i)}));
const coloured = withPublicationCollabColors(paletteRows);
const colours = coloured.map(row => collabCellStyle(row,coloured));
assert.equal(new Set(colours.map(style=>style?.borderLeft)).size,4);
for(let i=0;i<coloured.length;i+=2){
  assert.deepEqual(colours[i],colours[i+1]);
  assert.deepEqual(colours[i],collabCellStyle(coloured[i],[coloured[i]]));
}
assert.deepEqual(withPublicationCollabColors([...paletteRows].reverse()).reverse(),coloured);
assert.equal(collabCellStyle({...coloured[0],content_url:null},coloured),undefined);
const older = {...coloured[0],id:'older',views:100,last_synced_at:'2026-11-25T00:00:00Z'};
const newer = {...coloured[1],id:'newer',views:110,last_synced_at:'2026-11-27T00:00:00Z'};
assert.equal(uniqueCollabPublications([older,newer])[0].id,'newer');

const interleaved = [coloured[0],coloured[2],coloured[1],coloured[3]];
assert.deepEqual(groupCollabPublications(interleaved).map(row=>row.id),[coloured[0].id,coloured[1].id,coloured[2].id,coloured[3].id]);
// The caller partitions first: a partner in Added value is never pulled into Agreed.
assert.deepEqual(groupCollabPublications([coloured[0],coloured[2]]).map(row=>row.id),[coloured[0].id,coloured[2].id]);
