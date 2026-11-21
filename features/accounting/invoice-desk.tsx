// Inherits AccountingConsole's client boundary.
import { useEffect,useState } from 'react';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import type { AccountingSetup } from './setup-types';
import { invoicePreview,type InvoiceSubmission } from './invoice-model';
export function InvoiceDesk({setup,onBusyChange}:{setup:AccountingSetup;onBusyChange:(busy:boolean)=>void}){
 const company=setup.company!;
 const [rows,setRows]=useState<InvoiceSubmission[]>([]),[count,setCount]=useState(0),[page,setPage]=useState(0),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<InvoiceSubmission|null>(null),[date,setDate]=useState(''),[receivable,setReceivable]=useState('121001'),[revenue,setRevenue]=useState(''),[vat,setVat]=useState('231001'),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{const controller=new AbortController();
  void fetch(`/api/accounting/invoices?company=${company.id}&page=${page}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);if(!controller.signal.aborted){setRows(data.rows);setCount(data.count);}}).catch(e=>{if(!controller.signal.aborted){setRows([]);setError(e.message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[company.id,page,epoch]);
 function refresh(){setLoading(true);setError('');setEpoch(n=>n+1);}
 function changePage(next:number){setLoading(true);setError('');setPage(next);}
 function review(row:InvoiceSubmission){setSelected(row);setDate(row.source.date);setRevenue('');setConfirmed(false);setError('');setNotice('');}
 async function write(operation:'post'|'withdraw'){
  if(!selected)return;setBusy(true);onBusyChange(true);setError('');
  try{const value=operation==='post'?{invoice:selected.invoice_id,company:company.id,version:selected.version,date,receivable,revenue,vat:vat||null}:{invoice:selected.invoice_id,version:selected.version};
   const r=await fetch('/api/accounting/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,value})});const data=await r.json();if(!r.ok)throw new Error(data.error);
   setSelected(null);refresh();setNotice(operation==='post'?'Invoice posted. Its voucher is available in Journal vouchers, General ledger and Trial balance.':'Submission withdrawn. It can be reviewed and submitted again from Media.');
  }catch(e){setError(e instanceof Error?e.message:'Could not complete request');}finally{setBusy(false);onBusyChange(false);}
 }
 const accounts=setup.accounts.filter(a=>a.active);
 let preview:ReturnType<typeof invoicePreview>=[];let previewError='';try{if(selected)preview=invoicePreview(selected.source,receivable,revenue,vat);}catch(e){previewError=e instanceof Error?e.message:'Invalid totals';}
 const options=(kind:'receivable'|'revenue'|'vat')=>accounts.filter(a=>kind==='receivable'?a.kind==='Control'&&a.subledger==='Customer'&&a.type==='Asset'&&a.normal==='Debit':a.kind==='Posting'&&a.type===(kind==='revenue'?'Revenue':'Liability')&&a.normal==='Credit').map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>);
 return <section className="tw-ac-setup-panel"><div className="tw-ac-panel-heading"><div><h2>Platform invoice posting</h2><p>Invoices are created in TW Media. Review their accounts here before posting.</p></div><button className="tw-ac-button" disabled={busy||loading} onClick={refresh}>Refresh invoices</button></div>
 {notice&&<p role="status" className="tw-ac-success">{notice}</p>}{error&&!selected&&<p role="alert" className="tw-ac-error">{error}</p>}
 <div className="tw-ac-journal-table-scroll"><table className="tw-ac-journal-table"><thead><tr><th>Invoice</th><th>Customer code / name</th><th>Invoice date</th><th>Total</th><th>Accounting status</th><th>Voucher</th><th>Review</th></tr></thead><tbody>{rows.map(row=><tr key={row.invoice_id}><td>{row.source.number}</td><td>{row.client_code}<small>{row.client_name}</small></td><td>{row.source.date}</td><td>{row.source.total} {row.source.currency}</td><td>{row.reversal?'Reversed':row.status==='posted'?'Posted':'Awaiting posting'}</td><td>{row.voucher??'—'}{row.reversal&&<small>Reversal: {row.reversal}</small>}</td><td><button className="tw-ac-button" onClick={()=>review(row)}>Review invoice</button></td></tr>)}</tbody></table></div>
 {loading?<p role="status">Loading invoice submissions…</p>:!rows.length&&<p>No submitted invoices. Open an issued invoice in TW Media and choose Submit to Accounting.</p>}
 <div className="tw-ac-form-actions"><span>{count} submissions</span><button className="tw-ac-button" disabled={!page||loading} onClick={()=>changePage(page-1)}>Previous</button><button className="tw-ac-button" disabled={(page+1)*50>=count||loading} onClick={()=>changePage(page+1)}>Next</button></div>
 <Dialog open={!!selected} onOpenChange={open=>{if(!open&&!busy)setSelected(null);}}><DialogContent className="tw-accounting tw-ac-edit-dialog"><DialogHeader><DialogTitle>Review invoice {selected?.source.number}</DialogTitle><DialogDescription>{selected?.client_code} · {selected?.client_name} · {company.name}</DialogDescription></DialogHeader>{selected&&<>
 <p>Invoice date: {selected.source.date}. Amount: {selected.source.total} {selected.source.currency}. Receipt balances are handled separately.</p>
 {selected.status==='posted'?<p>This invoice is {selected.reversal?'reversed':'posted'} as {selected.voucher}. Review or reverse the original voucher from Journal vouchers.{selected.reversal&&` Reversal: ${selected.reversal}.`}</p>:<form onSubmit={e=>{e.preventDefault();void write('post');}}><fieldset disabled={busy||!setup.access.manage} className="tw-ac-form-grid">
 <label>Posting date<input type="date" required min={selected.source.date} value={date} onChange={e=>{setDate(e.target.value);setConfirmed(false);}}/></label>
 <label>Customer receivable<select required value={receivable} onChange={e=>{setReceivable(e.target.value);setConfirmed(false);}}><option value="">Select account</option>{options('receivable')}</select></label>
 <label className="tw-ac-span">Revenue account<select required value={revenue} onChange={e=>{setRevenue(e.target.value);setConfirmed(false);}}><option value="">Choose the invoice revenue account</option>{options('revenue')}</select></label>
 {Number(selected.source.vat)>0&&<label className="tw-ac-span">Output VAT account<select required value={vat} onChange={e=>{setVat(e.target.value);setConfirmed(false);}}><option value="">Select account</option>{options('vat')}</select></label>}
 <div className="tw-ac-span tw-ac-journal-table-scroll"><table className="tw-ac-journal-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{preview.map((line,i)=><tr key={i}><td>{accounts.find(a=>a.code===line.account)?.name??'Select account'}{i===0&&<small>{selected.client_code} · {selected.client_name}</small>}</td><td>{line.debit}</td><td>{line.credit}</td></tr>)}</tbody></table></div>
 <label className="tw-ac-check tw-ac-span"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I reviewed the company, date, accounts and invoice amounts.</label>
 <div className="tw-ac-form-actions"><button type="button" className="tw-ac-button" onClick={()=>void write('withdraw')}>Withdraw submission</button><button className="tw-ac-button tw-ac-primary" disabled={!confirmed||!!previewError}>{busy?'Posting…':'Post invoice'}</button></div>
 </fieldset></form>}{previewError&&<p role="alert" className="tw-ac-error">{previewError}</p>}{error&&<p role="alert" className="tw-ac-error">{error}</p>}</>}</DialogContent></Dialog>
 </section>;
}
