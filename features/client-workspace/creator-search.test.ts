import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesWorkspaceCreatorSearch } from './creator-search';
import type { ClientCreatorCard } from './types';
const creator = {
  creatorId: 'synthetic-a', displayName: 'علي سخر', handle: '@Aly', country: 'EG',
  categories: ['Fitness'], quotationOptions: [
    { itemId: 'a', optionNumber: 1, serviceDescription: 'IG Reel + Mirrored TT', investmentAmount: 100 },
    { itemId: 'b', optionNumber: 2, deliverables: 'Boosting · one month', investmentAmount: 20 },
  ],
} as ClientCreatorCard;
test('search matches names, handles, categories and all options without changing their values', () => {
  const before = JSON.stringify(creator);
  for (const query of ['', '   ', 'علي', '@ALY', 'fitness', 'reel tt', 'boosting month']) {
    assert.equal(matchesWorkspaceCreatorSearch(creator, query), true, query);
  }
  assert.equal(matchesWorkspaceCreatorSearch(creator, 'another client'), false);
  assert.equal(JSON.stringify(creator), before);
});
test('filtering keeps source order and never introduces creators outside the supplied roster', () => {
  const second = { ...creator, creatorId: 'synthetic-b', displayName: 'Second' };
  const roster = [second, creator];
  assert.deepEqual(roster.filter(c => matchesWorkspaceCreatorSearch(c, 'Reel')).map(c => c.creatorId), ['synthetic-b', 'synthetic-a']);
  assert.deepEqual(roster.filter(c => matchesWorkspaceCreatorSearch(c, 'علي')).map(c => c.creatorId), ['synthetic-a']);
});
test('missing optional fields are searchable without manufacturing values', () => {
  assert.equal(matchesWorkspaceCreatorSearch({ creatorId:'empty' } as ClientCreatorCard, 'missing'), false);
  assert.equal(matchesWorkspaceCreatorSearch({ creatorId:'empty' } as ClientCreatorCard, ''), true);
});
