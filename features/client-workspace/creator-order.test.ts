import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderWorkspaceCreators } from './creator-order';
import type { ClientCreatorCard } from './types';
const card = (creatorId: string, tier: string, followers: number, accounts: number[] = []): ClientCreatorCard => ({creatorId, displayName: creatorId, tier, followers, platformAccounts: accounts.map(followers => ({platform:'instagram',followers})), selection:'pending' as ClientCreatorCard['selection'], contentExamples:[]});
test('workspace matches report tier and strongest-audience ordering without mutating cards',()=>{
 const rows=[card('nano','Nano',500),card('macro-low','Macro',200000),card('mega','Mega',2000000),card('macro-high','Macro',800000),card('micro','Micro',15000),card('mid','Mid',70000),card('unknown','Unknown',0)];
 const original=[...rows];
 const sorted=orderWorkspaceCreators(rows);
 assert.deepEqual(sorted.map(c=>c.creatorId),['mega','macro-high','macro-low','mid','micro','nano','unknown']);
 assert.deepEqual(rows,original);
 assert.ok(sorted.every(c=>rows.includes(c)));
});
test('platform audience overrides stored tier, exact ties retain source order',()=>{
 const rows=[card('first','Nano',100,[800000]),card('second','Celebrity',200,[800000]),card('third','Macro',900000,[20000])];
 assert.deepEqual(orderWorkspaceCreators(rows).map(c=>c.creatorId),['first','second','third']);
 assert.deepEqual(orderWorkspaceCreators([]),[]);
});
