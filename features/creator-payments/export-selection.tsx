import { validateBank } from './aaib';
import { calculatePayment, type PaymentDraft, type PaymentRow } from './model';
import { defaultPaymentDraft } from './payment-plan';
import { PaymentMoney } from './planning-row';

/** Review the actual prepared amounts; never substitute a remaining balance. */
export function ExportSelection({rows,drafts,selected,canWrite,onSelect,onBank}:{rows:PaymentRow[];drafts:Record<string,PaymentDraft>;selected:Set<string>;canWrite:boolean;onSelect:(id:string,checked:boolean)=>void;onBank:(row:PaymentRow)=>void}) {
  const totals=new Map<string,number>();
  for(const row of rows.filter(row=>selected.has(row.assignmentId))) {
    const draft=drafts[row.assignmentId]??defaultPaymentDraft(row);
    const {payNow}=calculatePayment(row,draft);
    if(Number.isFinite(payNow))totals.set(draft.currency,(totals.get(draft.currency)??0)+payNow);
  }
  return <section className="card cp-export-selection" aria-label="Export payment selection">
    <div className="bar"><strong>Prepared payment lines</strong><span className="sp"/><span>{selected.size} selected</span></div>
    {rows.map(row=>{
      const draft=drafts[row.assignmentId]??defaultPaymentDraft(row);
      const calculation=calculatePayment(row,draft);
      const missing=validateBank(row.bank).length>0||!row.bank.registered;
      const issue=missing?'Complete bank details':draft.currency!==row.bank.currency?'Payment and bank currencies differ':calculation.errors[0];
      const eligible=row.payable!==false&&!issue;
      return <div className="cp-export-line" key={row.assignmentId}>
        <input type="checkbox" aria-label={`Include ${row.creator} in export`} checked={selected.has(row.assignmentId)} disabled={!canWrite||(!eligible&&!selected.has(row.assignmentId))} onChange={e=>onSelect(row.assignmentId,e.target.checked)}/>
        <div><strong dir="auto">{row.creator}</strong><small>{row.ioNumber}</small></div>
        <div><PaymentMoney value={calculation.payNow} currency={draft.currency}/><small>Prepared amount</small></div>
        <span className={`chip ${eligible?'chip--ok':'chip--wrn'}`}>{eligible?'Ready for review':issue||'Not payable'}</span>
        {missing&&<button className="b b--sm" onClick={()=>onBank(row)}>Bank details</button>}
      </div>;
    })}
    {!rows.length&&<div className="none">No payment lines available.</div>}
    <div className="foot"><span>Selected file amounts</span>{[...totals].map(([currency,value])=><PaymentMoney key={currency} currency={currency} value={value}/>)}{!totals.size&&<span>Nothing selected</span>}</div>
  </section>;
}
