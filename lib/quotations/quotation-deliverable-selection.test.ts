import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectAllDeliverableTypes, typeLinesFromSelectedTypes, syncDeliverableFromTypeLines, selectedTypesFromTypeLines, syncServiceDescriptionWithTypeLines, formatTypeLinesSummary, isPostTypeAllowedForCreator } from './quotation-deliverable-types';

test('select all respects creator platforms and clear removes every selected deliverable', () => {
  const selected = selectAllDeliverableTypes(true, ['instagram']);
  assert.ok(selected.length > 1);
  assert.ok(selected.every(type => isPostTypeAllowedForCreator(type, ['instagram'])));
  assert.equal(new Set(selected).size, selected.length);
  const before = typeLinesFromSelectedTypes(selected);
  const cleared = typeLinesFromSelectedTypes(selectAllDeliverableTypes(false, ['instagram']), before);
  const synced = syncDeliverableFromTypeLines(cleared, ['instagram'], 'instagram');
  assert.deepEqual(synced.types, []);
  assert.deepEqual(selectedTypesFromTypeLines(synced.type_lines), []);
  assert.equal(syncServiceDescriptionWithTypeLines(formatTypeLinesSummary(before), before, synced.type_lines), '');
});

test('select all preserves existing quantity and duration when expanding a package', () => {
  const selected = selectAllDeliverableTypes(true, []);
  const existing = [{type:'boosting', quantity:3, period_months:2}];
  const updated = typeLinesFromSelectedTypes(selected, existing);
  const boost = updated.find(line => line.type === 'boosting');
  assert.equal(boost?.quantity, 3);
  assert.equal(boost?.period_months, 2);
  assert.deepEqual(selectAllDeliverableTypes(false, []), []);
});
