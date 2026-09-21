import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentAllocation,paymentUnits} from './allocations';
const units = [1,2,3].map(n=>({id:String(n),label:`Deliverable ${n}`,live:n<3}));
test('90000 / three units: 75000 paid, two live gives 60000 earned and 15000 advance',()=>{
 const r=paymentAllocation({fee:90000,vat:0,paid:75000,units});
 assert.deepEqual([r.earned,r.actual,r.advance,r.remaining],[60000,60000,15000,15000]);
 assert.deepEqual(r.units.map(u=>u.allocated),[30000,30000,15000]);
 const settled=paymentAllocation({fee:90000,vat:0,paid:75000,units:units.map(u=>({...u,live:true}))});
 assert.deepEqual([settled.earned,settled.advance,settled.remaining,settled.fullyPaid],[90000,0,15000,false]);
 assert.equal(paymentAllocation({fee:90000,vat:0,paid:90000,units:units.map(u=>({...u,live:true}))}).fullyPaid,true);
 assert.equal(paymentAllocation({fee:90000,vat:0,paid:90000,units}).fullyPaid,false);
});
test('FIFO partial payments allocate 45000 as 30000,15000,0; live obligations settle first',()=>{
 assert.deepEqual(paymentAllocation({fee:90000,vat:0,paid:45000,units}).units.map(u=>u.allocated),[30000,15000,0]);
 const outOfOrder=paymentAllocation({fee:90000,vat:0,paid:45000,units:units.map(u=>({...u,live:u.id==='3'}))});
 assert.deepEqual(outOfOrder.units.map(u=>u.allocated),[15000,0,30000]);
 assert.equal(outOfOrder.advance,15000);
 assert.equal(outOfOrder.actual,30000);
});
test('cent allocation preserves total with VAT; no units means no earned payment',()=>{
 const r=paymentAllocation({fee:100,vat:14,paid:100,units});
 assert.equal(r.units.reduce((s,u)=>s+u.value,0),114);
 const cents=paymentAllocation({fee:100,vat:0,paid:100,units});
 assert.deepEqual(cents.units.map(u=>u.value),[33.34,33.33,33.33]);
 assert.equal(paymentAllocation({fee:100,vat:0,paid:50,units:[]}).advance,50);
});
test('scheduled dates do not earn fees; repeated publication links do not multiply units',()=>{
 const d={id:'d',campaign_line_id:'l',quantity:3,sort_order:0,deliverable_type:'ig_reel',created_at:'2026-09-01'};
 const posts=[{id:'p1',assignment_deliverable_id:'d',sequence_number:1,status:'scheduled'},{id:'p2',assignment_deliverable_id:'d',sequence_number:2,status:'posted'}];
 assert.deepEqual(paymentUnits([d],posts,[],[]).map(u=>u.live),[false,true,false]);
 const publication={id:'pub',assignment_deliverable_id:'d',assignment_post_schedule_id:'p1',status:'published'};
 const link={assignment_deliverable_id:'d',assignment_post_schedule_id:'p1',publication_id:'pub'};
 assert.deepEqual(paymentUnits([d],posts,[publication],[link,link]).map(u=>u.live),[true,true,false]);
 assert.deepEqual(paymentUnits([d],[],[{...publication,assignment_post_schedule_id:null}],[]).map(u=>u.live),[true,false,false]);
});
