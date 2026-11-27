import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePublicationShareLinks } from './resolve-publication-share-links';
import { attributeCollabPublications, collabCellStyle, groupCollabPublications, normalizePublicationContentUrl, notesHaveCollabMarker, setPublicationCollab, uniqueCollabPublications, withPublicationCollabColors } from './publication-content-url';

test('TikTok short/full links share reciprocal Collab, colour, grouping and one metric contribution', async () => {
  const rows = [
    {id:'adham',campaign_line_id:'a',influencer_name:'Adham',content_url:'https://vt.tiktok.com/ZSsSfwgy5/',notes:setPublicationCollab(null,true,{id:'w',name:'Wagdi'}),views:416800},
    {id:'other',campaign_line_id:'w',influencer_name:'Wagdi',content_url:'https://www.tiktok.com/@wagdi/video/999?lang=en',notes:null,views:10},
    {id:'wagdi',campaign_line_id:'w',influencer_name:'Wagdi',content_url:'https://www.tiktok.com/@wagdiaboellil/video/7712121907860032786?lang=en-GB',notes:null,views:413500},
  ];
  let calls=0;
  const fetcher = (async (_url, options) => {
    calls++; assert.equal(options?.redirect,'manual');
    return new Response(null,{status:301,headers:{location:'https://www.tiktok.com/@wagdiaboellil/video/7712121907860032786?_r=1&_t=tracking'}});
  }) as typeof fetch;
  const resolved=await resolvePublicationShareLinks(rows,fetcher);
  assert.equal(calls,1);
  assert.equal(rows[0].content_url,'https://vt.tiktok.com/ZSsSfwgy5/');
  assert.equal(normalizePublicationContentUrl(resolved[0].content_url),normalizePublicationContentUrl(resolved[2].content_url));
  const attributed=withPublicationCollabColors(attributeCollabPublications(resolved));
  assert.equal(notesHaveCollabMarker(attributed[2].notes),true);
  assert.equal(notesHaveCollabMarker(attributed[1].notes),false);
  assert.deepEqual(collabCellStyle(attributed[0],attributed),collabCellStyle(attributed[2],attributed));
  assert.deepEqual(groupCollabPublications(attributed).map(row=>row.id),['adham','wagdi','other']);
  assert.equal(uniqueCollabPublications(attributed).length,2);
});

test('share resolution rejects external redirects and preserves rows on network failure',async()=>{
 const rows=[{content_url:'https://vt.tiktok.com/short/'}];
 assert.deepEqual(await resolvePublicationShareLinks(rows,(async()=>new Response(null,{status:301,headers:{location:'https://example.com/video/123'}})) as typeof fetch),rows);
 assert.deepEqual(await resolvePublicationShareLinks(rows,(async()=>{throw new Error('unavailable')}) as typeof fetch),rows);
 let calls=0;
 await resolvePublicationShareLinks([{content_url:'https://example.com/short'}],(async()=>{calls++;return new Response()}) as typeof fetch);
 assert.equal(calls,0);
});
