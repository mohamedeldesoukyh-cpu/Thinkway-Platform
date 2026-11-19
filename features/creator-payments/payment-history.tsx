import { PaymentProofAttachments } from './payment-proof-attachments';
import { CreatorPaymentSummary } from './creator-payment-summary';
import {InvoiceVatEditor} from './invoice-vat-editor';
import { ChevronDown, ListChecks } from 'lucide-react';
import type { PaymentRow } from './model';
import { useState, type ReactNode } from 'react';
import type { PaymentEntry } from './model';
import { PaymentRecordEditor } from './payment-record-editor';
const amount = (n:number,c:string) => `${c} ${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date = (value?:string|null) => value ? new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}) : 'Date not recorded';
function PaymentProofDisclosure({paymentId,canWrite}:{paymentId:string;canWrite:boolean}) {
    const [open,setOpen]=useState(false);
    return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Proof</summary>{open&&<PaymentProofAttachments paymentId={paymentId} canWrite={canWrite}/>}</details>;
}
export function PaymentHistory({row,canWrite,onSaved,allowAdd=true,compact=false,redesigned=false,open,onOpenChange,beforeActions}:{row:PaymentRow;canWrite:boolean;onSaved:(row?:PaymentRow)=>void | Promise<void>;allowAdd?:boolean;compact?:boolean;redesigned?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;beforeActions?:ReactNode}) {
    const [editor,setEditor]=useState<{payment?:PaymentEntry;clear?:boolean}|null>(null);
    return <div className={`cp-payment-history ${redesigned?'cp-designed-history':''}`}>
        <div className={redesigned?"acts":undefined}>{beforeActions}
        <InvoiceVatEditor row={row} canWrite={canWrite} onSaved={onSaved}/>
        {allowAdd&&canWrite&&row.payable!==false&&<button className="cp-button" onClick={()=>setEditor({})}>+ Add payments</button>}
        {editor&&<PaymentRecordEditor row={row} {...editor} onClose={()=>setEditor(null)} onSaved={onSaved}/>}
        </div><details id={`history-${row.assignmentId}`} open={open} onToggle={e=>{if(onOpenChange&&e.currentTarget.open!==open)onOpenChange(e.currentTarget.open);}} className="cp-payment-details">
          <summary>
            <ListChecks aria-hidden="true" size={18}/>
            <span><strong className="cp-details-show">Show payment details</strong><strong className="cp-details-hide">Hide payment details</strong><small>{compact ? 'Payment ledger' : 'VAT · Advance amounts · Payment ledger'}</small></span>
            <span className="cp-details-count">{row.history?.length ?? 0} {(row.history?.length ?? 0)===1?'payment':'payments'}</span>
            <ChevronDown aria-hidden="true" size={18} className="cp-details-chevron"/>
          </summary>
          <div className="cp-payment-details-body">
        {!compact&&<CreatorPaymentSummary row={row} supplemental={redesigned}/>}
        <div className="cp-mini-card cp-payment-ledger-card">
          <div className="cp-ledger-heading">Payment ledger <span>{row.history?.length ?? 0} records</span></div>
          <div className="cp-creator-ledger-scroll" role="region" aria-label={`Payment ledger for ${row.creator}`} tabIndex={0}>
            <table className="cp-mini-table cp-creator-ledger" aria-label={`Recorded payments for ${row.creator}`}>
              <thead><tr><th scope="col">Payment</th><th scope="col">Date</th><th scope="col">Amount paid</th><th scope="col">Status / reference</th><th scope="col">Actions</th></tr></thead>
              <tbody>{row.history?.length ? row.history.map(payment=><tr key={payment.id} className={payment.status==='revision_pending'?'cp-held-payment':payment.cleared_at?'cp-cleared-payment':undefined}>
                <th scope="row">{payment.payment_sequence ? `Payment ${payment.payment_sequence}` : 'Unnumbered payment'}</th>
                <td>{date(payment.payment_date)}</td>
                <td className="cp-ledger-money">{amount(payment.payment_amount,payment.payment_currency)}{payment.payment_currency!==row.currency&&<small>{amount(payment.original_amount,payment.original_currency)} original</small>}</td>
                <td><span className="cp-ledger-status">{payment.cleared_at?'Cleared · excluded from totals':payment.status==='revision_pending'?'Pending cost revision · payment retained':payment.source==='manual'?'Recorded payment':'Confirmed bank payment'}{!payment.cleared_at&&!!payment.revision&&' · Revised'}</span>{payment.bank_reference&&<small>{payment.bank_reference}</small>}</td>
                <td><div className="cp-ledger-actions">{canWrite&&!row.revisionPending&&!payment.cleared_at&&<><button className="cp-button" onClick={()=>setEditor({payment})}>Edit</button><button className="cp-button" onClick={()=>setEditor({payment,clear:true})}>Clear</button></>}<PaymentProofDisclosure paymentId={payment.id} canWrite={canWrite}/></div></td>
              </tr>) : <tr><td colSpan={5} className="cp-ledger-empty">{row.paid>0?'Paid through the previous workflow; individual payment dates were not recorded here.':'No payments recorded yet.'}</td></tr>}</tbody>
            </table>
          </div>
        </div>
          </div>
        </details>
    </div>;
}
