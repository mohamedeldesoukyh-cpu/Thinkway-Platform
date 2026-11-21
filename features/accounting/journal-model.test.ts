import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cents,decimal,money,totals,reportCsv } from './journal-model';
import { journalSchema,isoDate } from './journal-validation';
test('money arithmetic remains exact beyond floating point totals',()=>{
 assert.equal(cents('0.10')+cents('0.20'),BigInt(30));
 const t=totals(Array.from({length:200},()=>({debit:'999999999999.99',credit:'0'})));
 assert.equal(decimal(t.debit),'199999999999998.00');
 assert.equal(money(t.debit),'199,999,999,999,998.00');
 assert.equal(decimal(cents('-0.01')),'-0.01');
 assert.throws(()=>cents('1.001'));assert.throws(()=>cents('NaN'));
});
test('journal input rejects invalid lines but allows an unbalanced draft',()=>{
 const j={id:'00000000-0000-4000-8000-000000000001',company:'00000000-0000-4000-8000-000000000002',date:'2026-01-01',reference:'',memo:'Test journal',version:null,lines:[{account:'633001',description:'',debit:'10.01',credit:'0'},{account:'159001',description:'',debit:'0',credit:'10'}]};
 assert.equal(journalSchema.safeParse(j).success,true);
 for(const debit of ['-1','1e3','0.001','NaN'])assert.equal(journalSchema.safeParse({...j,lines:[{...j.lines[0],debit},j.lines[1]]}).success,false);
 assert.equal(journalSchema.safeParse({...j,lines:[{...j.lines[0],credit:'1'},j.lines[1]]}).success,false);
 assert.equal(journalSchema.safeParse({...j,lines:[{...j.lines[0],debit:'0'},j.lines[1]]}).success,false);
 assert.equal(isoDate.safeParse('2026-02-29').success,false);assert.equal(isoDate.safeParse('2028-02-29').success,true);
});
test('report exports escape text formulas and preserve exact decimals',()=>{
 assert.ok(reportCsv([['=HYPERLINK("bad")','123.45']]).includes('"\'=HYPERLINK(""bad"")","123.45"'));
});
