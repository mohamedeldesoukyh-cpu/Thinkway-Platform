import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkspaceHistory } from './workspace-history';

test('undo/redo preserves order and rapid changes are a single edit', () => {
  const history = new WorkspaceHistory(); let value = 0;
  const edit = (before: number, after: number, time: number) => { value = after; history.record({ owner: 'line', label: 'Quantity', undo: () => { value = before; }, redo: () => { value = after; } }, time); };
  edit(0, 1, 1000); edit(1, 2, 1100);
  assert.equal(history.past.length, 1);
  assert.ok(history.step('undo')); assert.equal(value, 0);
  assert.ok(history.step('redo')); assert.equal(value, 2);
  edit(2, 3, 2000); history.step('undo'); assert.equal(value, 2);
  edit(2, 4, 3000); assert.equal(history.step('redo'), false); assert.equal(value, 4);
});
test('unavailable edits cannot replay while saving; unmounted fields are removed', () => {
  const history = new WorkspaceHistory(); let allowed = false; let called = 0;
  history.record({ owner:'form', label:'Edit', undo: () => { called++; }, redo: () => {}, available: () => allowed });
  assert.equal(history.step('undo'), false); assert.equal(called, 0);
  allowed = true; assert.equal(history.step('undo'), true);
  history.remove('form'); assert.equal(history.step('redo'), false);
});
test('history is bounded and a save/reset clears both directions', () => {
  const history = new WorkspaceHistory();
  for (let i = 0; i < 130; i++) history.record({ owner: String(i), label: 'Edit', undo: () => {}, redo: () => {} }, i * 1000);
  assert.equal(history.past.length, 100); history.step('undo'); history.clear();
  assert.equal(history.step('undo'), false); assert.equal(history.step('redo'), false);
});
