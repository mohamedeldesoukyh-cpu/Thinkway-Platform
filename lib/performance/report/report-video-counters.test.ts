import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { attachReportVideoCounters } from './report-video-counters';
import { videoCounters } from './reported-metrics';

function client(logs: Record<string, unknown>) {
  let provider = '';
  const query = {
    select() { return this; },
    eq(key: string, value: string) { if (key === 'provider') provider = value; return this; },
    order() { return this; }, limit() { return this; },
    async maybeSingle() { return { data: logs[provider] ?? null, error: null }; },
  };
  return { from: () => query } as unknown as SupabaseClient;
}
const row = {id:'p',campaign_header_id:'c',platform:'instagram',views:18000,plays:18000} as CampaignPublicationRow;
const logs = {
  apify: {metrics_snapshot:{views:18000},response_summary:{videoCounters:{plays:18000,views:23000}}},
  manual: {metrics_snapshot:{views:18000},response_summary:{videoCounters:{plays:18000,views:30000}}},
};
test('manual counter pair wins over an identical older automatic play snapshot', async () => {
  const [result] = await attachReportVideoCounters(client(logs),[{...row,metrics_provider:'manual'}]);
  assert.deepEqual(videoCounters(result),{plays:18000,views:30000});
});
test('restoring automatic metrics selects provider counters instead of manual overrides', async () => {
  const [result] = await attachReportVideoCounters(client(logs),[{...row,metrics_provider:'apify'}]);
  assert.deepEqual(videoCounters(result),{plays:18000,views:23000});
});
test('missing views stay missing and zero plays stay zero', async () => {
  const [result] = await attachReportVideoCounters(client({manual:{metrics_snapshot:{views:0},response_summary:{videoCounters:{plays:0,views:null}}}}),[{...row,views:0,metrics_provider:'manual'}]);
  assert.deepEqual(videoCounters(result),{plays:0,views:null});
});
test('stale snapshots cannot overwrite current counters', async () => {
  const [result] = await attachReportVideoCounters(client(logs),[{...row,views:19000,plays:19000}]);
  assert.deepEqual(videoCounters(result),{plays:19000,views:null});
});
