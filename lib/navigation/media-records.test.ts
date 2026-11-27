import assert from 'node:assert/strict';
import test from 'node:test';
import { filterMediaRecords } from './media-records';
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
