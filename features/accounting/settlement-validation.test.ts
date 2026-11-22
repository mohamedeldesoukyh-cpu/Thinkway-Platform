import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {settlementSchema} from './settlement-validation';
const original={company:randomUUID(),kind:'receipt',party:randomUUID(),currency:'EGP',date:'2026-11-22',amount:'100',cash:'111001',control:'121001',advance:'221001',gain:'712001',loss:'722001',parent:null,advanceRow:true,method:'bank_transfer',reference:'Reference',lines:[{id:randomUUID(),amount:'80'}]};
test('positive vouchers retain their existing validation',()=>{
 assert.equal(settlementSchema.safeParse(original).success,true);
 assert.equal(settlementSchema.safeParse({...original,amount:'-100'}).success,false);
 assert.equal(settlementSchema.safeParse({...original,amount:'0'}).success,false);
});
test('refunds require original voucher and consistently negative amounts',()=>{
 const refund={...original,kind:'receipt_refund',refundOf:randomUUID(),amount:'-50',lines:[{...original.lines[0],amount:'-30'}]};
 assert.equal(settlementSchema.safeParse(refund).success,true);
 assert.equal(settlementSchema.safeParse({...refund,kind:'payment_refund'}).success,true);
 for(const invalid of [{refundOf:null},{amount:'50'},{amount:'-0'},{parent:randomUUID()},{lines:original.lines},{amount:'-'}])assert.equal(settlementSchema.safeParse({...refund,...invalid}).success,false);
});
