import assert from 'node:assert/strict';
import {test} from 'node:test';
import {approvalPolicySchema,controlActionSchema,controlFiltersSchema} from './control-validation';
const id='c51af0df-d59f-44d0-bd29-5bfb25fbd349';
const entry={id,version:1};
test('bulk control requests reject duplicate, oversized and stale selections',()=>{
 const value={company:id,action:'lock',reason:'Review complete',entries:[entry]};
 assert.equal(controlActionSchema.safeParse(value).success,true);
 for(const entries of [[],[entry,entry],Array(101).fill(entry),[{id,version:0}]])assert.equal(controlActionSchema.safeParse({...value,entries}).success,false);
 assert.equal(controlActionSchema.safeParse({...value,reason:' '}).success,false);
});
test('approvals require explicit policy and individually reviewed entries',()=>{
 assert.equal(approvalPolicySchema.safeParse({company:id,version:1,required:false,reason:'Direct posting authorized'}).success,true);
 assert.equal(approvalPolicySchema.safeParse({company:id,version:1,required:'false',reason:'Change'}).success,false);
 assert.equal(controlActionSchema.safeParse({company:id,action:'approve',reason:'Review',entries:[entry,{id:'f2e5a39f-e54f-4f21-9c6f-d0efcdb72cdd',version:1}]}).success,false);
});
test('control filters reject invalid date ranges and unknown states',()=>{
 const filters={company:id,from:'2026-01-01',to:'2026-12-31'};
 assert.equal(controlFiltersSchema.safeParse(filters).success,true);
 for(const patch of [{to:'2025-01-01'},{from:'2026-02-30'},{approval:'posted'},{page:-1},{locked:'true'}])assert.equal(controlFiltersSchema.safeParse({...filters,...patch}).success,false);
});
