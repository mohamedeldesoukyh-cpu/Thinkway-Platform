import assert from 'node:assert/strict';
import test from 'node:test';
import {uploadBlocker,uploadReview} from './upload-review';
import type {ImportRow,RateInput} from './model';
const rate=(ref:string,type:'creator_cost'|'client_price'='creator_cost'):RateInput=>({creator_ref:ref,creator_name:'Creator',platform:'instagram',deliverable:'instagram_reel',amount:0,currency:'EGP',notes:'',price_type:type,agency_fee_percent:null});
test('review separates workbook rows, unique identities, pending creators and writable pricing lines',()=>{
 const a=rate('inf:existing'),b=rate('inf:new');
 const rows:ImportRow[]=[{row:2,status:'ready',issues:[],rate:a,rates:[a,rate(a.creator_ref,'client_price')]},{row:3,status:'warning',issues:['name_warning'],rate:a},{row:4,status:'warning',issues:['newCreatorImport'],rate:b,pending_creator:{profile_url:'https://instagram.com/new',platform:'instagram',handle:'new'}},{row:5,status:'error',issues:['invalid']},{row:6,status:'unmatched',issues:['unmatched']}];
 assert.deepEqual(uploadReview(rows),{rows:5,creators:2,matched:1,pending:1,lines:4,counts:{ready:1,warning:2,error:1,unmatched:1}});
});
const valid={busy:false,step:2,hasFile:true,hasRows:true,errors:0,unmatched:0,conflicts:false,stale:false,mode:'new' as const,name:''};
test('review can continue with warnings, confirmation needs a name, update does not',()=>{
 assert.equal(uploadBlocker(valid),null);
 assert.equal(uploadBlocker({...valid,step:3}),'whyName');
 assert.equal(uploadBlocker({...valid,step:3,mode:'update'}),null);
 assert.equal(uploadBlocker({...valid,step:3,name:'V2'}),null);
});
test('all blocking states explain disabled action, but upload step allows replacing bad rows',()=>{
 assert.equal(uploadBlocker({...valid,busy:true}),'whyRun');
 assert.equal(uploadBlocker({...valid,errors:1}),'whyErr');
 assert.equal(uploadBlocker({...valid,unmatched:1}),'whyUnm');
 assert.equal(uploadBlocker({...valid,conflicts:true}),'whyUnm');
 assert.equal(uploadBlocker({...valid,stale:true}),'staleT');
 assert.equal(uploadBlocker({...valid,step:1,hasFile:false}),'whyFile');
 assert.equal(uploadBlocker({...valid,step:1,errors:1}),null);
 assert.equal(uploadBlocker({...valid,hasRows:false}),'whyFile');
});
