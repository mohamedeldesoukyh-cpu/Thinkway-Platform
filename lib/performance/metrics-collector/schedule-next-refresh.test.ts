import assert from 'node:assert/strict';
import test from 'node:test';
import { isRefreshDue } from './schedule-next-refresh';
test('failed or finished rows without a retry deadline are not scraped every hour',()=>{
 for(const status of ['failed','completed','partial','manual_required']) assert.equal(isRefreshDue(null,status),false);
 assert.equal(isRefreshDue(null,'pending'),true);
 assert.equal(isRefreshDue(null,'queued'),true);
});
test('scheduled retries respect their deadline and active collection',()=>{
 assert.equal(isRefreshDue(new Date(Date.now()-10000).toISOString(),'failed'),true);
 assert.equal(isRefreshDue(new Date(Date.now()+60000).toISOString(),'failed'),false);
 assert.equal(isRefreshDue(new Date(Date.now()-10000).toISOString(),'collecting'),false);
});
