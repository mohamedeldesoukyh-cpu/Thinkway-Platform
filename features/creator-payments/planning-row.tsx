"use client";

import { useState } from 'react';
import { ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { VendorIoInfluencerCell } from '@/features/io/components/vendor-io-influencer-cell';
import { COMMERCIAL_CURRENCIES } from '@/lib/commercial/fx-aggregation';
import { VendorIoLink } from './vendor-io-link';
import { paymentAllocation } from './allocations';
import { calculatePayment, ioBadge, type PaymentDraft, type PaymentRow } from './model';
import { paymentCurrencyRate } from './payment-plan';
import { validateBank } from './aaib';
import { DecimalInput } from './decimal-input';
import { PaymentHistory } from './payment-history';

export const paymentNumber = (value: number) => Number.isFinite(value) ? value.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
export function PaymentMoney({value,currency}:{value:number;currency:string}) {
  return <span className="m"><span className="cur">{currency}</span>{paymentNumber(value)}</span>;
}

export function PlanningRow({row,draft,dirty,selected,canWrite,allowPreparation,showCampaign,busy,onPatch,onBank,onSelect,onSave,onDiscard,onSaved}:{
  row:PaymentRow;draft:PaymentDraft;dirty:boolean;selected:boolean;canWrite:boolean;allowPreparation:boolean;showCampaign:boolean;busy:boolean;
  onPatch:(row:PaymentRow,change:Partial<PaymentDraft>)=>void;onBank:(row:PaymentRow)=>void;onSelect:(id:string,checked:boolean)=>void;
  onSave:(id:string)=>void;onDiscard:(id:string)=>void;onSaved:(row?:PaymentRow)=>void|Promise<void>;
}) {
  const [entryOpen,setEntryOpen]=useState(false);
  const [open,setOpen]=useState(false);
  const allocation=paymentAllocation(row);
  const calculation=calculatePayment(row,draft);
  const missing=validateBank(row.bank).length>0;
  const approved=['approved','signed'].includes(row.ioStatus);
  const badge=ioBadge(row.ioStatus);
  const errors=dirty?calculation.errors:[];
  const editable=canWrite && row.payable!==false;
  const id=row.assignmentId;
  return <article className={`grp ${open?'open':''} ${dirty?'dirty':''} ${missing?'blocked':''} ${row.revisionPending?'cp-revision-pending':''}`} aria-label={`Payments for ${row.creator}`}>
    <div className="row">
      <span><input type="checkbox" aria-label={`Select ${row.creator} for payment actions`} checked={selected} disabled={!canWrite || busy} onChange={e=>onSelect(id,e.target.checked)}/></span>
      <div className="who"><VendorIoInfluencerCell creatorId={row.creatorId} name={row.creator} handle={row.username}/>{showCampaign&&<small>{row.campaign}</small>}</div>
      <div className="io"><VendorIoLink id={row.ioId} number={row.ioNumber}/><u>{row.creatorInvoice?.number?`Inv ${row.creatorInvoice.number}`:'No invoice'}</u><span className={`cp-io-state ${approved?'is-approved':''}`}>{badge.label}</span></div>
      <div className="st">{row.revisionPending&&<span className="chip chip--wrn">Pending cost revision</span>}
        {missing&&<button className="b b--sm b--wrn" onClick={()=>onBank(row)}><AlertTriangle size={13}/>Add bank details</button>}
        {!row.revisionPending&&<span className={`chip ${allocation.fullyPaid?'chip--ok':row.paid>0?'chip--vio':'chip--mut'}`}>{allocation.fullyPaid&&<Check size={12}/ >}{allocation.fullyPaid?'Fully paid':row.paid>0?'Part paid':'Unpaid'}</span>}
        {row.reserved>0&&<span className="chip chip--cya">Pending export</span>}
        {allocation.advance>0&&<span className="chip chip--wrn">Advance</span>}
      </div>
      <div className="num" data-l="Agreed incl. VAT"><PaymentMoney value={allocation.total} currency={row.currency}/><small>{row.vat>0?`incl. ${row.vat}% VAT`:'No VAT'}</small></div>
      <div className={`num ${row.paid>0?'num--paid':'num--zero'}`} data-l="Paid"><PaymentMoney value={row.revisionPending?(row.pendingPaid??0):row.paid} currency={row.currency}/>{row.revisionPending&&<small>Retained · excluded from balance</small>}</div>
      <div className={`num num--bal ${allocation.remaining>0?'num--rem':'num--paid'}`} data-l="Remaining"><PaymentMoney value={allocation.remaining} currency={row.currency}/>{allocation.remaining<0&&<small>Advance payment</small>}</div>
      <button className="disc" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls={`history-${id}`} aria-label={`${open?'Hide':'Show'} payment details for ${row.creator}`}><ChevronDown size={16}/></button>
    </div>
    {allowPreparation&&(entryOpen||dirty)&&<div className="entry" id={`entry-${id}`}>
      <div><label className="flab" htmlFor={`currency-${id}`}>Currency</label><select className="sel" id={`currency-${id}`} disabled={!editable} value={draft.currency} onChange={e=>onPatch(row,{currency:e.target.value,rate:paymentCurrencyRate(row,e.target.value)})}>{[...new Set([...COMMERCIAL_CURRENCIES,row.currency,row.bank.currency].filter(Boolean))].map(code=><option key={code}>{code}</option>)}</select>
        {draft.currency!==row.currency&&<label className="flab cp-fx-field">1 {row.currency} =<DecimalInput className="in" aria-label={`Exchange rate for ${row.creator}`} disabled={!editable} precision={6} value={draft.rate} onValueChange={rate=>onPatch(row,{rate})}/>{draft.currency}</label>}
      </div>
      <div><label className="flab" htmlFor={`calculation-${id}`}>Calculation</label><select className="sel" id={`calculation-${id}`} disabled={!editable} value={draft.mode==='percent'?[25,50,75,100].includes(draft.percent)?String(draft.percent):'custom':draft.mode} onChange={e=>onPatch(row,['full','manual'].includes(e.target.value)?{mode:e.target.value}:{mode:'percent',percent:e.target.value==='custom'?draft.percent:Number(e.target.value)})}><option value="manual">Manual amount</option><option value="full">Full balance</option>{[25,50,75,100].map(n=><option key={n} value={n}>{n}% incl. VAT</option>)}<option value="custom">Custom %</option></select>
        {draft.mode==='percent'&&<label className="flab cp-fx-field">Percentage<DecimalInput className="in" percentage aria-label={`Payment percentage for ${row.creator}`} disabled={!editable} value={draft.percent} onValueChange={percent=>onPatch(row,{percent})}/></label>}
      </div>
      <div><label className="flab" htmlFor={`amount-${id}`}>Pay now · {draft.currency}</label><DecimalInput id={`amount-${id}`} className="in in--num" emptyZero placeholder="0.00" aria-label={`Pay now for ${row.creator} (${draft.currency})`} aria-describedby={errors.length?`errors-${id}`:undefined} aria-invalid={errors.length>0} disabled={!editable} value={Number.isFinite(calculation.payNow)?calculation.payNow:0} onValueChange={amount=>onPatch(row,{mode:'manual',amount})}/></div>
      <div><label className="flab" htmlFor={`date-${id}`}>Payment date</label><input className="in" id={`date-${id}`} type="date" disabled={!editable} value={draft.paymentDate??''} onChange={e=>onPatch(row,{paymentDate:e.target.value})}/></div>
      <div className="entry__acts">{dirty&&<><button className="b b--sm b--pri" disabled={!editable||busy||errors.length>0||calculation.payNow<=0||!draft.paymentDate} onClick={()=>onSave(id)}>{busy?'Saving…':'Save'}</button><button className="b b--sm" disabled={busy} onClick={()=>onDiscard(id)}>Discard</button></>}</div>
      {dirty&&<div className="entry__prev"><span className="dirty-flag"><i/>Unsaved changes</span>{!errors.length&&calculation.payNow>0&&<span>Preview after payment: <PaymentMoney value={calculation.remaining} currency={row.currency}/></span>}<span>Save records a payment already made.</span></div>}
      {!!errors.length&&<div className="cp-entry-errors" id={`errors-${id}`} role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}
      {dirty&&!draft.paymentDate&&<p className="cp-entry-errors">Choose the date the payment was made before saving.</p>}
    </div>}
    <PaymentHistory row={row} canWrite={canWrite} onSaved={onSaved} allowAdd={allowPreparation} redesigned open={open} onOpenChange={setOpen} beforeActions={<>
      {allowPreparation&&editable&&<button className={`b b--sm ${entryOpen||dirty?'':'b--pri'}`} aria-expanded={entryOpen||dirty} aria-controls={`entry-${id}`} onClick={()=>setEntryOpen(!entryOpen)}>{entryOpen||dirty?'Payment entry':'Prepare payment'}</button>}
      <button className="b b--sm b--ghost" onClick={()=>onBank(row)}>{missing?'Complete bank details':row.bank.registered?'Bank details':'Confirm bank registration'}</button>
    </>}/>
  </article>;
}
