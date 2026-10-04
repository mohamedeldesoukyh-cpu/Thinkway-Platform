import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchCampaignLineById} from './campaign-line-query';
import {LINE_ASSIGNMENT_META_KEY} from '@/lib/campaigns/line-assignment';
const id='11111111-1111-4111-8111-111111111111';
function mock(metadata:unknown, linkError:unknown=null, rowError:unknown=null){
 const calls:Array<[string,string,unknown]>=[];
 const db={from(table:string){const q={select(v:string){calls.push([table,'select',v]);if(table==='campaign_lines')assert.ok(!v.split(',').map(x=>x.trim()).includes('influencer_id'));return q;},eq(k:string,v:string){calls.push([table,k,v]);return q;},neq(){return q;},not(){return q;},limit(){return q;},async maybeSingle(){return table==='campaign_lines'?{data:rowError?null:{metadata,cost_locked:true,vendor_assignment_locked:true,cost:250},error:rowError}:{data:linkError?null:{influencer_id:id},error:linkError};}};return q;}};
 return {db:db as unknown as SupabaseClient,calls};
}
test('cost edit reads valid campaign-line columns and preserves creator identity and locks',async()=>{const {db,calls}=mock({[LINE_ASSIGNMENT_META_KEY]:{influencer_id:id,influencer_name:'Creator',platforms:[]}});const r=await fetchCampaignLineById(db,'line','campaign');assert.equal(r.data?.influencer_id,id);assert.equal(r.data?.cost_locked,true);assert.equal(r.data?.vendor_assignment_locked,true);assert.ok(!calls.some(c=>c[0]==='campaign_influencers'));});
test('legacy assignment resolves creator through campaign-scoped link',async()=>{const {db,calls}=mock(null);const r=await fetchCampaignLineById(db,'line','campaign');assert.equal(r.data?.influencer_id,id);assert.ok(calls.some(c=>c[0]==='campaign_influencers'&&c[1]==='campaign_header_id'&&c[2]==='campaign'));});
test('lookup errors stop save rather than bypassing replacement checks',async()=>{const error={message:'lookup failed'};const {db}=mock(null,error);const r=await fetchCampaignLineById(db,'line','campaign');assert.equal(r.data,null);assert.equal(r.error,error);});
test('missing line preserves original error',async()=>{const error={message:'line unavailable'};const {db,calls}=mock(null,null,error);const r=await fetchCampaignLineById(db,'line','campaign');assert.equal(r.error,error);assert.equal(calls.some(c=>c[0]==='campaign_influencers'),false);});
