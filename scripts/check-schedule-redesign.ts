import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { renderScheduleReport, orderedScheduleRows, paginateSchedule } from '../features/client-workspace/review-schedule-report';
import { renderHtmlToPdf } from '../lib/io/vendor-io-pdf';
import type { ScheduleData } from '../features/client-workspace/review-schedule-model';
async function main(){
 mkdirSync('artifacts/schedule-redesign',{recursive:true});
 for(const sample of ['hardees','stress']){
  const src=JSON.parse(readFileSync(`features/client-workspace/sample-${sample}.json`,'utf8'));
  const data:ScheduleData={campaignId:'sample',name:src.campaign.name,client_name:src.campaign.client,start_date:src.campaign.start,end_date:src.campaign.end,identityLogo:{url:'',alt:src.campaign.agency,source:'group'},rows:src.deliverables.map((r:any,i:number)=>({id:String(i),creator_name:r.creator,handle:r.creator,content_type:`${r.type} · ${r.items}`,ref:r.ref||'—',status:r.status==='needs_decision'?'ready_for_approval':r.status,owner:r.status==='needs_decision'?'client':'creator',has_script:r.script_on_file,expected_review_date:r.expected_review,action_label:r.action||'—',post:{},content:r.delivery?{uploadedAt:r.delivery}:null}))};
  const html=renderScheduleReport(data,src.campaign.snapshot),base=`artifacts/schedule-redesign/${sample}`;
  writeFileSync(base+'.html',html);
  const result=await renderHtmlToPdf(html,{format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});
  if(!result.ok)throw new Error(JSON.stringify(result));
  writeFileSync(base+'.pdf',result.buffer);
  console.log(sample, paginateSchedule(orderedScheduleRows(data.rows)).length,'pages');
 }
}
main();
