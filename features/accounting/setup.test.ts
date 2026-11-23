import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleHome, isAccountingPath, NO_MODULES } from '../../lib/auth/module-access';
import { companySchema, accountSchema } from './setup-validation';
import { CHART, chartCsv } from './chart';

test('saved chart exports status and neutralizes spreadsheet formulas',()=>{
 const csv=chartCsv([{...CHART[0],name:'=1+1',active:false,nameAr:'اسم الحساب'}]);
 assert.ok(csv.includes('"\'=1+1"'));
 assert.ok(csv.includes('"Inactive","اسم الحساب"'));
});

test('login destination follows assigned modules',()=>{
 assert.equal(moduleHome(NO_MODULES),'/modules');
 assert.equal(moduleHome({...NO_MODULES,media:true}),'/media');
 assert.equal(moduleHome({...NO_MODULES,accounting:true}),'/accounting');
 assert.equal(moduleHome({...NO_MODULES,media:true,accounting:true}),'/modules');
 assert.equal(isAccountingPath('/api/accounting/setup'),true);
 assert.equal(isAccountingPath('/accounting-other'),false);
 assert.equal(isAccountingPath('/api/clients'),false);
});
test('company dates and currency are validated before database writes',()=>{
 assert.equal(companySchema.parse({name:'Thinkway',country:'eg',currency:'egp',start:'2026-01-01'}).currency,'EGP');
 for(const start of ['2026-13-01','2026-01-02','2026-02-30']) assert.equal(companySchema.safeParse({name:'Thinkway',country:'EG',currency:'EGP',start}).success,false);
 assert.equal(companySchema.safeParse({name:'Thinkway',country:'EG',currency:'BAD',start:'2026-01-01'}).success,false);
});
test('control accounts require a supported subledger',()=>{
 const a={companyId:'00000000-0000-4000-8000-000000000001',code:'121001',name:'Receivables',nameAr:'',parent:'120000',type:'Asset',normal:'Debit',kind:'Control',active:true,version:null,subledger:null};
 assert.equal(accountSchema.safeParse(a).success,false);
 assert.equal(accountSchema.safeParse({...a,subledger:'Customer'}).success,true);
 assert.equal(accountSchema.safeParse({...a,kind:'Posting',subledger:'Customer'}).success,false);
});
