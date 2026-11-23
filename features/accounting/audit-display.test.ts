import test from 'node:test';
import assert from 'node:assert/strict';
import {auditChanges,auditDate,auditLabel,auditValue} from './audit-display';
test('audit shows Cairo time across midnight and clear field names',()=>{
 assert.match(auditDate('2026-11-22T22:11:50Z'),/23 Nov 2026/);
 assert.match(auditDate('2026-11-22T22:11:50Z'),/00:11:50/);
 assert.equal(auditLabel('tw_accounting_journals'),'Journals');
 assert.deepEqual(auditChanges({id:'x',version:1,status:'draft',memo:'same'},{id:'x',version:2,status:'posted',memo:'same'}),[{field:'Status',before:'draft',after:'posted'}]);
 assert.equal(auditValue(false),'No');assert.equal(auditValue(null),'—');
});
