import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reuseDeliverableVideo } from './reuse-video-service';
import type { DocumentationUnitSummary } from './documentation-types';
import { isVersionReleasedToClient } from './client-release';
const target = {unitKey:'target', campaignHeaderId:'campaign',creatorId:'creator',assignmentDeliverableId:'mirror',assignmentPostScheduleId:null,quantity:1,deliverableType:'mirrored_tt'} as DocumentationUnitSummary;
const source = {...target,unitKey:'source',assignmentDeliverableId:'reel',deliverableType:'instagram_reel'};
const original = {id:'version',asset_id:'asset',storage_bucket:'deliverable-assets',storage_path:'campaign/reel/asset/video.mp4',file_name:'video.mp4',file_size:500,mime_type:'video/mp4',metadata:{released_to_client_at:'2026-10-10',production_status:'final'}};
function fixture(changes: {version?:Record<string,unknown>;asset?:Record<string,unknown>;failVersion?:boolean}={}) {
  const writes: {table:string;kind:string;value:any}[]=[];
  const db = {from(table:string) {
    let kind='read', value:any;
    const chain:any = {select(){return chain},eq(){return chain},is(){return chain},
      insert(v:any){kind='insert';value=v;return chain},update(v:any){kind='update';value=v;return chain},
      maybeSingle(){return Promise.resolve({data:table==='deliverable_asset_versions'?{...original,...changes.version}:{id:'asset',assignment_deliverable_id:'reel',assignment_post_schedule_id:null,current_version_id:'version',medium:'file',...changes.asset},error:null})},
      then(resolve:any,reject:any){writes.push({table,kind,value});return Promise.resolve({error:changes.failVersion&&table==='deliverable_asset_versions'?{message:'failed'}:null}).then(resolve,reject)}
    };return chain;
  }};
  return {db:db as any,writes};
}
const input={campaignHeaderId:'campaign',targetUnitKey:'target',sourceVersionId:'version',actorId:'staff'};
test('reuse references identical storage bytes and creates an independently reviewable client-visible version',async()=>{
  const f=fixture();assert.equal((await reuseDeliverableVideo(f.db,input,[target,source])).ok,true);
  const v=f.writes.find(w=>w.table==='deliverable_asset_versions')!.value;
  assert.equal(v.storage_path,original.storage_path);assert.equal(v.storage_bucket,original.storage_bucket);
  assert.equal(v.metadata.linked_source_version_id,'version');assert.ok(isVersionReleasedToClient(v.metadata));
  assert.notEqual(v.id,original.id);assert.equal(v.metadata.production_status,'final');
  assert.ok(!f.writes.some(w=>w.table==='campaign_client_content_decisions'));
});
test('rejects a different creator, campaign, same unit or non-mirrored destination before writes',async()=>{
  for(const units of [[{...target,creatorId:'other'},source],[target,{...source,campaignHeaderId:'other'}],[{...source,unitKey:'target'},source],[{...target,quantity:2},source]]){
    const f=fixture();assert.equal((await reuseDeliverableVideo(f.db,input,units)).ok,false);assert.equal(f.writes.length,0);
  }
});
test('rejects hidden, removed, unreleased, missing and non-video content',async()=>{
  for(const version of [{metadata:{}},{metadata:{...original.metadata,client_hidden_at:'now'}},{metadata:{...original.metadata,version_removed_at:'now'}},{mime_type:'image/jpeg'},{storage_path:null}]){
    const f=fixture({version});assert.equal((await reuseDeliverableVideo(f.db,input,[target,source])).ok,false);assert.equal(f.writes.length,0);
  }
});
test('rejects stale or non-file source versions',async()=>{
  for(const asset of [{current_version_id:'newer'},{medium:'external_link'}]){
    const f=fixture({asset});assert.equal((await reuseDeliverableVideo(f.db,input,[target,source])).ok,false);assert.equal(f.writes.length,0);
  }
});
test('failed version creation archives only the newly created shell',async()=>{
  const f=fixture({failVersion:true});assert.equal((await reuseDeliverableVideo(f.db,input,[target,source])).ok,false);
  assert.ok(f.writes.some(w=>w.table==='deliverable_assets'&&w.kind==='update'&&w.value.archived_at));
  assert.ok(!f.writes.some(w=>w.value.current_version_id));
});
