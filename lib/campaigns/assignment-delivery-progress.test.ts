import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignmentDeliveryProgress } from './assignment-delivery-progress';

const line = (id: string, assignment_status = 'invoiced', went_live_date: string | null = null) => ({ id, assignment_status, went_live_date });
const post = (workflow_status: string, live_date: string | null = null) => ({ workflow_status, live_date });
const group = (entry: ReturnType<typeof line>, statuses: string[], quantity = statuses.length) => ({
  line: entry,
  deliverables: [{ ...post('verified'), quantity, posts: statuses.map(status => post(status)) }],
});

test('invoicing, payment and closure without delivery evidence never complete a campaign', () => {
  const result = assignmentDeliveryProgress(['invoiced', 'paid', 'closed'].map(status => line(status, status)), []);
  assert.equal(result.progressPercent, 0);
  assert.equal(result.completionPercent, 0);
});
test('Fresh-shaped campaign: five actual live assignments out of seven, none verified', () => {
  const lines = Array.from({ length: 7 }, (_, i) => line(String(i), 'invoiced', i < 5 ? '2026-11-18' : null));
  const result = assignmentDeliveryProgress(lines, lines.map(l => group(l, ['draft', 'draft', 'draft'])));
  assert.equal(result.progressPercent, 71);
  assert.equal(result.completionPercent, 0);
});
test('one verified post does not complete a multi-post assignment or trust its rollup', () => {
  const entry = line('a', 'verified');
  assert.equal(assignmentDeliveryProgress([entry], [group(entry, ['verified', 'draft'])]).completionPercent, 0);
  assert.equal(assignmentDeliveryProgress([entry], [group(entry, ['verified'], 2)]).completionPercent, 0);
  assert.equal(assignmentDeliveryProgress([entry], [group(entry, ['verified', 'verified'])]).completionPercent, 100);
});
test('actual post dates and explicit posted status count as live, not verified', () => {
  const entry = line('a');
  const data = group(entry, ['draft']);
  data.deliverables[0].posts[0].live_date = '2026-11-18';
  assert.equal(assignmentDeliveryProgress([entry], [data]).progressPercent, 100);
  assert.equal(assignmentDeliveryProgress([entry], [data]).completionPercent, 0);
  assert.equal(assignmentDeliveryProgress([entry], [group(entry, ['posted'])]).progressPercent, 100);
});
test('empty and incomplete large campaigns cannot appear complete through rounding', () => {
  assert.equal(assignmentDeliveryProgress([], []).completionPercent, 0);
  const lines = Array.from({ length: 201 }, (_, i) => line(String(i), i === 200 ? 'invoiced' : 'verified'));
  assert.equal(assignmentDeliveryProgress(lines, []).completionPercent, 99);
});
