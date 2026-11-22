import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignmentDeliveryProgress } from './assignment-delivery-progress';
import type { DeliveryPublication } from './publication-delivery-coverage';
const line = {id:'a',assignment_status:'invoiced',went_live_date:null as string|null};
const d = (id: string, platform: string, deliverable_type: string, quantity=1) => ({id,platform,deliverable_type,quantity,workflow_status:'draft',live_date:null,posts:[]});
const ig = d('ig','instagram','ig_reel');
const tt = d('tt','tiktok','mirrored_tt');
const story = d('story','instagram','ig_story_set');
const pub = (id: string, platform='instagram', publication_type='instagram_reel'): DeliveryPublication => ({id,campaign_line_id:'a',platform,publication_type,content_url:'https://example.com/'+id,status:'published'});
const run = (deliverables=[ig,tt,story], pubs:DeliveryPublication[]=[], entry=line) => assignmentDeliveryProgress([entry],[{line:entry,deliverables}],pubs);
test('matching IG and TT automatically complete the package without story verification',()=>{
  const result=run(undefined,[pub('ig'),pub('tt','tiktok','tiktok_video')]);
  assert.equal(result.completionPercent,100); assert.equal(result.progressPercent,100);
});
test('one platform cannot complete another, even with a copied package live date',()=>{
  assert.equal(run(undefined,[pub('ig')],{...line,went_live_date:'2026-11-18'}).completionPercent,0);
});
test('wrong creator, draft, deleted and wrong content type cannot satisfy delivery',()=>{
  for(const patch of [{campaign_line_id:'other'},{status:'draft'},{status:'deleted'},{publication_type:'instagram_post'}])
    assert.equal(run([ig],[{...pub('one'),...patch}]).completionPercent,0);
  assert.equal(run([ig],[]).completionPercent,0);
});
test('quantity requires distinct publications and ignores tracking URL duplicates',()=>{
  const reel=d('ig','instagram','instagram_reel',2);
  const first=pub('one');
  assert.equal(run([reel],[first,{...first,id:'duplicate',content_url:first.content_url+'?utm_source=x'}]).completionPercent,0);
  assert.equal(run([reel],[first,pub('two')]).completionPercent,100);
});
test('one publication cannot satisfy two deliverables and explicit links are respected',()=>{
  assert.equal(run([ig,{...ig,id:'ig2'}],[pub('one')]).completionPercent,0);
  assert.equal(run([ig],[{...pub('one'),assignment_deliverable_id:'different'}]).completionPercent,0);
});
test('billing or verification flags without publications never complete a reel',()=>{
  for(const assignment_status of ['invoiced','paid','closed','verified'])
    assert.equal(run([ig],[],{...line,assignment_status}).completionPercent,0);
});
test('stories do not need verification but an untouched package is not complete',()=>{
  assert.equal(run([story],[]).completionPercent,0);
  assert.equal(run([story],[],{...line,went_live_date:'2026-11-18'}).completionPercent,100);
});
test('non-publication services complete from recorded delivery, not billing',()=>{
  const service=d('visit','other','visit');
  assert.equal(run([service],[]).completionPercent,0);
  assert.equal(run([service],[],{...line,went_live_date:'2026-11-18'}).completionPercent,100);
});
test('empty campaigns never read complete and missing publication rolls completion back',()=>{
  assert.equal(assignmentDeliveryProgress([],[],[]).completionPercent,0);
  assert.equal(run([ig],[pub('one')]).completionPercent,100);
  assert.equal(run([ig],[]).completionPercent,0);
});
