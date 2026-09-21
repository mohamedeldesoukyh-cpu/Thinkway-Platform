import { paymentAllocation } from './allocations';
import { ioBadge, money, type PaymentRow } from './model';

const number=(value:number)=>value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const headings=['Creator','Vendor IO','Status','Agreed fee','VAT amount','Total fees','Total payment','Went live amount','Advance amount'];

export function AdvanceRegister({rows,showCampaign}:{rows:PaymentRow[];showCampaign:boolean}) {
    const values=rows.map(row=>{
        const allocation=paymentAllocation(row);
        return {row,allocation,amounts:[row.fee,money(row.fee*row.vat/100),allocation.total,row.paid,allocation.earned,allocation.advance]};
    });
    const currencies=[...new Set(rows.map(row=>row.currency))];
    return <>
        <p className="cp-note">Read-only · Total payment includes saved payments. Went live amount is the earned value of live deliverables, including VAT. Advance is paid money not yet earned. Amounts update automatically as payments or live deliverables change.</p>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Creator advances reference table">
            <table className="cp-table">
                <thead><tr>{headings.map((heading,index)=><th key={heading} className={index>=3?'numeric':''}>{heading}</th>)}</tr></thead>
                <tbody>{values.map(({row,allocation,amounts})=>{
                    const badge=ioBadge(row.ioStatus);
                    return <tr key={row.assignmentId}>
                        <td><div className="cp-creator"><span className="cp-avatar" aria-hidden>{row.creator.replace(/^@/,'').split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</span><div><strong>{row.creator}</strong>{row.username&&<small>@{row.username.replace(/^@/,'')}</small>}{showCampaign&&<small>{row.campaign}</small>}</div></div></td>
                        <td className="cp-code">{row.ioNumber}</td>
                        <td><div className="cp-status"><span className={`cp-pill ${badge.className}`}>{badge.label}</span><span className="cp-pill bg-orange-50 text-orange-700">Advance</span></div></td>
                        {amounts.map((value,index)=><td key={index} className="numeric"><b className={index===5?'text-orange-700':index===4?'text-green-700':undefined}>{number(value)}</b><small>{row.currency}</small>{index===4&&<small>{allocation.live} of {allocation.count} live</small>}</td>)}
                    </tr>;
                })}{!rows.length&&<tr><td colSpan={9} className="cp-empty">No outstanding advances match these filters.</td></tr>}</tbody>
                {!!rows.length&&<tfoot><tr><td colSpan={3}>{new Set(rows.map(row=>row.creatorId)).size} creators · totals by original currency</td>{[0,1,2,3,4,5].map(index=><td key={index} className="numeric">{currencies.map(currency=><div key={currency}>{number(money(values.filter(({row})=>row.currency===currency).reduce((total,item)=>total+item.amounts[index],0)))} {currency}</div>)}</td>)}</tr></tfoot>}
            </table>
        </div>
    </>;
}
