"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PaymentRecordEditor } from './payment-record-editor';
import type { PaymentBatch, PaymentEntry, PaymentRow } from './model';

const amount = (entry: PaymentEntry) => `${entry.payment_currency} ${Number(entry.payment_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const paidDate = (entry: PaymentEntry) => entry.status === 'paid' && !entry.cleared_at
    ? entry.payment_date ? new Date(entry.payment_date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Date not recorded'
    : 'Not paid';
const status = (entry: PaymentEntry) => entry.cleared_at ? 'Cleared' : entry.status === 'exported' ? 'Pending bank result' : entry.status === 'paid' ? 'Paid' : entry.status === 'failed' ? 'Failed' : entry.status;
// The application numbers payments within each assignment. Keep that real identity;
// the reference's campaign-wide PAY serial is sample data, not an application field.
const paymentNumber = (entry: PaymentEntry) => entry.payment_sequence ? `Payment ${entry.payment_sequence}` : 'Unnumbered payment';

export function PaymentLedger({ rows, batches, canWrite, onSaved, onExport }: {
    rows: PaymentRow[]; batches: PaymentBatch[]; canWrite: boolean;
    onSaved: (row?: PaymentRow) => void | Promise<void>; onExport: () => void;
}) {
    const [creator, setCreator] = useState('');
    const [detail, setDetail] = useState<{ row: PaymentRow; entry: PaymentEntry } | null>(null);
    const [editor, setEditor] = useState<{ row: PaymentRow; payment?: PaymentEntry; clear?: boolean } | null>(null);
    const entries = new Map<string, { row: PaymentRow; entry: PaymentEntry }>();
    for (const row of rows) for (const entry of row.history ?? []) entries.set(entry.id, { row, entry });
    for (const batch of batches) for (const entry of batch.entries) {
        const row = rows.find(row => row.assignmentId === entry.assignment_id);
        if (row && !entries.has(entry.id)) entries.set(entry.id, { row, entry });
    }
    const recordRow = rows.find(row => row.assignmentId === creator);
    return <section className="cp-panel cp-ledger" aria-label="Creator payment records">
        <div className="cp-panel-head"><h2>Creator payments</h2><span>Cost side</span>
            <div className="cp-head-actions">
                {canWrite && <><select aria-label="Creator to record payment" value={creator} onChange={e => setCreator(e.target.value)}><option value="">Select creator…</option>{rows.filter(row => row.payable !== false).map(row => <option key={row.assignmentId} value={row.assignmentId}>{row.creator} · {row.ioNumber}</option>)}</select>
                <button className="cp-button primary" disabled={!recordRow || recordRow.payable === false} onClick={() => { if (recordRow) setEditor({ row: recordRow }); }}>Record payment</button></>}
            </div>
        </div>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Creator payment records table"><table className="cp-table cp-ledger-table">
            <colgroup>{[138,144,undefined,128,104,118].map((width, i) => <col key={i} style={{ width }}/>)}</colgroup>
            <thead><tr>{['Payment #','Against Vendor IO','Creator','Amount','Status','Paid date'].map(label => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>{[...entries.values()].map(({ row, entry }) => <tr key={entry.id}>
                <td className="cp-code"><button className="cp-ledger-open" aria-label={`Open ${paymentNumber(entry)} for ${row.creator}`} onClick={() => setDetail({ row, entry })}>{paymentNumber(entry)}</button></td>
                <td className="cp-code">{row.ioNumber}</td>
                <td><div className="cp-creator"><span className="cp-avatar" aria-hidden>{row.creator.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase()}</span><div><strong>{row.creator}</strong></div></div></td>
                <td className="numeric">{amount(entry)}</td>
                <td><span className={`cp-pill ${!entry.cleared_at && entry.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{status(entry)}</span></td>
                <td>{paidDate(entry)}</td>
            </tr>)}{!entries.size && <tr><td colSpan={6} className="cp-empty">No payment records yet. Use Record payment for payments already made, or Payment planning to prepare a bank export.</td></tr>}</tbody>
        </table></div>
        <p className="cp-note">Recorded payments and bank export results. Pending exports remain pending until you confirm the bank result. Clearing a record does not reverse a bank transfer.</p>
        <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="cp-payment-detail-drawer left-auto right-0 top-0 translate-x-0 translate-y-0"><DialogTitle>Creator payment · {detail ? paymentNumber(detail.entry) : ''}</DialogTitle>
            {detail && <><p className="cp-drawer-sub">{detail.row.creator} · {status(detail.entry)}</p><section className="cp-payment-detail-section"><h3>Payment</h3><dl>{[
                ['Payment number',paymentNumber(detail.entry)],['Against Vendor IO',detail.row.ioNumber],['Creator',detail.row.creator],['Amount',amount(detail.entry)],['Status',status(detail.entry)],['Paid date',paidDate(detail.entry)],['Reference',detail.entry.bank_reference || '—'],['Original amount',`${detail.entry.original_currency} ${Number(detail.entry.original_amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`]
            ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
            <div className="cp-drawer-actions"><button className="cp-button" onClick={() => setDetail(null)}>Close</button>
                {canWrite && !detail.entry.cleared_at && detail.entry.status === 'paid' && <><button className="cp-button" onClick={() => { setEditor({ row: detail.row, payment: detail.entry, clear: true }); setDetail(null); }}>Clear payment</button><button className="cp-button primary" onClick={() => { setEditor({ row: detail.row, payment: detail.entry }); setDetail(null); }}>Edit payment</button></>}
                {detail.entry.status === 'exported' && !detail.entry.cleared_at && <button className="cp-button" onClick={() => { setDetail(null); onExport(); }}>Open bank export results</button>}
            </div></>}
        </DialogContent></Dialog>
        {editor && <PaymentRecordEditor {...editor} onClose={() => setEditor(null)} onSaved={onSaved}/>}
    </section>;
}
