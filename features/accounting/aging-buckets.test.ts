import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAgingBounds,configuredAgingBucket,agingLabels} from './aging-buckets';

test('fixed and custom aging boundaries have no gaps or overlaps',()=>{
  const bounds=parseAgingBounds('15, 30, 60, 90');
  const today='2026-11-23';
  const at=(days:number)=>new Date(Date.parse(today+'T00:00:00Z')-days*86400000).toISOString().slice(0,10);
  for(const [days,label] of [[-1,'Current'],[0,'Current'],[1,'1–15'],[15,'1–15'],[16,'16–30'],[30,'16–30'],[31,'31–60'],[90,'61–90'],[91,'90+']] as const)
    assert.equal(configuredAgingBucket(at(days),today,bounds),label);
  assert.equal(configuredAgingBucket(null,today,bounds),'No date');
  assert.deepEqual(agingLabels([30]),['Current','1–30','30+','No date']);
});
test('invalid and overlapping aging definitions fail before saving',()=>{
  for(const value of ['', '0,30', '30,30', '60,30', '10.5,30', '30,', '30,abc', '3651', '1,2,3,4,5,6,7,8,9'])
    assert.throws(()=>parseAgingBounds(value));
});
