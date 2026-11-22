'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NoteAllocations } from './note-allocations';
import { Button } from '@/components/ui/button';

type Row = { id: string; type: string; number: string; date: string; party: string; code: string; currency: string; net: string; tax: string; total: string; eligible: boolean; reason: string; status: string; token: string; version: number; journal: string | null; accruals: { amount: string; currency: string; reference: string }[] };
const kinds = [['client_invoice','Client Invoices'],['cost','Cost Invoices'],['client_credit_note','Client CN'],['vendor_credit_note','Supplier CN'],['client_debit_note','Client DN'],['vendor_debit_note','Supplier DN']];
const number = (v: string) => Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function AccountingPostingQueue({ company, manage, today }: { company: string; manage: boolean; today: string }) {
  const [kind,setKind] = useState('client_invoice'), [from,setFrom] = useState(today.slice(0,4)+'-01-01'), [to,setTo] = useState(today), [posted,setPosted] = useState(false);
  const [rows,setRows] = useState<Row[]>([]), [selected,setSelected] = useState<Set<string>>(new Set()), [page,setPage] = useState(0), [more,setMore] = useState(false);
  const [busy,setBusy] = useState(false), [message,setMessage] = useState('Choose a document type and browse.'), [errors,setErrors] = useState<Record<string,string>>({}), [reason,setReason] = useState('');
  const [allocation,setAllocation] = useState<Row|null>(null);
  const [confirmation,setConfirmation] = useState(false), [browsed,setBrowsed] = useState(false);
  const key = (r: Row) => r.type+':'+r.id;
  function reset() { setAllocation(null);setRows([]);setSelected(new Set());setPage(0);setMore(false);setBrowsed(false);setConfirmation(false);setErrors({}); }
  async function read(p: number) {
    const q = new URLSearchParams({ company, type:kind, from, to, posted:String(posted), page:String(p) });
    const response = await fetch('/api/accounting/media-posting?'+q, { cache:'no-store' });
    const data = await response.json();if (!response.ok) throw Error(data.error);return data as { rows:Row[];count:number;more:boolean };
  }
  async function browse(p = 0) {
    setBusy(true);setConfirmation(false);setErrors({});
    try { const d=await read(p);setRows(d.rows);setMore(d.more);setPage(p);setSelected(new Set());setBrowsed(true);setMessage(`${d.count} ${posted?'posted':'unposted'} documents in the selected period.`); }
    catch(e) { setMessage(e instanceof Error?e.message:'Could not load documents'); }
    finally { setBusy(false); }
  }
  async function all() {
    setBusy(true);setConfirmation(false);
    try { const all:Row[]=[];let p=0,more=true;while(more){const d=await read(p++);all.push(...d.rows);more=d.more;if(p>2000)throw Error('Narrow the date range');}setRows(all);setSelected(new Set(all.filter(r=>posted||r.eligible).map(key)));setMore(false);setPage(0); }
    catch(e) { setMessage(e instanceof Error?e.message:'Could not select documents'); }
    finally { setBusy(false); }
  }
  async function execute() {
    setBusy(true);setErrors({});setConfirmation(false);const failed:Record<string,string>={};const done=new Set<string>();
    for (const row of rows.filter(r=>selected.has(key(r)))) {
      try { const response=await fetch('/api/accounting/media-posting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,type:row.type,id:row.id,operation:posted?'unpost':'post',token:row.token,version:row.version,...(posted?{reason}:{})})});const d=await response.json();if(!response.ok)throw Error(d.error);done.add(key(row)); }
      catch(e) { failed[key(row)]=e instanceof Error?e.message:'Posting failed'; }
    }
    setRows(r=>r.filter(x=>!done.has(key(x))));setSelected(s=>new Set([...s].filter(x=>!done.has(x))));setErrors(failed);setMessage(`${done.size} ${posted?'unposted; linked JVs are pending':'posted to Accounting'}. ${Object.keys(failed).length} failed.`);setBusy(false);
  }
  return <div className="space-y-4">
    <p>Browse unposted documents, select them and post once. Each document creates its own balanced JV. Unpost before changing a posted document; reposting retains its JV number.</p>
    <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
      <label>Document type<select className="block rounded border p-2" value={kind} onChange={e=>{setKind(e.target.value);reset();}}>{kinds.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      <label>From<input className="block rounded border p-2" type="date" value={from} onChange={e=>{setFrom(e.target.value);reset();}}/></label>
      <label>To<input className="block rounded border p-2" type="date" value={to} onChange={e=>{setTo(e.target.value);reset();}}/></label>
      <label>View<select className="block rounded border p-2" value={String(posted)} onChange={e=>{setPosted(e.target.value==='true');reset();}}><option value="false">Unposted</option><option value="true">Posted</option></select></label>
      <Button onClick={()=>void browse()}>Browse</Button>
      <Link href={`/accounting?company=${company}#mapping`}>Posting settings</Link>
    </fieldset>
    {allocation&&<NoteAllocations company={company} type={allocation.type} id={allocation.id} manage={manage} onClose={()=>{setAllocation(null);void browse(page);}}/>}
    <p role="status">{message}</p>
    {browsed&&<><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy||!manage} onClick={()=>void all()}>Select all in period</Button><Button variant="outline" disabled={busy} onClick={()=>setSelected(new Set())}>Clear selection</Button><span>{selected.size} selected</span>{posted&&<label>Unposting reason<input className="ml-2 rounded border p-2" value={reason} maxLength={500} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>}<Button disabled={busy||!manage||!selected.size||(posted&&reason.trim().length<3)} onClick={()=>setConfirmation(true)}>{posted?'Unpost selected':'Post selected'}</Button></div>
    {confirmation&&<div role="alertdialog" aria-label="Confirm accounting posting" className="rounded border p-4"><p>{posted?'Unpost the selected documents? Their linked JVs will become pending and leave posted balances.':'Post the selected documents to Accounting? This will create or update the linked JVs and balances. Automatic accrual, if enabled, includes net costs only.'}</p><div className="mt-3 flex gap-3"><Button onClick={()=>void execute()}>Confirm {posted?'unposting':'posting'}</Button><Button variant="outline" onClick={()=>setConfirmation(false)}>Cancel</Button></div></div>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Select','Number / date','Third Party','Currency','Net','VAT','Total','Accounting status'].map(h=><th key={h} className="border-b p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={key(r)}><td className="border-b p-2"><input type="checkbox" aria-label={`Select ${r.number}`} checked={selected.has(key(r))} disabled={busy||!manage||(!posted&&!r.eligible)} onChange={e=>{setConfirmation(false);setSelected(s=>{const n=new Set(s);if(e.target.checked)n.add(key(r));else n.delete(key(r));return n;});}}/></td><td className="border-b p-2">{r.number}<br/>{r.date}</td><td className="border-b p-2">{r.code} · {r.party}</td><td className="border-b p-2">{r.currency}</td>{[r.net,r.tax,r.total].map((v,i)=><td key={i} className="border-b p-2 text-right tabular-nums">{number(v)}</td>)}<td className="border-b p-2">{r.journal?<Link href={`/accounting?company=${company}&journal=${r.journal}#journals`}>{r.status} · View JV</Link>:r.status}{posted&&r.type.endsWith('_note')&&<Button variant="outline" disabled={busy} onClick={()=>setAllocation(r)}>Invoice allocations</Button>}{!r.eligible&&<p>{r.reason}</p>}{r.accruals?.map((a,i)=><p key={i}>Net cost accrual: {number(a.amount)} {a.currency} · {a.reference}</p>)}{errors[key(r)]&&<p role="alert" className="text-red-600">{errors[key(r)]}</p>}</td></tr>)}</tbody></table></div>
    <div className="flex gap-3"><Button variant="outline" disabled={busy||page===0} onClick={()=>void browse(page-1)}>Previous</Button><Button variant="outline" disabled={busy||!more} onClick={()=>void browse(page+1)}>Next</Button></div></>}
  </div>;
}
