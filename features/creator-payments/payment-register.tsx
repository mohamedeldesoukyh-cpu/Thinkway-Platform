"use client";

import { Fragment, useState, type ReactNode } from 'react';
import { COMMERCIAL_CURRENCIES } from '@/lib/commercial/fx-aggregation';
import { defaultPaymentDraft as initialDraft, changedPaymentPlans } from './payment-plan';
import { DecimalInput } from './decimal-input';
import { validateBank } from './aaib';
import { calculatePayment, ioBadge, money, paymentStatus, type PaymentDraft, type PaymentRow } from './model';

const number = (value: number) => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const amount = (value: number, currency: string) => `${number(value)} ${currency}`;

type Props = {
  rows: PaymentRow[]; drafts: Record<string, PaymentDraft>; selected: Set<string>; canWrite: boolean;
  showCampaign: boolean; filters: ReactNode; canReview: boolean;
  onPatch: (row: PaymentRow, change: Partial<PaymentDraft>) => void;
  onBank: (row: PaymentRow) => void; onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (ids: string[], checked: boolean) => void; onExport: () => void; onReview: () => void;
};

export function PaymentRegister({ rows, drafts, selected, canWrite, showCampaign, filters, canReview, onPatch, onBank, onSelect, onSelectAll, onExport, onReview }: Props) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = rows.filter(row => {
    const status = paymentStatus(row.paid, money(row.fee * (1 + row.vat / 100))).label;
    return filter === 'all' || (filter === 'paid' ? status === 'Fully paid' : status !== 'Fully paid');
  });
  const eligible = visible.filter(row => row.payable !== false);
  const incomplete = visible.filter(row => validateBank(row.bank).length > 0);
  const ready = visible.filter(row => {
    const draft = drafts[row.assignmentId] ?? initialDraft(row);
    return row.payable !== false && !validateBank(row.bank).length && row.bank.registered && draft.currency === row.bank.currency && calculatePayment(row, draft).errors.length === 0;
  });
  const currencies = [...new Set(visible.map(row => row.currency))];
  const sum = (currency: string, key: 'fee' | 'vatAmount' | 'total' | 'remaining') => visible.filter(row => row.currency === currency).reduce((total, row) => total + calculatePayment(row, drafts[row.assignmentId] ?? initialDraft(row))[key], 0);
  const payCurrencies = [...new Set(visible.filter(row => selected.has(row.assignmentId)).map(row => (drafts[row.assignmentId] ?? initialDraft(row)).currency))];

  return <section className="cp-panel" aria-label="Creator payment register">
    <div className="cp-panel-head">
      <h2>Creator payments</h2><span>{new Set(visible.map(row => row.creatorId)).size} creators · {ready.length} ready to export</span>
      <div className="cp-head-actions"><div className="cp-segments" aria-label="Payment status filter">{[['all','All'],['unpaid','Unpaid'],['paid','Paid']].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <button className="cp-button" onClick={onExport}>Export</button><button className="cp-button primary" disabled={!canReview} onClick={onReview}>Review selected</button></div>
    </div>
    <div className="cp-register-filters">{filters}</div>
    {incomplete.length > 0 && <p className="cp-note warning"><b>{incomplete.length} of {visible.length}</b> payment lines need bank details before export. You can prepare amounts now; open a creator’s bank details to complete the required fields.</p>}
    <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Creator payments table">
      <table className="cp-table"><colgroup>{[32,210,110,125,105,82,118,112,160,125,118].map((width,i) => <col key={i} style={{ width }}/>)}</colgroup>
        <thead><tr><th><input type="checkbox" aria-label="Select all visible creators" disabled={!canWrite || !eligible.length} checked={eligible.length > 0 && eligible.every(row => selected.has(row.assignmentId))} onChange={e => onSelectAll(eligible.map(row => row.assignmentId), e.target.checked)}/></th>{['Creator','Vendor IO','Status','Agreed fee','VAT %','Total fees','Currency','Calculation','Pay now','Remaining after payment'].map((label,i) => <th key={label} className={[3,4,5,8,9].includes(i) ? 'numeric' : ''}>{label}</th>)}</tr></thead>
        <tbody>{visible.map(row => {
          const draft = drafts[row.assignmentId] ?? initialDraft(row);
          const calculation = calculatePayment(row, draft);
          const status = paymentStatus(row.paid, calculation.total);
          const dirty = changedPaymentPlans([row], drafts).length > 0;
          const badge = ioBadge(row.ioStatus);
          const missing = validateBank(row.bank).length > 0;
          const open = expanded.has(row.assignmentId);
          const errors = selected.has(row.assignmentId) ? calculation.errors : [];
          return <Fragment key={row.assignmentId}>
            <tr className={`${missing ? 'bank-warning' : ''} ${selected.has(row.assignmentId) ? 'selected' : ''}`}>
              <td><input type="checkbox" aria-label={`Select ${row.creator}`} disabled={!canWrite || row.payable === false} checked={selected.has(row.assignmentId)} onChange={e => onSelect(row.assignmentId, e.target.checked)}/></td>
              <td><div className="cp-creator"><span className="cp-avatar" aria-hidden>{row.creator.replace(/^@/,'').split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase()}</span><div><strong>{row.creator}</strong>{row.username && <small>@{row.username.replace(/^@/,'')}</small>}{showCampaign && <small>{row.campaign}</small>}</div></div><button className={`cp-bank ${missing ? 'warning' : 'ready'}`} onClick={() => onBank(row)}>{missing ? 'Complete bank details' : row.bank.registered ? 'Bank details complete ✓' : 'Confirm bank registration'}</button></td>
              <td className="cp-code">{row.ioNumber}</td>
              <td><div className="cp-status"><span className={`cp-pill ${badge.className}`}>{badge.label}</span><span className={`cp-pill ${status.className}`}>{status.label}</span></div><button className="cp-detail-toggle" aria-expanded={open} aria-controls={`payment-details-${row.assignmentId}`} onClick={() => setExpanded(current => { const next = new Set(current); if (open) next.delete(row.assignmentId); else next.add(row.assignmentId); return next; })}>{open ? 'Hide details' : 'Balance details'}</button></td>
              <td className="numeric" title="Agreed fee from the campaign agreement — read-only"><b>{number(row.fee)}</b><small>{row.currency} · agreed</small></td>
              <td><DecimalInput percentage aria-label={`VAT percentage for ${row.creator}`} disabled={!canWrite} value={draft.vat} onValueChange={vat => onPatch(row,{vat})}/><small className="numeric">{amount(calculation.vatAmount,row.currency)}</small></td>
              <td className="numeric"><b>{number(calculation.total)}</b><small>{row.currency}</small></td>
              <td><select aria-label={`Payment currency for ${row.creator}`} disabled={!canWrite} value={draft.currency} onChange={e => onPatch(row,{currency:e.target.value,rate:e.target.value === row.currency ? 1 : 0})}>{[...new Set([...COMMERCIAL_CURRENCIES,row.currency,row.bank.currency].filter(Boolean))].map(code => <option key={code}>{code}</option>)}</select>{draft.currency !== row.currency && <label className="cp-fx">1 {row.currency} =<DecimalInput aria-label={`Exchange rate for ${row.creator}`} disabled={!canWrite} precision={6} value={draft.rate} onValueChange={rate => onPatch(row,{rate})}/>{draft.currency}</label>}</td>
              <td><select aria-label={`Payment calculation for ${row.creator}`} disabled={!canWrite} value={draft.mode === 'percent' ? [25,50,75,100].includes(draft.percent) ? String(draft.percent) : 'custom' : draft.mode} onChange={e => onPatch(row,e.target.value === 'full' || e.target.value === 'manual' ? {mode:e.target.value} : {mode:'percent',percent:e.target.value === 'custom' ? draft.percent : Number(e.target.value)})}><option value="full">Full balance</option>{[25,50,75,100].map(value => <option key={value} value={value}>{value}% incl. VAT</option>)}<option value="custom">Custom %</option><option value="manual">Manual amount</option></select>{draft.mode === 'percent' && <DecimalInput percentage aria-label={`Payment percentage for ${row.creator}`} disabled={!canWrite} value={draft.percent} onValueChange={percent => onPatch(row,{percent})}/>}</td>
              <td><DecimalInput aria-label={`Pay now for ${row.creator} (${draft.currency})`} disabled={!canWrite} value={Number.isFinite(calculation.payNow) ? calculation.payNow : 0} onValueChange={value => onPatch(row,{mode:'manual',amount:value})}/><small className="numeric">{dirty ? 'Unsaved · ' : row.savedDraft ? 'Saved · ' : ''}{draft.currency}{draft.currency !== row.currency && <> · {amount(calculation.originalPay,row.currency)} original</>}</small></td>
              <td className="numeric"><b>{number(calculation.remaining * calculation.rate)}</b><small>{draft.currency}{draft.currency !== row.currency && <> · {amount(calculation.remaining,row.currency)} original</>}</small><small>Unpaid: {amount(calculation.outstanding,row.currency)}</small></td>
            </tr>
            {(open || errors.length > 0 || draft.vat !== row.vat) && <tr className="cp-detail-row" id={`payment-details-${row.assignmentId}`}><td colSpan={11}>{open && <div className="cp-balances"><span>Paid <b>{amount(row.paid,row.currency)}</b></span><span>Pending exports <b>{amount(row.reserved,row.currency)}</b></span><span>Remaining after payment <b>{amount(calculation.remaining * calculation.rate,draft.currency)}</b>{draft.currency !== row.currency && <small>{amount(calculation.remaining,row.currency)} original</small>}</span></div>}{draft.vat !== row.vat && <p className="cp-vat-note">Save changes to keep this VAT adjustment in the payment plan. The issued IO and campaign agreement remain unchanged.</p>}{errors.map(error => <p key={error} role="alert" className="cp-error">{error}</p>)}</td></tr>}
          </Fragment>;
        })}{!visible.length && <tr><td colSpan={11} className="cp-empty">No creators match these filters.</td></tr>}</tbody>
        <tfoot><tr><td/><td>{new Set(visible.map(row => row.creatorId)).size} creators</td><td/><td>{ready.length} ready</td><td className="numeric">{currencies.map(currency => <div key={currency}>{amount(sum(currency,'fee'),currency)}</div>)}</td><td className="numeric"><small>VAT amount</small>{currencies.map(currency => <div key={currency}>{amount(sum(currency,'vatAmount'),currency)}</div>)}</td><td className="numeric">{currencies.map(currency => <div key={currency}>{amount(sum(currency,'total'),currency)}</div>)}</td><td/><td>Selected pay now</td><td className="numeric">{payCurrencies.length ? payCurrencies.map(currency => <div key={currency}>{amount(visible.filter(row => selected.has(row.assignmentId) && (drafts[row.assignmentId] ?? initialDraft(row)).currency === currency).reduce((total,row) => { const value = calculatePayment(row,drafts[row.assignmentId] ?? initialDraft(row)).payNow; return total + (Number.isFinite(value) ? value : 0); },0),currency)}</div>) : '—'}</td><td className="numeric">{currencies.map(currency => <div key={currency}>{amount(sum(currency,'remaining'),currency)}</div>)}</td></tr></tfoot>
      </table>
    </div>
    {incomplete.length > 0 && <div className="cp-warning-footer">Complete the highlighted bank records before generating a bank payment file. Exporting reserves the amounts; confirm the bank results afterwards.</div>}
  </section>;
}
