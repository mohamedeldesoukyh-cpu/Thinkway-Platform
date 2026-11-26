import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignmentDeliveryProgress } from './assignment-delivery-progress';
import type { DeliveryPublication } from './publication-delivery-coverage';
const line = {id:'a',assignment_status:'invoiced',went_live_date:null as string|null};
const d = (id: string, platform: string, deliverable_type: string, quantity=1) => ({id,platform,deliverable_type,quantity,workflow_status:'draft',live_date:null,posts:[]});
const ig = d('ig','instagram','ig_reel');
const tt = d('tt','tiktok','mirrored_tt');
const story = d('story','instagram','ig_story_set');
const pub = (id: string): DeliveryPublication => ({id,campaign_line_id:'a',platform:'instagram',publication_type:'instagram_reel',content_url:'https://example.com/'+id,status:'published'});
const run = (deliverables=[ig,tt,story], pubs:DeliveryPublication[]=[], entry=line) => assignmentDeliveryProgress([entry],[{line:entry,deliverables}],pubs);

test('one Performance post completes the entire package across platforms and quantities',()=>{
  assert.deepEqual(run([ig,tt,story,d('boost','tiktok','boosting'),d('extra','instagram','ig_reel',4)],[pub('ig')]), {
    live:1, verified:1, total:1, progressPercent:100, completionPercent:100,
  });
});

test('completion follows Went live even without a separately recorded publication',()=>{
  assert.equal(run(undefined,[],{...line,went_live_date:'2026-11-18'}).completionPercent,100);
  assert.equal(run([{...ig,workflow_status:'posted'}]).completionPercent,100);
  assert.equal(run([{...ig,posts:[{workflow_status:'posted',live_date:null}]}]).completionPercent,100);
  assert.equal(run([],[],{...line,assignment_status:'live'}).completionPercent,100);
});

test('another assignment, draft, deleted and empty links do not establish delivery',()=>{
  for(const patch of [{campaign_line_id:'other'},{status:'draft'},{status:'deleted'},{content_url:'  '}])
    assert.equal(run([ig],[{...pub('one'),...patch}]).completionPercent,0);
});

test('duplicates, platform and unit links do not change assignment-level completion',()=>{
  const first=pub('one');
  assert.equal(run([ig],[first,{...first,id:'duplicate'}]).verified,1);
  assert.equal(run([ig],[{...first,platform:'facebook',publication_type:'facebook_reel',assignment_deliverable_id:'different'}]).completionPercent,100);
  assert.equal(run([],[first]).completionPercent,100);
});

test('billing alone does not complete an undelivered package',()=>{
  for(const assignment_status of ['invoiced','paid','closed'])
    assert.equal(run([ig],[],{...line,assignment_status}).completionPercent,0);
});

test('untouched stories and offline services wait for recorded delivery',()=>{
  for(const deliverable of [story,d('visit','other','visit')]) {
    assert.equal(run([deliverable]).completionPercent,0);
    assert.equal(run([deliverable],[],{...line,went_live_date:'2026-11-18'}).completionPercent,100);
  }
});

test('Vileda: ten live assignments complete when one has only its Instagram post',()=>{
  const lines = Array.from({length:10},(_,i)=>({...line,id:String(i)}));
  const groups = lines.map(entry=>({line:entry,deliverables:[ig,tt,d('boost','tiktok','boosting')]}));
  const publications = lines.flatMap((entry,i)=>[
    {...pub('ig'+i),campaign_line_id:entry.id},
    ...(i===9 ? [] : [{...pub('tt'+i),platform:'tiktok',publication_type:'tiktok_video',campaign_line_id:entry.id}]),
  ]);
  assert.deepEqual(assignmentDeliveryProgress(lines,groups,publications), {
    live:10, verified:10, total:10, progressPercent:100, completionPercent:100,
  });
  assert.equal(assignmentDeliveryProgress(lines,groups,publications.filter(p=>p.campaign_line_id!=='9')).completionPercent,90);
});

test('empty campaigns and missing publication do not read complete',()=>{
  assert.equal(assignmentDeliveryProgress([],[],[]).completionPercent,0);
  assert.equal(run([ig],[pub('one')]).completionPercent,100);
  assert.equal(run([ig],[]).completionPercent,0);
});
