"use client";
import {useState} from 'react';
import type {ImportRow,RateInput} from './model';
import {taxonomyLabel,textFor,type Language,type Label} from './labels';
import {packageDescription} from './packages';
import {periodLabel} from '@/lib/quotations/commercial-period';
import {ImportRowDiagnostics} from './import-row-diagnostics';
const platformMarks:Record<string,string>={instagram:'IG',tiktok:'TT',facebook:'FB',youtube:'YT',snapchat:'SC',twitter:'X',linkedin:'LI',all:'All'};
export function UploadReviewRow({row,lang}:{row:ImportRow;lang:Language}){
 const [expanded,setExpanded]=useState(false),ar=lang==='ar';
 const rates=row.rates??(row.rate?[row.rate]:[]);
 const main=row.rate?.deliverable;
 const cost=rates.find(r=>r.deliverable===main&&r.price_type==='creator_cost');
 const price=rates.find(r=>r.deliverable===main&&r.price_type==='client_price');
 const extras=rates.filter(r=>r.deliverable!==main);
 const name=row.rate?.creator_name||row.conflicts?.map(c=>c.name).join(' / ')||'—';
 const initials=name.split(/[\s_]+/).filter(Boolean).slice(0,2).map(s=>Array.from(s)[0]).join('').toUpperCase();
 const platforms=[...new Set(row.rate?.package_details?.profiles.map(p=>p.platform)??(row.rate?[row.rate.platform]:[]))];
 const description=row.rate?.package_details?`${row.rate.package_details.name}: ${packageDescription(row.rate.package_details,lang)}`:taxonomyLabel(main??'',lang)||'—';
 const money=(rate:RateInput|undefined)=>rate?<span className="amt"><b>{rate.amount.toLocaleString('en-US',{maximumFractionDigits:4})}</b><u>{rate.currency}{rate.deliverable==='event_attendance'?` / ${ar?'يوم':'day'} × ${rate.event_days??1}`:rate.period_months?` / ${textFor(lang,'monthly')} × ${periodLabel(rate.period_months,lang)}`:''}</u></span>:<span className="na">{ar?'غير مسعّر':'Not priced'}</span>;
 return <><tr className={row.status==='warning'?'wrn':row.status==='error'||row.status==='unmatched'?'bad':''}>
 <td className="rn">{row.row}</td><td><span className="ru-creator"><span className={'ru-avatar k'+(row.row%4)} aria-hidden="true">{initials}</span><span title={name}><b>{name}</b></span></span></td>
 <td><span className="ru-platforms">{platforms.map(p=><span key={p} className={'ru-mark '+p} title={taxonomyLabel(p,lang)} aria-label={taxonomyLabel(p,lang)}>{platformMarks[p]??p.slice(0,2).toUpperCase()}</span>)}</span></td>
 <td><span className="ru-deliverable" title={description}>{row.rate?.package_details?.name||description}</span>{extras.length>0&&<button className="ru-breakdown-trigger" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{ar?'تفاصيل الأسعار':'Pricing details'} {expanded?'▴':'▾'}</button>}</td>
 <td className="num">{money(cost)}</td><td className="num">{money(price)}</td><td className="num"><b className={row.gp_percent==null?'na':'gp'}>{row.gp_percent==null?'—':row.gp_percent.toFixed(2)+'%'}</b></td><td className="num">{row.markup_percent==null?'—':row.markup_percent.toFixed(2)+'%'}</td><td className="num">{row.rate?.agency_fee_percent==null?'—':row.rate.agency_fee_percent+'%'}</td>
 <td><span className={'ru-status '+row.status}>{textFor(lang,row.status==='ready'?'ready':row.status==='warning'?'warning':row.status==='error'?'errors':'unmatchedGroup')}</span>{row.diagnostics?.length?<ImportRowDiagnostics diagnostics={row.diagnostics} lang={lang}/>:null}{row.issues.filter(i=>!row.diagnostics?.length||i==='name_warning').map((issue,i)=><p key={i}>{issue==='invalidPackage'?(ar?'راجع رمز الباقة والروابط والكميات والأسعار.':'Check package code, profile links, quantities and prices.'):textFor(lang,issue==='duplicate'?'duplicateError':issue==='currency'?'currencyError':issue as Label)}</p>)}</td></tr>
 {expanded&&<tr className="ru-breakdown"><td colSpan={10}><strong>{description}</strong><div className="ru-breakdown-grid">{rates.map((r,i)=><div key={i}><span>{taxonomyLabel(r.deliverable,lang)} · {textFor(lang,r.price_type==='creator_cost'?'creator_cost':'client_price')}</span>{money(r)}</div>)}</div></td></tr>}
 </>;
}
