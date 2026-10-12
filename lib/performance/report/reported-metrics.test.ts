import assert from 'node:assert/strict';
import test from 'node:test';
import { metricCoverage, reportedTotal } from './reported-metrics';
import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
test('forecasts never inflate reported delivery; unavailable is distinct from zero',()=>{
 const rows=[{reach:1000000,reach_source:'forecast',views:18212},{reach:null,reach_source:'actual',views:null},{reach:0,reach_source:'manual',views:0}] as CampaignPublicationRow[];
 assert.deepEqual(metricCoverage(rows,'reach'),{total:0,available:1,missing:2});
 assert.deepEqual(metricCoverage(rows,'views'),{total:18212,available:2,missing:1});
 assert.equal(reportedTotal(rows.slice(0,2),'reach'),'Unavailable');
});

test('play counts and view counts have distinct client labels', async () => {
 const {playTotalLabel,playMetricLabel} = await import('./reported-metrics');
 const rows = [{platform:'instagram',views:18259},{platform:'tiktok',views:1027}] as CampaignPublicationRow[];
 assert.equal(playTotalLabel(rows),'Video Play Count');
 assert.equal(playMetricLabel({platform:'youtube'}),'Views');
 assert.equal(playTotalLabel([...rows,{platform:'youtube',views:141} as CampaignPublicationRow]),'Video Plays & Views');
});

test('reports preserve independent source counters without adding them together', async()=>{
 const {videoCounters,videoMetricTotals}=await import('./reported-metrics');
 const {extractVideoCounters}=await import('../metrics-collector/video-counters');
 const pair=extractVideoCounters('instagram',{videoPlayCount:18000,videoViewCount:23000});
 assert.deepEqual(pair,{plays:18000,views:23000});
 const row={platform:'instagram',views:18000,report_video_counters:pair} as CampaignPublicationRow;
 assert.deepEqual(videoCounters(row),pair);
 assert.deepEqual(videoMetricTotals([row]).map(m=>m.label),['Video Play Count','Views']);
 assert.deepEqual(extractVideoCounters('tiktok',{playCount:0}),{plays:0,views:null});
});
