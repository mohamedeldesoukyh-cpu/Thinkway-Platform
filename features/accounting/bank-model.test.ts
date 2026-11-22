import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseBankCsv,bankSelectionTotal} from './bank-model';
test('bank CSV preserves signed amounts and quoted references/descriptions',()=>{
 const rows=parseBankCsv('\uFEFFdate,reference,description,amount\r\n2026-01-05,"Ref, 1","Bank ""receipt""\ncontinued",100.10\r\n2026-01-06,P1,Payment,-30.05\r\n');
 assert.deepEqual(rows[0],{date:'2026-01-05',reference:'Ref, 1',description:'Bank "receipt"\ncontinued',amount:'100.10'});
 assert.equal(bankSelectionTotal(rows.map(r=>r.amount)),'70.05');
});
test('bank CSV rejects malformed, ambiguous or invalid financial rows',()=>{
 const prefix='date,reference,description,amount\n';
 for(const row of ['2026-02-30,R,Bad date,1','2026-01-01,R,Zero,0','2026-01-01,R,Precision,1.001','2026-01-01,R,Thousands,"1,000.00"','2026-01-01,R,Exponent,1e3','2026-01-01,R,"Unclosed,1','2026-01-01,R,"Quoted"junk,1'])assert.throws(()=>parseBankCsv(prefix+row));
 assert.throws(()=>parseBankCsv('date,amount\n2026-01-01,1'));
 assert.throws(()=>parseBankCsv(prefix+Array.from({length:2001},()=> '2026-01-01,R,Too many,1').join('\n')));
});
test('reconciliation selection arithmetic remains exact',()=>{
 assert.equal(bankSelectionTotal(['999999999999.99','-999999999999.98']),'0.01');
 assert.equal(bankSelectionTotal(['100.10','-100.10']),'0.00');
});
