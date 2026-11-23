import test from 'node:test';import assert from 'node:assert/strict';
import {chartPreview} from './chart-preview';import type {AccountingSetup} from './setup-types';
test('chart preview includes owned/shared auxiliaries only when requested and keeps account scope',()=>{
 const setup={company:{name:'Thinkway'},accounts:[{code:'111001',name:'Cash',kind:'Posting',type:'Asset',normal:'Debit',active:true,hasAuxiliary:true},{code:'111002',name:'Shared cash',kind:'Posting',type:'Asset',normal:'Debit',active:true,hasAuxiliary:true,auxiliarySource:'111001'}]} as AccountingSetup;
 const aux=[{account_code:'111001',number:7,name:'Office',active:true}];
 assert.equal(chartPreview(setup,['111001'],null).sections[0].rows.length,1);
 const rows=chartPreview(setup,['111001','111002'],aux).sections[0].rows;
 assert.equal(rows.length,4);assert.equal(rows[1][0],'111001 / 7');assert.equal(rows[3][0],'111002 / 7');assert.equal(chartPreview(setup,[],aux).sections[0].rows.length,0);
});

test('shared third parties appear beneath their GL with short codes',()=>{
 const setup={company:{name:'Thinkway'},accounts:[{code:'121001',name:'Receivables',kind:'Control',type:'Asset',normal:'Debit',active:true}]} as AccountingSetup;
 const report=chartPreview(setup,['121001'],[{account_code:'121001',number:'CLT-000003',name:'Shared client',active:true}]);
 assert.equal(report.sections[0].rows[1][0],'121001 / 3');
});
