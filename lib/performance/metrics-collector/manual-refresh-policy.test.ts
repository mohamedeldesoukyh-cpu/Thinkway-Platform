import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCollectedMetrics,sanitizeMetricValue} from './merge-metrics';
import {computeReachForecast} from '../reach-forecast-engine';
import {videoCounters,videoMetricTotals} from '../report/reported-metrics';
import type {CampaignPublicationRow} from '@/lib/domains/campaign/types';
test('manual blank clears every entered metric, including reach and impressions',()=>{
 const merged=mergeCollectedMetrics({views:100,likes:10,comments:2,shares:4,saves:1,reach:80,impressions:120},
 {views:null,plays:null,likes:null,comments:null,shares:null,saves:null,reach:null,impressions:null},
 {metrics_source:'manual',platform:'instagram',publication_type:'ig_reel',reach_source:'actual',stored_actual_reach:80,impressions_source:'actual',stored_actual_impressions:120});
 for(const k of ['views','plays','likes','comments','shares','saves','reach','impressions'] as const) assert.equal(merged[k],null,k);
 assert.equal(merged.reach_source,'manual');assert.equal(merged.impressions_source,'manual');
});
test('missing provider values retain manual numbers and manual blanks; actual zero replaces',()=>{
 const context={metrics_source:'apify' as const,reach_source:'manual' as const,stored_reach:null,impressions_source:'manual' as const,stored_impressions:null};
 const merged=mergeCollectedMetrics({views:100,likes:10,comments:2},{views:null,likes:0},context);
 assert.equal(merged.views,100);assert.equal(merged.likes,0);assert.equal(merged.comments,2);
 assert.equal(merged.reach,null);assert.equal(merged.impressions,null);
 assert.equal(mergeCollectedMetrics(merged,{reach:50,impressions:70},context).reach,50);
 assert.equal(sanitizeMetricValue(''),null);
});
test('TikTok legacy and new counters appear once as views, including zero',()=>{
 for(const data of [{views:128000},{report_video_counters:{plays:128000,views:null}},{report_video_counters:{plays:128000,views:128000}}]){
 const row={platform:'tiktok',...data} as CampaignPublicationRow;
 assert.deepEqual(videoCounters(row),{plays:null,views:128000});
 assert.deepEqual(videoMetricTotals([row]).map(x=>x.label),['Views']);
 }
});
test('delivery forecasts require views, never estimate stories, and do not depend on followers',()=>{
 for(const followers of [100,10000000]){
 assert.equal(computeReachForecast({followers,views:1000,likes:50}).forecastReach,800);
 assert.equal(computeReachForecast({followers,views:1000,likes:900}).forecastReach,900);
 assert.equal(computeReachForecast({followers,views:1000,publication_type:'ig_story'}).forecastReach,null);
 assert.equal(computeReachForecast({followers,likes:50}).forecastReach,null);
 assert.equal(computeReachForecast({followers,views:0}).forecastReach,null);
 }
});
