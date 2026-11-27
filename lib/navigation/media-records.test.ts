import assert from 'node:assert/strict';
import test from 'node:test';
import { filterMediaRecords, mediaRecordHref } from './media-records';
import { campaignDetailPath } from '@/lib/routing/entity-paths';
const rows = [
  {id:'a',number:'TW-2026-0012',client:'Mind Share',name:'Limitless Naturals'},
  {id:'b',number:'TW-2026-0007',client:'Essencemediacom',name:'Vileda Turbo Smart'},
];
test('lookup matches displayed and stored campaign numbers', () => {
  assert.deepEqual(filterMediaRecords(rows,'Camp#26-12').map(r=>r.id), ['a']);
  assert.deepEqual(filterMediaRecords(rows,'TW-2026-0007').map(r=>r.id), ['b']);
});
test('bare numbers match the campaign serial, not the year or another serial', () => {
  assert.deepEqual(filterMediaRecords(rows,'12').map(r=>r.id), ['a']);
  assert.deepEqual(filterMediaRecords(rows,'007').map(r=>r.id), ['b']);
  assert.deepEqual(filterMediaRecords(rows,'2'), []);
});
test('lookup combines client and campaign terms without changing navigation order', () => {
  assert.deepEqual(filterMediaRecords(rows,'mind limitless').map(r=>r.id), ['a']);
  assert.deepEqual(filterMediaRecords(rows,'').map(r=>r.id), ['a','b']);
  assert.deepEqual(filterMediaRecords(rows,'unknown'), []);
});
test('campaign links go directly to the canonical route and preserve the workspace tab', () => {
  const row = {id:'12345678-1234-4000-8000-123456789012',number:'TW-2026-0012',name:'Limitless Naturals',client:'Mind Share'};
  const canonical = campaignDetailPath({id:row.id,name:row.name,document_number:row.number});
  assert.equal(mediaRecordHref('campaigns',row,'finance'), `${canonical}?tab=finance`);
  assert.equal(mediaRecordHref('campaigns',row), '/campaigns/limitless-naturals-12345678');
  assert.equal(mediaRecordHref('campaigns',{...row,name:''}), '/campaigns/TW-2026-0012');
});
