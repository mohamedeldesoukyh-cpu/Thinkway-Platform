import { SCHEDULE_CSS, SCHEDULE_LOGO } from './review-schedule-report-assets';
import { scheduleCalendarDate, scheduleDate, scheduleFinding, scheduleNeedsDecision, SCHEDULE_STATES, type ScheduleData, type ScheduleRow } from './review-schedule-model';
const e = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const day = (s: string) => new Date(`${s}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0,10);
const fmt = (s: string, options: Intl.DateTimeFormatOptions) => day(s).toLocaleDateString('en-GB', {...options,timeZone:'UTC'});
export function scheduleChips(text: string) {
  return text.replace(/^Package(?: \d+)?\s*·\s*/i,'').split('+').filter(s=>s.trim()).map(part=>{
    const label=part.trim().replaceAll('_',' ').replace(/Instagram/gi,'IG').replace(/TikTok/gi,'TT').replace(/usage rights?/gi,'Usage rights').replace(/mirrored tt/gi,'Mirrored TT').replace(/mirrored fb/gi,'Mirrored FB').replace(/mirrored yt/gi,'Mirrored YT').replace(/boosting/gi,'Boosting').replace(/ig reel/gi,'IG Reel').replace(/ig story/gi,'IG Story');
    const key=label.toLowerCase();
    const kind=/\big\b|reel|story/.test(key)?'ig':/\btt\b/.test(key)?'tt':/\bfb\b|\byt\b|facebook|youtube/.test(key)?'ot':'ex';
    return {label,kind};
  }).sort((a,b)=>['ig','tt','ot','ex'].indexOf(a.kind)-['ig','tt','ot','ex'].indexOf(b.kind));
}
export function orderedScheduleRows(rows: ScheduleRow[]) {
  return [...rows].sort((a,b)=>(scheduleCalendarDate(a)||'9999').localeCompare(scheduleCalendarDate(b)||'9999')||a.creator_name.localeCompare(b.creator_name));
}
function rowHeight(r: ScheduleRow) {
  let lines=1,x=0;
  for(const c of scheduleChips(r.content_type)){const w=c.label.length*5.6+18;if(x&&x+w>312){lines++;x=0;}x+=w;}
  return 26+17*(1+Math.floor(r.creator_name.length*7.6/312))+6+16*lines+6+13+2+(!r.expected_review_date&&r.content?.uploadedAt?26:0);
}
export function paginateSchedule(rows: ScheduleRow[], firstTop = 512) {
  const pages: ScheduleRow[][]=[];let current: ScheduleRow[]=[],y=firstTop;
  rows.forEach((r,i)=>{const h=rowHeight(r);if(current.length&&y+h+(i===rows.length-1?110:0)>1073){pages.push(current);current=[];y=118;}current.push(r);y+=h;});
  pages.push(current);return pages;
}
function timeline(data: ScheduleData,date: string,rows: ScheduleRow[]) {
  const dates=rows.map(scheduleCalendarDate).filter((d):d is string=>!!d).sort();
  const start=data.start_date||dates[0]||date,end=data.end_date||dates.at(-1)||start;
  const span=Math.max(1,Math.round((day(end).getTime()-day(start).getTime())/86400000)+1);
  const weeks=span>21,cells:string[]=[];let cursor=day(start);
  if(weeks)cursor.setUTCDate(cursor.getUTCDate()-((cursor.getUTCDay()+6)%7));
  for(let i=0;cursor<=day(end)&&i<520;i++){
    const key=iso(cursor),next=new Date(cursor);next.setUTCDate(next.getUTCDate()+(weeks?7:1));const nextKey=iso(next);
    const n=dates.filter(d=>d>=key&&d<nextKey).length,today=date>=key&&date<nextKey,past=weeks?nextKey<=date:key<date;
    const tag=n?(span>14&&!weeks?String(n):plural(n,'review')):today?'Today':i===0?'Start':'';
    cells.push(`<div class="day${past?' past':''}${n?' rev':''}${today?' today':''}"><i>${weeks?'Wk of':fmt(key,{weekday:'short'})}</i><b>${fmt(key,weeks?{day:'numeric',month:'short'}:{day:'numeric'})}</b>${tag?`<span class="tag">${tag}</span>`:''}</div>`);cursor=next;
  }
  const next=rows.find(r=>{const d=scheduleCalendarDate(r);return d&&d>=date&&r.status!=='approved';});
  return `<div class="card tl"><div class="tl-head"><span class="k">Review timeline</span><span class="tl-sub">${scheduleDate(start)} – ${scheduleDate(end)}</span></div><div class="strip${weeks?' strip--weeks':''}" style="grid-template-columns:repeat(${Math.min(cells.length,21)},minmax(0,1fr))">${cells.join('')}</div><div class="tl-foot"><span><b>Next review</b> ${next?`${e(next.creator_name)} · ${scheduleDate(scheduleCalendarDate(next))}`:'No upcoming reviews'}</span><span class="lgd"><i class="sw sw-rev"></i>Review day<i class="sw sw-today"></i>Today<i class="sw sw-past"></i>Past</span></div></div><div class="note">ⓘ <span>${e(scheduleFinding(rows))}</span></div>`;
}
const th='<div class="tr th"><span>Review</span><span>Creator &amp; deliverables</span><span>Status</span><span>With</span><span>Script</span><span>Action</span></div>';
function rowHtml(r: ScheduleRow, all: ScheduleRow[]) {
  const when=scheduleCalendarDate(r),mine=all.filter(x=>x.handle===r.handle),cls=scheduleNeedsDecision(r)?'st-decide':r.status==='approved'?'st-approved':r.status==='changes_requested'?'st-changes':'st-await';
  const sub=`${/^Package/.test(r.content_type)?'Package':'Content'}${r.ref&&r.ref!=='—'?` · ${r.ref}`:''} · ${plural(mine.length,'deliverable')} · ${mine.filter(scheduleNeedsDecision).length} need your decision · ${plural(mine.filter(x=>x.has_script).length,'script')} on file`;
  const dateBlock=when?`<i>${fmt(when,{weekday:'short'})}</i><b>${fmt(when,{day:'numeric'})}</b><span>${fmt(when,{month:'short'})}</span>`:'<span class="tbc">To be<br>confirmed</span>';
  return `<div class="tr row" data-review-row="${e(r.id)}"><div class="date">${dateBlock}</div><div class="who"><b>${e(r.creator_name)}</b><div class="chips">${scheduleChips(r.content_type).map(c=>`<span class="ch ch-${c.kind}">${e(c.label)}</span>`).join('')}</div><span class="sub">${e(sub)}</span>${!r.expected_review_date&&when?'<span class="sub">Expected review: To be confirmed · delivery date shown</span>':''}</div><div class="cell"><span class="pill ${cls}">${SCHEDULE_STATES[r.status].label}</span></div><div class="cell"><span class="pill wi-${r.owner}">${r.owner==='client'?'Client':'Creator'}</span></div><div class="cell">${r.has_script?'Yes':'No'}</div><div class="cell action">${e(r.action_label||'—')}</div></div>`;
}
export function renderScheduleReport(data: ScheduleData,date: string) {
  const rows=orderedScheduleRows(data.rows);
  const knownDates=rows.map(scheduleCalendarDate).filter((d):d is string=>!!d).sort();
  const rangeStart=data.start_date||knownDates[0]||date,rangeEnd=data.end_date||knownDates.at(-1)||rangeStart;
  const weekCells=Math.ceil(((day(rangeEnd).getTime()-day(rangeStart).getTime())/86400000+7)/7);
  const extraTimelineHeight=Math.max(0,Math.ceil(weekCells/21)-1)*70;
  const pages=paginateSchedule(rows,512+extraTimelineHeight),decisions=rows.filter(scheduleNeedsDecision).length,confirmed=rows.filter(r=>r.expected_review_date).length;
  const identity=data.identityLogo;
  const logo=identity?.url&&/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(identity.url)?`<img class="agency-logo" src="${e(identity.url)}" alt="${e(identity.alt)}">`:identity?.alt?`<span class="agency">${e(identity.alt)}</span>`:'';
  const brands=`<div class="brands"><img class="logo" src="${SCHEDULE_LOGO}" alt="Thinkway">${logo?`<span class="bsep"></span>${logo}`:''}</div>`;
  const sums=[['Needs your decision',decisions,decisions?'Waiting on your review':'Nothing waiting on you'],['With creators',rows.length-decisions,'Includes completed work'],['Total deliverables',rows.length,`Across ${plural(new Set(rows.map(r=>r.handle)).size,'creator')}`],['Confirmed dates',`${confirmed} / ${rows.length}`,confirmed===rows.length?'All review dates set':`${plural(rows.length-confirmed,'date')} to confirm`]];
  const top=`<header class="top">${brands}<div class="top-r"><span class="k">Creator content review</span><span class="copy">Client copy</span></div></header><div class="hero"><div class="hero-l"><span class="k" style="color:#ff7cc4">${e(data.name)}</span><h1>Content review schedule</h1><span class="client">${e(data.client_name)}</span></div><div class="hero-r"><span>Campaign ${scheduleDate(data.start_date)} – ${scheduleDate(data.end_date)}</span><span>Snapshot ${scheduleDate(date)}</span></div></div><div class="kpis">${sums.map(([label,n,help],i)=>`<div class="kpi"><span class="k">${label}</span><b${i===3||(i===0&&decisions)?' class="pk"':''}>${n}</b><span class="h">${help}</span></div>`).join('')}</div>`;
  const close=`<div class="key"><span class="k">Status key</span>${Object.entries(SCHEDULE_STATES).map(([key,info])=>`<span class="pill ${key==='approved'?'st-approved':key==='changes_requested'?'st-changes':key==='awaiting_content'?'st-await':'st-decide'}">${info.label}</span>`).join('')}</div><p class="fine">Expected dates are for client review, not publication. Script availability is independent of status: a script on file does not necessarily need a decision. All statuses, including Approved and Changes requested, are included. “With” assigns pending decisions to Client and other rows to Creator; Approved is completed work.<br>Open the client workspace to view scripts and content. This report is a snapshot of the schedule on ${scheduleDate(date)}.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(data.name)} — Content review schedule</title><style>${SCHEDULE_CSS}
.agency-logo{max-width:120px;object-fit:contain;background:white;border-radius:3px;padding:2px}.hero h1{font-size:30px}.hero-r{font-size:9px}.cell.action{white-space:normal;font-size:9px;overflow-wrap:anywhere}.date .tbc{text-transform:none;font-size:8px;line-height:1.4;letter-spacing:0;text-align:center}.tr .pill{font-size:8px;letter-spacing:0;padding:4px 6px}.tl-foot>span:first-child{min-width:0;overflow-wrap:anywhere}.lgd{flex:none}.ch{max-width:100%;white-space:normal;overflow-wrap:anywhere}.foot>span:first-child{max-width:75%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
</style></head><body>${pages.map((chunk,i)=>`<section class="page">${i===0?top+timeline(data,date,rows):`<header class="top top--compact">${brands}<span class="ctitle">Content review schedule<span>${e(data.name)} · continued</span></span></header>`}<div class="card tbl${i?' tbl--cont':''}">${th}${chunk.length?chunk.map(r=>rowHtml(r,rows)).join(''):'<div class="empty">No deliverables scheduled yet.</div>'}</div>${i===pages.length-1?close:''}<footer class="foot"><span>${e(data.name)}</span><s></s><span>${i+1} / ${pages.length}</span></footer></section>`).join('')}</body></html>`;
}
