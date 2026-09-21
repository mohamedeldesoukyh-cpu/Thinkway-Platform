import { paymentAllocation } from './allocations';
import type { PaymentRow } from './model';
const amount = (n:number,c:string) => `${c} ${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date = (value?:string|null) => value ? new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}) : 'Date not recorded';
export function PaymentHistory({row}:{row:PaymentRow}) {
    const allocation = paymentAllocation(row);
    return <div className="cp-payment-history">
        <div className="cp-balances"><span>Total agreed incl. VAT <b>{amount(allocation.total,row.currency)}</b></span><span>Total paid <b>{amount(row.paid,row.currency)}</b></span><span>Remaining <b>{amount(allocation.remaining,row.currency)}</b></span><span>Actual / earned <b>{amount(allocation.earned,row.currency)}</b></span><span>Advance <b>{amount(allocation.advance,row.currency)}</b></span></div>
        <details><summary>Payment history ({row.history?.length ?? 0}) · {allocation.live} of {allocation.count} deliverables live</summary>
            {row.history?.length ? <ol>{row.history.map(payment=><li key={payment.id}><b>Payment {payment.payment_sequence}</b> — {amount(payment.payment_amount,payment.payment_currency)} — {date(payment.payment_date)}{payment.payment_currency!==row.currency && <small> · {amount(payment.original_amount,payment.original_currency)} original</small>} <small> · {payment.source==='manual' ? 'Recorded payment' : 'Confirmed bank payment'}</small></li>)}</ol> : <p>{row.paid>0 ? 'Paid through the previous workflow; individual payment dates were not recorded here.' : 'No payments recorded yet.'}</p>}
            <p><b>Remaining: {amount(allocation.remaining,row.currency)}</b></p>
            <p>Equal value per deliverable, including VAT. Payments settle live deliverables first in assignment order; the remainder is advance against future deliverables in the same order.</p>
            {!allocation.count ? <p>No deliverables available yet. Payments remain advance until live deliverables are recorded.</p> : <table><thead><tr><th>Deliverable</th><th>Live</th><th>Value</th><th>Allocated</th><th>Actual paid</th><th>Advance</th><th>Allocation</th></tr></thead><tbody>{allocation.units.map((unit,index)=><tr key={unit.id}><td>Deliverable {index+1} · {unit.label}</td><td>{unit.live?'Live':'Not live'}</td><td>{amount(unit.value,row.currency)}</td><td>{amount(unit.allocated,row.currency)}</td><td>{amount(unit.actual,row.currency)}</td><td>{amount(unit.advance,row.currency)}</td><td>{unit.live && unit.allocated>=unit.value?'Closed':unit.allocated>0?'Allocated':'Unallocated'}</td></tr>)}</tbody></table>}
        </details>
    </div>;
}
