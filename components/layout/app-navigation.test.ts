import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NAV_SECTIONS, DAILY_NAV_ITEMS, activeNavigationHref } from './app-navigation';

test('nested routes use the most specific destination', () => {
  assert.equal(activeNavigationHref('/operations/move'), '/operations/move');
  assert.equal(activeNavigationHref('/operations/reassignment/123'), '/operations/reassignment');
  assert.equal(activeNavigationHref('/campaigns/123/deliverables'), '/campaigns');
  assert.equal(activeNavigationHref('/'), '/');
  assert.equal(activeNavigationHref('/campaigns-other'), undefined);
});
test('pins retain one canonical home and Finance retains all subgroups', () => {
  const items = NAV_SECTIONS.flatMap(section => section.items);
  assert.equal(new Set(items.map(item => item.href)).size, items.length);
  for (const pin of DAILY_NAV_ITEMS) assert.equal(items.filter(item => item.href === pin.href).length, 1);
  assert.deepEqual(NAV_SECTIONS.filter(section => section.subgroup).map(section => section.subgroup), ['Billing & documents', 'Treasury & cash', 'Compliance & planning']);
});
