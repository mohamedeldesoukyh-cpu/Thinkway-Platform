"use client";
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { COMMERCIAL_CURRENCIES } from '@/lib/commercial/fx-aggregation';
import { DecimalInput } from './decimal-input';
import { defaultPaymentDraft } from './payment-plan';
import { recordCreatorPaymentSeries, reviseCreatorPayment } from './actions';
import type { PaymentDraft, PaymentEntry, PaymentRow } from './model';

export function PaymentRecordEditor({row,payment,clear=false,onClose,onSaved}:{row:PaymentRow;payment?:PaymentEntry;clear?:boolean;onClose:()=>void;onSaved:()=>void}) {
    const [items,setItems]=useState<{requestId:string;draft:PaymentDraft}[]>(()=>[{requestId:crypto.randomUUID(),draft:payment?{...defaultPaymentDraft(row),amount:Number(payment.payment_amount),currency:payment.payment_currency,rate:Number(payment.exchange_rate??1),paymentDate:payment.payment_date??''}:defaultPaymentDraft(row)}]);
    const [reason,setReason]=useState('');
    const [busy,setBusy]=useState(false);
    const [error,setError]=useState('');
    function patch(index:number,change:Partial<PaymentDraft>) {setItems(current=>current.map((item,i)=>i===index?{...item,draft:{...item.draft,...change}}:item));setError('');}
    async function save() {
        setBusy(true);setError('');
        try {
            const draft=items[0].draft;
            const result=payment?await reviseCreatorPayment({id:payment.id,revision:payment.revision??0,amount:draft.amount,date:draft.paymentDate??'',clear,reason}):await recordCreatorPaymentSeries(row.assignmentId,items);
            if(!result.ok){setError(result.message);return;}
            toast.success(clear?'Payment cleared. Other payments are unchanged.':payment?'Payment revised. Balances updated.':'Payments recorded. Balances updated.');
            onSaved();onClose();
        } catch {setError('Could not confirm the save. Your entries are kept. Retry or refresh to check the records.');}
        finally {setBusy(false);}
    }
    return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="thinkway-campaign-workspace max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogTitle>{clear?'Clear':payment?'Revise':'Add'} {payment?`Payment ${payment.payment_sequence}`:'payments'} · {row.creator}</DialogTitle>
        <p className="text-sm text-muted-foreground">{clear?'This payment will be excluded from paid totals. Its history is retained as cleared; other payments remain unchanged. This corrects the record only; it does not reverse a bank transfer.':payment?'Correct this record’s amount or date. Currency and exchange rate remain those of the original payment.':'Record payments already made. Each row creates a separate numbered record. Nothing is saved until you click Save payments.'}</p>
        {!clear&&items.map((item,index)=><fieldset key={item.requestId} className="grid grid-cols-2 gap-3 rounded-xl border p-3"><legend className="px-1 text-sm font-semibold">{payment?`Payment ${payment.payment_sequence}`:`New payment ${index+1}`}</legend>
            <label className="text-sm">Amount<DecimalInput emptyZero placeholder="Enter amount" disabled={busy} value={item.draft.amount} onValueChange={amount=>patch(index,{amount})}/></label>
            <label className="text-sm">Payment date<input className="h-10 w-full rounded-md border px-3" type="date" disabled={busy} value={item.draft.paymentDate??''} onChange={e=>patch(index,{paymentDate:e.target.value})}/></label>
            <label className="text-sm">Currency<select className="h-10 w-full rounded-md border px-3" disabled={busy||!!payment} value={item.draft.currency} onChange={e=>patch(index,{currency:e.target.value,rate:e.target.value===row.currency?1:0})}>{[...new Set([...COMMERCIAL_CURRENCIES,row.currency,item.draft.currency])].map(c=><option key={c}>{c}</option>)}</select></label>
            {item.draft.currency!==row.currency&&<label className="text-sm">1 {row.currency} in {item.draft.currency}<DecimalInput precision={6} disabled={busy||!!payment} value={item.draft.rate} onValueChange={rate=>patch(index,{rate})}/><small>Original amount: {item.draft.rate>0?(item.draft.amount/item.draft.rate).toFixed(2):'—'} {row.currency}</small></label>}
            {!payment&&items.length>1&&<Button variant="outline" disabled={busy} onClick={()=>setItems(current=>current.filter((_,i)=>i!==index))}>Remove unsaved row</Button>}
        </fieldset>)}
        {!payment&&<Button variant="outline" disabled={busy||items.length>=50} onClick={()=>setItems(current=>[...current,{requestId:crypto.randomUUID(),draft:defaultPaymentDraft(row)}])}>+ Add another payment</Button>}
        {payment&&<label className="text-sm">Reason for correction<input className="h-10 w-full rounded-md border px-3" maxLength={250} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why this record needs correcting"/></label>}
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy||(!!payment&&!reason.trim())} onClick={()=>void save()}>{busy?'Saving…':clear?'Clear this payment':payment?'Save revision':'Save payments'}</Button></div>
    </DialogContent></Dialog>;
}
