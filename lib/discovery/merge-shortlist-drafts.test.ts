import test from 'node:test';
import assert from 'node:assert/strict';
import {isEmptyMergeDraft} from './merge-shortlist-drafts';
const draft={item_status:'draft',profile_id:null,deliverables:[],platform_account_ids:['platform']};
test('only empty draft memberships can be consolidated',()=>{
 assert.equal(isEmptyMergeDraft(draft),true);
 for(const patch of [{cost:0},{revenue:100},{notes:'Keep this note'},{deliverables:[{type:'reel'}]},{item_status:'approved'},{profile_id:'profile'},{commercial_updated_at:'2026-10-01'},{fx_rate_to_egp:50}])assert.equal(isEmptyMergeDraft({...draft,...patch}),false,JSON.stringify(patch));
});
