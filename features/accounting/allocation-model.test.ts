import test from 'node:test';import assert from 'node:assert/strict';
import { automaticAllocation,unallocated,type OpenItem } from './allocation-model';
const invoice=(id:string,date:string,due:string|null,outstanding:string):OpenItem=>({id,number:id,date,due,outstanding,total:outstanding,settled:'0',currency:'USD',account:'121001'});
test('Automatic allocation uses oldest due date and partially settles the final invoice',()=>{
 const rows=[invoice('B','2026-01-01','2026-02-10','40.25'),invoice('A','2026-01-02','2026-02-01','80'),invoice('C','2025-12-01',null,'100')];
 assert.deepEqual(automaticAllocation('100.01',rows),[{id:'A',amount:'80.00'},{id:'B',amount:'20.01'}]);assert.equal(unallocated('100.01',automaticAllocation('100.01',rows)),'0.00');
});
test('Excess receipt remains an exact advance and does not overpay invoices',()=>{const lines=automaticAllocation('123456789012.34',[invoice('A','2026-01-01',null,'0.01')]);assert.equal(unallocated('123456789012.34',lines),'123456789012.33');});
test('Manual allocation exposes an over-allocation instead of silently changing amounts',()=>{assert.equal(unallocated('10',[{id:'A',amount:'10.01'}]),'-0.01');assert.throws(()=>automaticAllocation('0',[]));});
