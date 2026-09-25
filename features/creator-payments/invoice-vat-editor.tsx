"use client";
import {useState,useTransition} from 'react';
import Link from 'next/link';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {saveCreatorPaymentInvoice} from './actions';
import {money,type PaymentRow} from './model';

export function InvoiceVatEditor({row,canWrite,onSaved}:{row:PaymentRow;canWrite:boolean;onSaved:(row?:PaymentRow)=>void|Promise<void>}){
 const [open,setOpen]=useState(false);const [vat,setVat]=useState(row.vat===14);const [pending,start]=useTransition();const [error,setError]=useState('');
 const format=(n:number)=>`${row.currency} ${n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 const tax=money(row.fee*(vat?0.14:0));
 return <><button className="cp-button" disabled={!canWrite} onClick={()=>{setVat(row.vat===14);setError('');setOpen(true);}}>Creator Inv# {row.creatorInvoice?.number||'not added'} · Edit invoice & VAT</button>
 <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}><DialogContent className="thinkway-creator-payments sm:max-w-xl"><DialogTitle>Creator invoice & VAT · {row.creator}</DialogTitle>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);start(async()=>{const r=await saveCreatorPaymentInvoice({assignmentId:row.assignmentId,number:String(f.get('number')||''),date:String(f.get('date')||''),country:String(f.get('country')||''),vat,revision:row.creatorInvoice?.revision??0,expectedVat:row.vat});if(!r.ok){setError(r.message);return;}toast.success('Invoice and VAT saved. Payment balance updated.');setOpen(false);await onSaved(row);});}}>
 <div className="grid gap-4 sm:grid-cols-2 text-sm"><label>Creator Inv#<input name="number" className="block w-full rounded border p-2" maxLength={100} defaultValue={row.creatorInvoice?.number??''}/></label><label>Invoice date<input name="date" type="date" className="block w-full rounded border p-2" defaultValue={row.creatorInvoice?.date??''}/></label><label>VAT<select aria-label="Creator invoice VAT" className="block w-full rounded border p-2" value={vat?'yes':'no'} onChange={e=>setVat(e.target.value==='yes')}><option value="no">No · 0%</option><option value="yes">Yes · 14%</option></select></label><label>Tax country code<input name="country" className="block w-full rounded border p-2" maxLength={2} required defaultValue={row.creatorInvoice?.country||row.creatorCountry||''} placeholder="EG"/></label></div>
 {row.vat!==0&&row.vat!==14&&<p className="mt-3 text-amber-700">Current assignment VAT is {row.vat}%. Saving this form replaces it with {vat?14:0}%.</p>}
 <div className="my-4 grid grid-cols-3 gap-3 text-left text-sm"><div>Cost<strong className="block">{format(row.fee)}</strong></div><div>VAT {vat?'14%':'0%'}<strong className="block">{format(tax)}</strong></div><div>Total cost<strong className="block">{format(money(row.fee+tax))}</strong></div></div>
 <p className="mb-3 text-sm">Recorded payments stay unchanged. Adding VAT increases the remaining payable. Enter an invoice number and its original date to confirm this invoice in the VAT statement; without an invoice, VAT remains a cost estimate.</p>
 <Link className="text-sm text-blue-600" href={`/billing/creator-invoices?assignment=${row.assignmentId}`}>Full invoice details and attachment</Link>
 {error&&<p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
 <div className="mt-4 flex gap-2"><button className="cp-button primary" disabled={pending}>{pending?'Saving…':'Save invoice & VAT'}</button><button type="button" className="cp-button" disabled={pending} onClick={()=>setOpen(false)}>Cancel</button></div>
 </form></DialogContent></Dialog></>;
}
