import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderScheduleReport, orderedScheduleRows, paginateSchedule } from './review-schedule-report';
import type { ScheduleData, ScheduleStatus } from './review-schedule-model';
function sample(name: string): ScheduleData {
 const source=JSON.parse(readFileSync(`features/client-workspace/sample-${name}.json`,'utf8'));
 return {campaignId:'fixture',name:source.campaign.name,client_name:source.campaign.client,start_date:source.campaign.start,end_date:source.campaign.end,identityLogo:{url:'data:image/png;base64,abc',alt:'Group identity',source:'group'},rows:source.deliverables.map((r: any,i: number)=>({id:String(i),creator_name:r.creator,handle:r.creator,content_type:`${r.type} · ${r.items}`,ref:r.ref||'—',status:(r.status==='needs_decision'?'ready_for_approval':r.status) as ScheduleStatus,owner:r.status==='needs_decision'?'client':'creator',has_script:r.script_on_file,expected_review_date:r.expected_review,action_label:r.action||'—',post:{},content:r.delivery?{uploadedAt:r.delivery}:null}))};
}
test('handoff fixtures retain every row and fit one and two pages',()=>{
 for(const [name,count] of [['hardees',1],['stress',2]] as const){const data=sample(name),rows=orderedScheduleRows(data.rows);assert.equal(paginateSchedule(rows).length,count);const html=renderScheduleReport(data,'2026-10-25');assert.equal((html.match(/data-review-row=/g)||[]).length,data.rows.length);assert.equal((html.match(/class="page"/g)||[]).length,count);assert.match(html,/font\/woff2;base64/);assert.match(html,/alt="Group identity"/);}
});
test('undated rows are last and labelled clearly, delivery fallback retained',()=>{
 const data=sample('stress'),rows=orderedScheduleRows(data.rows),html=renderScheduleReport(data,'2026-10-25');
 assert.equal(rows.at(-1)?.expected_review_date,null);assert.match(html,/To be<br>confirmed/);assert.match(html,/Expected review: To be confirmed · delivery date shown/);
 assert.equal(rows.filter(r=>r.owner==='client').length,2);assert.match(html,/wi-client/);assert.ok(data.rows.filter(r=>r.action_label!=="—").every(r=>html.includes(r.action_label)));
});
test('empty schedule and client logo fallback render without dropping report controls',()=>{
 const data={...sample('hardees'),rows:[],identityLogo:{url:'data:image/png;base64,abc',alt:'Client identity',source:'client' as const}};
 const html=renderScheduleReport(data,'2026-10-25');assert.match(html,/No deliverables scheduled yet/);assert.match(html,/alt="Client identity"/);assert.equal((html.match(/class="page"/g)||[]).length,1);
});
