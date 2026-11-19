"use client";

import { paymentCurrencyRate } from "./payment-plan";
import { Fragment, useState, type ReactNode } from 'react';
import { Pencil, Layers3, Clock3, CircleCheck, ArrowUpRight } from 'lucide-react';
import { VendorIoLink } from './vendor-io-link';
import { COMMERCIAL_CURRENCIES } from '@/lib/commercial/fx-aggregation';
import { defaultPaymentDraft as initialDraft, changedPaymentPlans } from './payment-plan';
import { paymentAllocation, matchesPaymentFilter } from './allocations';
import { PaymentHistory } from './payment-history';
import { PaidRegister } from './paid-register';
import { AdvanceRegister } from './advance-register';
import { DecimalInput } from './decimal-input';
import { validateBank } from './aaib';
import { calculatePayment, ioBadge, paymentStatus, type PaymentDraft, type PaymentRow } from './model';

const number = (value: number) => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const amount = (value: number, currency: string) => `${number(value)} ${currency}`;

type Props = {
  rows: PaymentRow[]; drafts: Record<string, PaymentDraft>; selected: Set<string>; canWrite: boolean;
  showCampaign: boolean; filters: ReactNode; canReview: boolean; filter: string; onFilterChange: (filter:string) => void;
  onPatch: (row: PaymentRow, change: Partial<PaymentDraft>) => void;
  onBank: (row: PaymentRow) => void; onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (ids: string[], checked: boolean) => void; onExport: () => void; onReview: () => void; onSaved: (row?: PaymentRow) => void | Promise<void>;
};

export function PaymentRegister({ rows, drafts, selected, canWrite, showCampaign, filters, canReview, onPatch, onBank, onSelect, onSelectAll, onExport, onReview, onSaved, filter, onFilterChange }: Props) {

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = rows.filter(row => matchesPaymentFilter(row,filter));
  const eligible = visible.filter(row => row.payable !== false);
  const incomplete = visible.filter(row => validateBank(row.bank).length > 0);
  const ready = visible.filter(row => {
    const draft = drafts[row.assignmentId] ?? initialDraft(row);
    return row.payable !== false && !validateBank(row.bank).length && row.bank.registered && draft.currency === row.bank.currency && calculatePayment(row, draft).errors.length === 0;
  });
  const payCurrencies = [...new Set(visible.filter(row => selected.has(row.assignmentId)).map(row => (drafts[row.assignmentId] ?? initialDraft(row)).currency))];

  return <section className="cp-panel cp-compact-register" aria-label="Creator payment register">
    <div className="cp-panel-head">
      <h2>Creator payments</h2><span>{new Set(visible.map(row => row.creatorId)).size} creators{!['advance','paid'].includes(filter)&&<> · {ready.length} ready to export</>}</span>
      <div className="cp-head-actions"><div className="cp-segments cp-status-filters" role="group" aria-label="Payment status filter">{[{value:'all',label:'All',icon:Layers3},{value:'unpaid',label:'Unpaid',icon:Clock3},{value:'paid',label:'Paid',icon:CircleCheck},{value:'advance',label:'Advance',icon:ArrowUpRight}].map(({value,label,icon:Icon}) => <button key={value} aria-pressed={filter === value} onClick={() => onFilterChange(value)}><Icon size={14} aria-hidden="true"/>{label}</button>)}</div>
        {!['advance','paid'].includes(filter)&&<><button className="cp-button" onClick={onExport}>Export</button><button className="cp-button primary" disabled={!canReview} onClick={onReview}>Review selected</button></>}</div>
    </div>
    <div className="cp-register-filters">{filters}</div>
    {filter==='paid'?<PaidRegister rows={visible} showCampaign={showCampaign} canWrite={canWrite} onSaved={onSaved}/>:filter==='advance'?<AdvanceRegister rows={visible} showCampaign={showCampaign}/>:<>
    {incomplete.length > 0 && <p className="cp-note warning"><b>{incomplete.length} of {visible.length}</b> payment lines need bank details before export. You can prepare amounts now; open a creator’s bank details to complete the required fields.</p>}
    <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Creator payments table">
      <table className="cp-table"><colgroup>{[32,185,150,160,110,170,150,150].map((width,i) => <col key={i} style={{ width }}/>)}</colgroup>
        <thead><tr><th><input type="checkbox" aria-label="Select all visible creators" disabled={!canWrite || !eligible.length} checked={eligible.length > 0 && eligible.every(row => selected.has(row.assignmentId))} onChange={e => onSelectAll(eligible.map(row => row.assignmentId), e.target.checked)}/></th>{['Bank details','Vendor IO','Status','Currency','Calculation','Pay now','Payment date'].map((label,i) => <th key={label} className={[3,4,5,8,9].includes(i) ? 'numeric' : ''}>{label}</th>)}</tr></thead>
        <tbody>{visible.map(row => {
          const draft = drafts[row.assignmentId] ?? initialDraft(row);
          const calculation = calculatePayment(row, draft);
          const allocation = paymentAllocation(row);
          const status = allocation.fullyPaid ? {label:'Paid',className:'bg-green-50 text-green-700'} : allocation.advance>0 ? {label:'Advance',className:'bg-orange-50 text-orange-700'} : paymentStatus(row.paid,allocation.total);
          const dirty = changedPaymentPlans([row], drafts).length > 0;
          const badge = ioBadge(row.ioStatus);
          const missing = validateBank(row.bank).length > 0;
          const open = expanded.has(row.assignmentId);
          const errors = selected.has(row.assignmentId) && calculation.payNow > 0 ? calculation.errors : [];
          return <Fragment key={row.assignmentId}>
            <tr className="cp-creator-heading-row"><td colSpan={8}>
              <div className="cp-creator-heading">
                <div className="cp-creator-heading-identity">
                  <strong dir="auto">{row.creator}</strong>
                  <span>{row.username && `@${row.username.replace(/^@/,'')}`}{showCampaign && <span dir="auto">{row.username ? ' · ' : ''}{row.campaign}</span>}</span>
                </div>
                <dl className="cp-creator-heading-amounts" aria-label={`Payment summary for ${row.creator}`}>
                  <div className="cp-line-agreed"><dt>Agreed amount <span>incl. VAT</span></dt><dd><span>{row.currency}</span> {number(allocation.total)}</dd></div>
                  <div className="cp-line-paid"><dt>Total paid</dt><dd><span>{row.currency}</span> {number(row.paid)}</dd></div>
                  <div className={allocation.remaining > 0 ? 'cp-line-remaining' : 'cp-line-settled'}><dt>Remaining <span>{allocation.remaining === 0 ? 'Fully paid' : 'to pay'}</span></dt><dd><span>{row.currency}</span> {number(allocation.remaining)}</dd></div>
                </dl>
              </div>
            </td></tr>
            <tr className={`${missing ? 'bank-warning' : ''} ${selected.has(row.assignmentId) ? 'selected' : ''}`}>
              <td><input type="checkbox" aria-label={`Select ${row.creator}`} disabled={!canWrite || row.payable === false} checked={selected.has(row.assignmentId)} onChange={e => onSelect(row.assignmentId, e.target.checked)}/></td>
              <td><button type="button" aria-haspopup="dialog" title={`Edit bank details for ${row.creator}`} className={`cp-bank ${missing ? 'warning' : 'ready'}`} onClick={() => onBank(row)}><Pencil size={13} aria-hidden="true"/>{missing ? 'Complete bank details' : row.bank.registered ? 'Bank details complete ✓' : 'Confirm bank registration'}</button></td>
              <td className="cp-code"><VendorIoLink id={row.ioId} number={row.ioNumber}/><small>Creator Inv# {row.creatorInvoice?.number||'Not added'}</small></td>
              <td><div className="cp-status"><span className={`cp-pill ${badge.className}`}>{badge.label}</span><span className={`cp-pill ${status.className}`}>{status.label}</span></div><button className="cp-detail-toggle" aria-expanded={open} aria-controls={`payment-details-${row.assignmentId}`} onClick={() => setExpanded(current => { const next = new Set(current); if (open) next.delete(row.assignmentId); else next.add(row.assignmentId); return next; })}>{open ? 'Hide details' : 'Balance details'}</button></td>
              <td><select aria-label={`Payment currency for ${row.creator}`} disabled={!canWrite} value={draft.currency} onChange={e => onPatch(row,{currency:e.target.value,rate:paymentCurrencyRate(row, e.target.value)})}>{[...new Set([...COMMERCIAL_CURRENCIES,row.currency,row.bank.currency].filter(Boolean))].map(code => <option key={code}>{code}</option>)}</select>{draft.currency !== row.currency && <label className="cp-fx">1 {row.currency} =<DecimalInput aria-label={`Exchange rate for ${row.creator}`} disabled={!canWrite} precision={6} value={draft.rate} onValueChange={rate => onPatch(row,{rate})}/>{draft.currency}</label>}</td>
              <td><select aria-label={`Payment calculation for ${row.creator}`} disabled={!canWrite} value={draft.mode === 'percent' ? [25,50,75,100].includes(draft.percent) ? String(draft.percent) : 'custom' : draft.mode} onChange={e => onPatch(row,e.target.value === 'full' || e.target.value === 'manual' ? {mode:e.target.value} : {mode:'percent',percent:e.target.value === 'custom' ? draft.percent : Number(e.target.value)})}><option value="full">Full balance</option>{[25,50,75,100].map(value => <option key={value} value={value}>{value}% incl. VAT</option>)}<option value="custom">Custom %</option><option value="manual">Manual amount</option></select>{draft.mode === 'percent' && <DecimalInput percentage aria-label={`Payment percentage for ${row.creator}`} disabled={!canWrite} value={draft.percent} onValueChange={percent => onPatch(row,{percent})}/>}</td>
              <td><DecimalInput emptyZero placeholder="Enter amount" aria-label={`Pay now for ${row.creator} (${draft.currency})`} disabled={!canWrite} value={Number.isFinite(calculation.payNow) ? calculation.payNow : 0} onValueChange={value => onPatch(row,{mode:'manual',amount:value})}/><small className="numeric">{dirty && calculation.payNow>0 ? 'Not recorded · ' : ''}{draft.currency}{draft.currency !== row.currency && <> · {amount(calculation.originalPay,row.currency)} original</>}</small></td>
              <td><label className="cp-payment-date"><span className="sr-only">Payment date</span><input type="date" aria-label={`Payment date for ${row.creator}`} disabled={!canWrite} value={draft.paymentDate ?? ''} onChange={e=>onPatch(row,{paymentDate:e.target.value})}/></label></td>
            </tr>
            {(open || errors.length > 0) && <tr className="cp-detail-row" id={`payment-details-${row.assignmentId}`}><td colSpan={8}>{open && <div className="cp-balances"><span>Fee before VAT <b>{amount(row.fee,row.currency)}</b></span><span>VAT ({row.vat}%) <b>{amount(calculation.vatAmount,row.currency)}</b></span><span>Paid <b>{amount(row.paid,row.currency)}</b></span><span>Pending exports <b>{amount(row.reserved,row.currency)}</b></span><span>Remaining after payment <b>{amount(calculation.remaining * calculation.rate,draft.currency)}</b>{draft.currency !== row.currency && <small>{amount(calculation.remaining,row.currency)} original</small>}</span></div>}{errors.map(error => <p key={error} role="alert" className="cp-error">{error}</p>)}</td></tr>}
            <tr className="cp-detail-row"><td colSpan={8}><PaymentHistory row={row} canWrite={canWrite} onSaved={onSaved}/></td></tr>
          </Fragment>;
        })}{!visible.length && <tr><td colSpan={8} className="cp-empty">No creators match these filters.</td></tr>}</tbody>
        <tfoot><tr><td colSpan={3}>{new Set(visible.map(row => row.creatorId)).size} creators · {ready.length} ready</td><td colSpan={2}/><td>Selected pay now</td><td className="numeric">{payCurrencies.length ? payCurrencies.map(currency => <div key={currency}>{amount(visible.filter(row => selected.has(row.assignmentId) && (drafts[row.assignmentId] ?? initialDraft(row)).currency === currency).reduce((total,row) => { const value = calculatePayment(row,drafts[row.assignmentId] ?? initialDraft(row)).payNow; return total + (Number.isFinite(value) ? value : 0); },0),currency)}</div>) : '—'}</td><td/></tr></tfoot>
      </table>
    </div>
    {incomplete.length > 0 && <div className="cp-warning-footer">Complete the highlighted bank records before generating a bank payment file. Exporting reserves the amounts; confirm the bank results afterwards.</div>}
    </>}
  </section>;
}
