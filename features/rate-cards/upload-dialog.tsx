"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Upload,FileSpreadsheet,X,Check,AlertTriangle,ArrowLeft} from 'lucide-react';
import * as actions from './actions';
import {useRateLanguage} from './ui';
import {errorLabel,taxonomyLabel,type Label} from './labels';
import {uploadLabels,type UploadLabel} from './upload-labels';
import {uploadForPreview,type UploadProgress} from './upload-client';
import {RATE_UPLOAD_MAX_BYTES} from './upload-limits';
import {uploadBlocker,uploadReview} from './upload-review';
import type {ImportRow,RateInput,RateVersion} from './model';
import {packageDescription} from './packages';
import {periodLabel} from '@/lib/quotations/commercial-period';
import {ImportRowDiagnostics} from './import-row-diagnostics';
import {ImportConflicts} from './import-conflicts';
import {EnrichmentProgress} from './enrichment-progress';
import './upload-dialog.css';

type Created={id:string;name:string;created:boolean;queued:boolean;pollId?:string;enrichmentRequested?:boolean};
const stages=['uploading','validating','matching','creating','importing','completed'] as const;
const stageLabels=['sgUp','sgVal','sgMatch','sgProf','sgRates','sgDone'] as const;
export function UploadDialog({version,onClose,onDone}:{version:RateVersion;onClose:()=>void;onDone:(id:string)=>void}){
 const {lang,t,change}=useRateLanguage(), ar=lang==='ar';
 const tr=(key:UploadLabel)=>uploadLabels[key][lang];
 const [step,setStep]=useState(1),[file,setFile]=useState<File|null>(null),[filename,setFilename]=useState('');
 const [rows,setRows]=useState<ImportRow[]|null>(null),[path,setPath]=useState('');
 const [mode,setMode]=useState<'new'|'update'>('new'),[name,setName]=useState('');
 const [page,setPage]=useState(1),[filter,setFilter]=useState('ready');
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState<UploadProgress|null>(null);
 const [created,setCreated]=useState<Created[]>([]),[imported,setImported]=useState<string|null>(null);
 const [expected,setExpected]=useState(version.updated_at),[stale,setStale]=useState(false);
 const [error,setError]=useState(''),[failed,setFailed]=useState(false),[restored,setRestored]=useState(false);
 const [dragging,setDragging]=useState(false),[draftReady,setDraftReady]=useState(false);
 const lock=useRef(false), mounted=useRef(true), input=useRef<HTMLInputElement>(null), body=useRef<HTMLDivElement>(null);
 const draftKey='thinkway-rate-upload:'+version.id;
 const stats=useMemo(()=>uploadReview(rows??[]),[rows]);
 const enrichment=useMemo(()=>created.filter(c=>c.enrichmentRequested!==false),[created]);
 const visible=(rows??[]).filter(r=>filter==='all'||r.status===filter);
 const blocker=uploadBlocker({busy,step,hasFile:!!(file||path),hasRows:!!rows?.length,errors:stats.counts.error,unmatched:stats.counts.unmatched,conflicts:!!rows?.some(r=>r.conflicts?.length),stale,mode,name});
 const why=blocker?tr(blocker):step===3?tr('whyNothing'):rows?`${stats.rows} ${tr('rowsK')} · ${stats.counts.error} ${tr('errK')} · ${stats.counts.unmatched} ${tr('unmK')}`:'';
 const move=(next:number)=>{setStep(next);body.current?.scrollTo({top:0});};
 const close=()=>{if(!lock.current){if(imported)onDone(imported);else onClose();}};
 function form(){const data=new FormData();if(path)data.set('uploadPath',path);else if(file)data.set('file',file);return data;}
 function acceptRows(data:ImportRow[]){setRows(data);setPage(1);setFilter(data.some(r=>r.status==='ready')?'ready':'all');}
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(e){setError(t(errorLabel(e)));}finally{lock.current=false;if(mounted.current){setBusy(false);setProgress(null);}}}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let active=true;
  let draft:{path?:string;mode?:string;name?:string;filename?:string}|null=null;
  try{draft=JSON.parse(localStorage.getItem(draftKey)||'null');}catch{/* An invalid draft is ignored. */}
  if(!draft?.path){setDraftReady(true);return;}
  const saved=draft;setPath(saved.path!);setMode(saved.mode==='update'?'update':'new');setName(saved.name??'');setFilename(saved.filename??'');setRestored(true);
  lock.current=true;setBusy(true);setProgress({stage:'validating',processed:0,total:0});
  void (async()=>{try{
   const current=await actions.getRateVersion(version.id);
   const data=new FormData();data.set('uploadPath',saved.path!);
   const preview=await actions.previewRateImport(data);
   if(active){setExpected(current.version.updated_at);acceptRows(preview);move(2);}
  }catch(e){if(active)setError(t(errorLabel(e)));}finally{if(active){lock.current=false;setBusy(false);setProgress(null);setDraftReady(true);}}})();
  return()=>{active=false;};
  // Reopen/revalidate once per version, never on language or draft changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[version.id]);
 useEffect(()=>{if(!draftReady)return;try{if(imported||!path)localStorage.removeItem(draftKey);else localStorage.setItem(draftKey,JSON.stringify({path,mode,name,filename}));}catch{/* Storage can be disabled; the current upload still works. */}},[path,mode,name,filename,imported,draftKey,draftReady]);
 useEffect(()=>{if(!busy)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[busy]);
 async function choose(next:File|undefined){
  if(!next||lock.current)return;
  if(!next.name.toLowerCase().endsWith('.xlsx')||!next.size||next.size>RATE_UPLOAD_MAX_BYTES){setError(t('file'));return;}
  await run(async()=>{if(path)await actions.discardRateUpload(path);setPath('');setFile(next);setFilename(next.name);setRows(null);setCreated([]);setImported(null);setRestored(false);setStale(false);setFailed(false);move(1);});
 }
 async function preview(){await run(async()=>{
  setProgress({stage:'validating',processed:0,total:0});
  const current=await actions.getRateVersion(version.id);
  let data:ImportRow[];
  if(path)data=await actions.previewRateImport(form());
  else {const upload=form();try{data=await uploadForPreview(upload,setProgress);setPath(String(upload.get('uploadPath')??''));}catch(e){const uploaded=String(upload.get('uploadPath')??'');if(uploaded)await actions.discardRateUpload(uploaded).catch(()=>{});throw e;}}
  setExpected(current.version.updated_at);acceptRows(data);setStale(false);setFailed(false);move(2);
 });}
 async function discard(){await run(async()=>{if(path)await actions.discardRateUpload(path);setPath('');setFile(null);setFilename('');setRows(null);setCreated([]);setStale(false);setFailed(false);setRestored(false);move(1);});}
 async function download(kind:'individual'|'package'){await run(async()=>{const b64=await actions.downloadRateTemplate(kind);const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=kind==='package'?'Thinkway-Creator-Packages.xlsx':'Thinkway-Individual-Rates.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
 async function commit(){if(blocker||!rows)return;await run(async()=>{
  try{
   const candidates=rows.filter(r=>r.profile_urls?.length||r.profile_url||r.pending_creator);
   for(let i=0;i<candidates.length;i++){
    setProgress({stage:'creating',processed:i,total:candidates.length});
    const row=candidates[i];const c=await actions.ensureRateImportProfiles(row.profile_urls?.length?row.profile_urls:[row.profile_url||row.pending_creator!.profile_url],row.pending_creator?undefined:row.rate?.creator_ref);
    setCreated(prev=>prev.some(p=>p.id===c.id)?prev.map(p=>p.id===c.id?{...c,created:p.created||c.created}:p):[...prev,c]);
    setProgress({stage:'creating',processed:i+1,total:candidates.length});
   }
   setProgress({stage:'importing',processed:0,total:0});
   const result=await actions.commitRateImport(form(),version.id,mode,mode==='new'?name:version.version,expected);
   if(!result.ok){setError(t(result.error));setStale(result.error==='stale');if(result.error==='stale')move(3);else{setFailed(true);move(4);}return;}
   setImported(result.id);setFailed(false);move(4);
  }catch(e){const code=errorLabel(e);setError(t(code));setStale(code==='stale');if(code==='stale')move(3);else{setFailed(true);move(4);}}
 });}
 const amount=(row:ImportRow,type:'creator_cost'|'client_price')=>{
  const rates=(row.rates??(row.rate?[row.rate]:[])).filter(r=>r.price_type===type);
  return rates.length?rates.map((rate,index)=><div className="amt" key={index}><b>{rate.amount.toLocaleString('en-US',{maximumFractionDigits:4})}</b><u>{rate.currency} · {taxonomyLabel(rate.deliverable,lang)}</u>{rate.deliverable==='event_attendance'?<u>{ar?'يوميًا':'per day'} × {rate.event_days??1} {ar?'أيام':'days'}</u>:!!rate.period_months&&<u>{t('monthly')} × {periodLabel(rate.period_months,lang)}</u>}</div>):<span className="na">{ar?'غير مسعّر':'Not priced'}</span>;
 };
 const metrics=<div className="ru__sum">{([['rowsK',stats.rows],['uniqK',stats.creators],['linesK',stats.lines],['matchedK',stats.matched],['newK',stats.pending]] as const).map(([key,value])=><div className="ru__m" key={key}><u>{tr(key)}</u><b>{value.toLocaleString('en-US')}</b>{key==='linesK'&&<em>{tr('linesS')}</em>}</div>)}</div>;
 const primary=async()=>{if(blocker)return;if(step===1){if(rows)move(2);else await preview();}else if(step===2)move(3);else if(step===3)await commit();};
 return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent showCloseButton={false} className="ru" dir={ar?'rtl':'ltr'} onEscapeKeyDown={e=>{if(lock.current)e.preventDefault();}} onInteractOutside={e=>e.preventDefault()}>
  <header className="ru__h"><div className="ru__ht"><DialogTitle>{tr('title')}</DialogTitle><span className="ru__ctx"><s/>{version.name} · {version.version}</span><span className="ru__sp"/><div className="ru__lang" role="group" aria-label={ar?'اللغة':'Language'}>{(['en','ar'] as const).map(l=><button key={l} disabled={busy} aria-pressed={lang===l} onClick={()=>change(l)}>{l==='en'?'EN':'ع'}</button>)}</div><button className="ru__x" disabled={busy} aria-label={tr('close')} onClick={close}><X size={16}/></button></div><DialogDescription className="sr-only">{t('importHelp')}</DialogDescription>
   <nav className="ru__steps" aria-label={ar?'خطوات الاستيراد':'Import steps'}>{([1,2,3,4] as const).map(s=><button key={s} className={'ru__st'+(s<step?' is-done':'')} aria-current={s===step?'step':undefined} disabled={busy||!!imported||s>step||(step===4&&failed)} onClick={()=>move(s)}><b>{s<step?<Check size={12}/>:s}</b><span>{tr(`s${s}`)}</span></button>)}</nav></header>
  <div className="ru__b" ref={body} aria-busy={busy}>
   {error&&<div className="ru__block" role="alert"><AlertTriangle size={18}/><div><b>{stale?tr('staleT'):error}</b>{stale&&<p>{ar?'تغير الإصدار بعد المعاينة. حدّث وراجع قبل الاستيراد.':'This version changed after your preview. Refresh and review before importing.'}</p>}</div></div>}
   {busy&&progress?<UploadRun progress={progress} tr={tr}/>:<>
   {step===1&&<section className="ru__pane">
    {path&&<div className="ru__save"><span><b>{restored?tr('savedT'):(ar?'الملف محفوظ':'Upload saved')}</b> {tr('savedB')}</span></div>}
    <div className="ru__card"><div className="ru__cardh"><h3>{tr('fileT')}</h3></div><div className="ru__cardb">
     <input ref={input} type="file" accept=".xlsx" className="sr-only" tabIndex={-1} aria-label={tr('fileT')} disabled={busy} onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/>
     {file||path?<div className="ru__file"><i><FileSpreadsheet size={20}/></i><span className="ru__fmeta"><b>{filename||(ar?'ملف Excel محفوظ':'Saved Excel workbook')}</b><u>{file?`${(file.size/1024).toLocaleString('en-US',{maximumFractionDigits:0})} KB`:'XLSX'}{rows?` · ${rows.length} ${tr('rowsK')}`:''}</u></span><button className="ru-btn" disabled={busy} onClick={()=>input.current?.click()}>{tr('replace')}</button></div>:<button className={'ru__dz'+(dragging?' is-over':'')} disabled={busy} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void choose(e.dataTransfer.files[0]);}}><i><Upload size={22}/></i><b>{tr('dzT')}</b><u>{tr('dzB')}</u></button>}
    </div><details className="ru__acc"><summary>{tr('tplT')}</summary><div className="ru__accb ru__tpl">{(['individual','package'] as const).map((kind,i)=><div className="ru__t" key={kind}><FileSpreadsheet size={20}/><div><b>{tr(i?'tpl2':'tpl1')}</b><u>{tr(i?'tpl2b':'tpl1b')}</u><button className="ru-btn" disabled={busy} onClick={()=>void download(kind)}>{tr('dl')}</button></div></div>)}</div></details><details className="ru__acc"><summary>{tr('rulesT')}</summary><div className="ru__accb ru__rules"><ul>{(['r1','r2','r3','r4','r5','r6','r7'] as const).map(k=><li key={k}>{tr(k)}</li>)}<li>{ar?'روابط الصف الواحد للمبدع نفسه. روابط الباقة تحدد منصاتها، والستوري لإنستغرام وفيسبوك فقط.':'All profile links in a row belong to the same creator. Package links define its platforms; stories apply to Instagram/Facebook only.'}</li></ul></div></details></div>
   </section>}
   {step===2&&rows&&<section className="ru__pane">{metrics}
    {(stats.counts.error+stats.counts.unmatched>0||stats.counts.warning>0)&&<div className={'ru__block'+(stats.counts.error+stats.counts.unmatched?'':' is-warn')}><AlertTriangle size={18}/><div><b>{tr(stats.counts.error+stats.counts.unmatched?'blockT':'warnT')}</b><p>{tr(stats.counts.error+stats.counts.unmatched?'blockB':'warnB')}</p></div></div>}
    <ImportConflicts rows={rows} onResolved={preview}/>
    <div className="ru__chips">{([['ready','readyK','ok'],['warning','warnK','wr'],['error','errK','er'],['unmatched','unmK','un'],['all','allK','']] as const).map(([value,key,style])=><button disabled={busy} key={value} className={'ru__ch '+style} aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(1);}}>{tr(key)} <em>{value==='all'?rows.length:stats.counts[value]}</em></button>)}</div>
    <div className="ru__tbl">{visible.length?<div className="ru__scroll"><table><thead><tr>{(['thRow','thCr','thPf','thDl','thCost','thSell','thGp','thMk','thFee','thSt'] as const).map(k=><th key={k}>{tr(k)}</th>)}</tr></thead><tbody>{visible.slice((page-1)*50,page*50).map(row=><tr key={row.row}><td className="rn">{row.row}</td><td><strong>{row.rate?.creator_name||row.conflicts?.map(c=>c.name).join(' / ')||'—'}</strong></td><td>{row.rate?.package_details?row.rate.package_details.profiles.map(p=><span className="ru-platform" key={p.platform}>{taxonomyLabel(p.platform,lang)}</span>):taxonomyLabel(row.rate?.platform??'',lang)||'—'}</td><td>{row.rate?.package_details?`${row.rate.package_details.name}: ${packageDescription(row.rate.package_details,lang)}`:taxonomyLabel(row.rate?.deliverable??'',lang)||'—'}</td><td className="num">{amount(row,'creator_cost')}</td><td className="num">{amount(row,'client_price')}</td><td className="num">{row.gp_percent==null?'—':row.gp_percent.toFixed(2)+'%'}</td><td className="num">{row.markup_percent==null?'—':row.markup_percent.toFixed(2)+'%'}</td><td className="num">{row.rate?.agency_fee_percent==null?'—':row.rate.agency_fee_percent+'%'}</td><td><span className={'ru-status '+row.status}>{tr(row.status==='ready'?'readyK':row.status==='warning'?'warnK':row.status==='error'?'errK':'unmK')}</span>{row.diagnostics?.length?<ImportRowDiagnostics diagnostics={row.diagnostics} lang={lang}/>:null}{row.issues.filter(i=>!row.diagnostics?.length||i==='name_warning').map((issue,i)=><p key={i}>{issue==='invalidPackage'?(ar?'راجع رمز الباقة والروابط والكميات والأسعار.':'Check package code, profile links, quantities and prices.'):t(issue==='duplicate'?'duplicateError':issue==='currency'?'currencyError':issue as Label)}</p>)}</td></tr>)}</tbody></table></div>:<div className="ru__empty"><b>{filter==='error'?tr('noErrT'):(ar?'لا توجد صفوف في هذا العرض':'No rows in this view')}</b><u>{filter==='error'?tr('noErrB'):(ar?'اختر كل الصفوف للعودة إلى مراجعة الملف.':'Choose all rows to return to the workbook review.')}</u><button className="ru-btn" onClick={()=>{setFilter('all');setPage(1);}}>{tr('allK')} ({rows.length})</button></div>}
    <div className="ru__pg"><p>{tr('readOnly')}</p><span className="ru__sp"/><span>{page} / {Math.max(1,Math.ceil(visible.length/50))} · {visible.length}</span><button className="ru-btn" disabled={busy||page===1} onClick={()=>setPage(p=>p-1)}>{tr('prev')}</button><button className="ru-btn" disabled={busy||page*50>=visible.length} onClick={()=>setPage(p=>p+1)}>{tr('next')}</button></div></div>
   </section>}
   {step===3&&<section className="ru__pane">{metrics}<div className="ru__card"><div className="ru__cardh"><h3>{tr('modeT')}</h3></div><div className="ru__cardb">{(['new','update'] as const).map(value=><label className="ru__opt" key={value}><input type="radio" name="upload-mode" value={value} disabled={busy} checked={mode===value} onChange={()=>setMode(value)}/><span><b>{tr(value==='new'?'m1':'m2')}{value==='new'&&<span className="tag">{tr('default')}</span>}</b><u>{value==='new'?(ar?'يبقى الإصدار الحالي محفوظًا. يُنشأ الإصدار الجديد غير مفعّل.':'The current version is preserved. The new version is created inactive.'):(ar?'تُستبدل بنود التسعير المطابقة وتبقى البنود الأخرى كما هي.':'Matching pricing lines are replaced. Other lines stay as they are.')}</u></span></label>)}{mode==='new'?<div className="ru__vn"><label htmlFor="ru-version">{tr('vnL')}</label><input id="ru-version" type="text" maxLength={50} value={name} disabled={busy} aria-invalid={!name.trim()} aria-describedby={!name.trim()?'ru-name-error':undefined} onChange={e=>setName(e.target.value)}/>{!name.trim()&&<span className="err" id="ru-name-error">{tr('vnErr')}</span>}</div>:<p className="ru__rules">{tr('mKey')}</p>}</div></div></section>}
   {step===4&&<section className="ru__pane"><div className="ru__done"><div className={'ru__tick'+(failed?' is-bad':'')}>{failed?<AlertTriangle/>:<Check/>}</div><h3>{tr(failed?'failT':'okT')}</h3><p>{failed?(ar?'تعذر تأكيد إتمام الحفظ. راجع بطاقة الأسعار قبل المحاولة مجددًا. ملفات المبدعين التي أُنشئت أو رُبطت تبقى موجودة.':'Saving could not be confirmed. Check the rate card before retrying. Creator profiles already created or linked remain in place.'):`${stats.rows} ${tr('rowsK')} · ${stats.lines} ${tr('wLines')} · ${version.name} · ${mode==='new'?name:version.version}`}</p>{!failed&&<div className="ru__after"><b>{tr('afterT')}</b><br/>{tr('afterB')}</div>}</div></section>}
   </>}
   <div className={step===1?'hidden':'ru-enrichment'}><EnrichmentProgress paused={busy} creators={enrichment}/></div>
  </div>
  <footer className="ru__f">{step>1&&step<4&&<button className="ru-btn" disabled={busy} onClick={()=>move(step-1)}><ArrowLeft size={14}/>{tr('back')}</button>}{(path||file)&&!imported&&<button className="ru-btn edit" disabled={busy} title={ar?'لا يحذف المبدعين':'Does not delete creators'} onClick={()=>void discard()}>{tr('discard')}</button>}<span className="ru__sp"/><span className={'ru__why'+(blocker?' is-block':'')} id="ru-why" role="status">{step===4?'':why}</span><button className="ru-btn" disabled={busy} onClick={close}>{tr(imported?'done':'cancel')}</button>{stale||failed?<button className="ru-btn pri" disabled={busy} onClick={()=>void preview()}>{tr('refresh')}</button>:!imported&&<button className="ru-btn pri" disabled={!!blocker} aria-describedby="ru-why" onClick={()=>void primary()}>{step===1&&!rows?t('preview'):tr(step===3?'doImport':'cont')}</button>}{imported&&<button className="ru-btn pri" onClick={()=>onDone(imported)}>{t('view')} · {mode==='new'?name:version.version}</button>}</footer>
 </DialogContent></Dialog>;
}
function UploadRun({progress,tr}:{progress:UploadProgress;tr:(key:UploadLabel)=>string}){
 const index=stages.indexOf(progress.stage), percent=progress.total?Math.min(100,Math.round(progress.processed/progress.total*100)):undefined;
 return <section className="ru__run" aria-live="polite"><div className={'ru__ring'+(percent==null?' is-indet':'')} role="progressbar" aria-label={tr(stageLabels[index])} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><svg viewBox="0 0 88 88" aria-hidden="true"><circle className="trk" cx="44" cy="44" r="38"/><circle className="bar" cx="44" cy="44" r="38" style={percent==null?undefined:{strokeDashoffset:238.8*(1-percent/100)}}/></svg><em>{percent==null?'…':percent+'%'}</em></div><h3>{tr(stageLabels[index])}</h3><p>{tr('keepOpen')}</p>{progress.total>0&&<div className="ru__cnt">{progress.processed.toLocaleString('en-US')} / {progress.total.toLocaleString('en-US')}</div>}<div className="ru__stages">{stageLabels.map((key,i)=><div className={'ru__sg'+(i<index?' is-done':i===index?' is-now':'')} key={key}><i>{i<index?'✓':i+1}</i><span>{tr(key)}</span></div>)}</div></section>;
}
