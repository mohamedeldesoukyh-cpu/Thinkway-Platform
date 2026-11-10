import { PaymentProofAttachments } from './payment-proof-attachments';
import { CreatorPaymentSummary } from './creator-payment-summary';
import {InvoiceVatEditor} from './invoice-vat-editor';
import { paymentAllocation } from './allocations';
import type { PaymentRow } from './model';
import { useState } from 'react';
import type { PaymentEntry } from './model';
import { PaymentRecordEditor } from './payment-record-editor';
const amount = (n:number,c:string) => `${c} ${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date = (value?:string|null) => value ? new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}) : 'Date not recorded';
function PaymentProofDisclosure({paymentId,canWrite}:{paymentId:string;canWrite:boolean}) {
    const [open,setOpen]=useState(false);
    return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Proof</summary>{open&&<PaymentProofAttachments paymentId={paymentId} canWrite={canWrite}/>}</details>;
}
export function PaymentHistory({row,canWrite,onSaved,allowAdd=true,compact=false}:{row:PaymentRow;canWrite:boolean;onSaved:(row?:PaymentRow)=>void | Promise<void>;allowAdd?:boolean;compact?:boolean}) {
    const [editor,setEditor]=useState<{payment?:PaymentEntry;clear?:boolean}|null>(null);
    const allocation = paymentAllocation(row);
    return <div className="cp-payment-history">
        <InvoiceVatEditor row={row} canWrite={canWrite} onSaved={onSaved}/>
        {allowAdd&&canWrite&&row.payable!==false&&<button className="cp-button" onClick={()=>setEditor({})}>+ Add payments</button>}
        {editor&&<PaymentRecordEditor row={row} {...editor} onClose={()=>setEditor(null)} onSaved={onSaved}/>}
        {!compact&&<CreatorPaymentSummary row={row}/>}
        <div className="cp-mini-card cp-payment-ledger-card">
          <div className="cp-ledger-heading">Payment ledger <span>{row.history?.length ?? 0} records</span></div>
          <div className="cp-creator-ledger-scroll" role="region" aria-label={`Payment ledger for ${row.creator}`} tabIndex={0}>
            <table className="cp-mini-table cp-creator-ledger" aria-label={`Recorded payments for ${row.creator}`}>
              <thead><tr><th scope="col">Payment</th><th scope="col">Date</th><th scope="col">Amount paid</th><th scope="col">Status / reference</th><th scope="col">Actions</th></tr></thead>
              <tbody>{row.history?.length ? row.history.map(payment=><tr key={payment.id} className={payment.cleared_at?'cp-cleared-payment':undefined}>
                <th scope="row">{payment.payment_sequence ? `Payment ${payment.payment_sequence}` : 'Unnumbered payment'}</th>
                <td>{date(payment.payment_date)}</td>
                <td className="cp-ledger-money">{amount(payment.payment_amount,payment.payment_currency)}{payment.payment_currency!==row.currency&&<small>{amount(payment.original_amount,payment.original_currency)} original</small>}</td>
                <td><span className="cp-ledger-status">{payment.cleared_at?'Cleared · excluded from totals':payment.source==='manual'?'Recorded payment':'Confirmed bank payment'}{!payment.cleared_at&&!!payment.revision&&' · Revised'}</span>{payment.bank_reference&&<small>{payment.bank_reference}</small>}</td>
                <td><div className="cp-ledger-actions">{canWrite&&!payment.cleared_at&&<><button className="cp-button" onClick={()=>setEditor({payment})}>Edit</button><button className="cp-button" onClick={()=>setEditor({payment,clear:true})}>Clear</button></>}<PaymentProofDisclosure paymentId={payment.id} canWrite={canWrite}/></div></td>
              </tr>) : <tr><td colSpan={5} className="cp-ledger-empty">{row.paid>0?'Paid through the previous workflow; individual payment dates were not recorded here.':'No payments recorded yet.'}</td></tr>}</tbody>
            </table>
          </div>
        </div>
        <details><summary>Deliverable allocation · {allocation.live} of {allocation.count} live</summary>
            <p>Equal value per deliverable, including VAT. Payments settle live deliverables first in assignment order; the remainder is advance against future deliverables in the same order.</p>
            {!allocation.count ? <p>No deliverables available yet. Payments remain advance until live deliverables are recorded.</p> : <table><thead><tr><th>Deliverable</th><th>Live</th><th>Value</th><th>Allocated</th><th>Actual paid</th><th>Advance</th><th>Allocation</th></tr></thead><tbody>{allocation.units.map((unit,index)=><tr key={unit.id}><td>Deliverable {index+1} · {unit.label}</td><td>{unit.live?'Live':'Not live'}</td><td>{amount(unit.value,row.currency)}</td><td>{amount(unit.allocated,row.currency)}</td><td>{amount(unit.actual,row.currency)}</td><td>{amount(unit.advance,row.currency)}</td><td>{unit.live && unit.allocated>=unit.value?'Closed':unit.allocated>0?'Allocated':'Unallocated'}</td></tr>)}</tbody></table>}
        </details>
    </div>;
}
