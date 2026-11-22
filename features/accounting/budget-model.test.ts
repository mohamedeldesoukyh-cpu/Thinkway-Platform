import assert from 'node:assert/strict';
import {test} from 'node:test';
import {allocateBudget,budgetVariance} from './budget-model';
import {cents} from './journal-model';
test('annual allocation preserves every cent including signed amounts',()=>{for(const value of ['100','0.01','-100.01','999999999.99']){const rows=allocateBudget(value);assert.equal(rows.length,12);assert.equal(rows.reduce((n,v)=>n+cents(v),BigInt(0)),cents(value));}assert.equal(allocateBudget('100')[0],'8.34');assert.equal(allocateBudget('100')[11],'8.33');});
test('variance distinguishes expense overruns from revenue shortfalls',()=>{assert.equal(budgetVariance('Expense','100','120'),'-20.00');assert.equal(budgetVariance('Revenue','100','120'),'20.00');});
