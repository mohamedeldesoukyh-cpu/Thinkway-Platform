import test from 'node:test';
import assert from 'node:assert/strict';
import {accrualRows,accrualTotal,type AccrualPlan} from './monthly-accrual-model';
test('monthly review separates net revenue and cost and reverses the exact booked local amount',()=>{
 const base={assignment:'a',reference:'A1',campaign:'Campaign',currency:'USD',amount:'1250.50',baseAmount:'62525.00',rate:'50',auxiliary:null,clientCode:'C1'};
 const plan:AccrualPlan={date:'2026-01-31',base:'EGP',token:'x',items:[{...base,component:'agency_fee',account:'414001',counter:'122001'},{...base,component:'usage_rights_cost',account:'511001',counter:'212001'}]};
 const rows=accrualRows(plan,false);assert.equal(rows.length,4);assert.deepEqual(rows.map(r=>r.slice(-2)),[['0.00','62,525.00'],['62,525.00','0.00'],['62,525.00','0.00'],['0.00','62,525.00']]);assert.equal(rows[1][4],'C1');assert.equal(rows[3][4],'');assert.equal(rows[0][6],'1,250.50');assert.equal(accrualTotal(plan),'125,050.00');assert.deepEqual(accrualRows(plan,true).map(r=>r.slice(-2)),rows.map(r=>r.slice(-2).reverse()));
});
