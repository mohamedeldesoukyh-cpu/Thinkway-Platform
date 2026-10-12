import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorHighlightPages, renderCreatorHighlights } from './creator-highlights';
import type { PerformanceReportDocumentData, InfluencerReportSection } from './performance-report-types';
function creator(name:string, engagements:number, views:number, rate:number): InfluencerReportSection {
 return {name,influencerId:name,summary:{engagements,views,averageEr:rate,agreedPublications:3,addedValuePublications:0},publications:[{views,engagement_rate:rate,engagement_rate_method:'views',total_engagements:engagements,platform_label:'YouTube'}]} as InfluencerReportSection;
}
function data(creators:InfluencerReportSection[]){return {influencerSections:creators,bundle:{publications:creators.flatMap(c=>c.publications)}} as PerformanceReportDocumentData;}
test('all creators appear even when one wins every category; rate includes sample size',()=>{
 const d=data([creator('Tareq',8,141,5.7),creator('Zidan',3,100,3)]);const html=renderCreatorHighlights(d,creatorHighlightPages(d)[0]);
 assert.match(html,/Tareq/);assert.match(html,/Zidan/);assert.match(html,/8 interactions \/ 141 views/);
 assert.equal((html.match(/Top engagements/g)||[]).length,1);
 assert.equal((html.match(/Highest post ER/g)||[]).length,1);
});
test('pagination includes every creator once and never exceeds four per page',()=>{
 const d=data(Array.from({length:11},(_,i)=>creator('Creator '+i,i,100,i)));
 const pages=creatorHighlightPages(d);assert.deepEqual(pages.map(p=>p.length),[4,4,3]);assert.equal(new Set(pages.flat().map(c=>c.influencerId)).size,11);
});
test('missing rate does not invent a winner or denominator',()=>{
 const c=creator('<Creator>',0,0,0);c.publications=[];const html=renderCreatorHighlights(data([c]),[c]);
 assert.match(html,/&lt;Creator&gt;/);assert.match(html,/No engagement rate available/);assert.doesNotMatch(html,/Highest post ER/);
});

test('each counter shows its own platform sources without mixing views and plays',()=>{
 const c=creator('Mixed',10,0,1);
 c.publications=[
  {...c.publications[0],platform:'instagram',report_video_counters:{plays:100,views:200}},
  {...c.publications[0],platform:'tiktok',report_video_counters:{plays:50,views:null}},
 ];
 const html=renderCreatorHighlights(data([c]),[c]);
 assert.match(html,/Instagram · 100/);assert.match(html,/TikTok · 50/);
 assert.match(html,/Instagram · 200/);assert.match(html,/alt="TikTok"/);
 assert.equal((html.match(/TikTok · 50/g)||[]).length,1);
});
