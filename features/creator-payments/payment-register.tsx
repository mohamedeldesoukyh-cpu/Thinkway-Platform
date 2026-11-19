"use client";
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { setCreatorPaymentCostPending } from './actions';
import { useRouter } from 'next/navigation';
import { PaymentMoney, PlanningRow } from './planning-row';
import { defaultPaymentDraft as initialDraft, changedPaymentPlans } from './payment-plan';
import { matchesPaymentFilter } from './allocations';
import { validateBank } from './aaib';
import { calculatePayment, type PaymentDraft, type PaymentRow } from './model';

type Props = {
  busy: boolean; onSave: (id: string) => void; onDiscard: (id: string) => void; rows: PaymentRow[]; drafts: Record<string, PaymentDraft>; selected: Set<string>; canWrite: boolean;
  showCampaign: boolean; filters: ReactNode; canReview: boolean; filter: string; onFilterChange: (filter:string) => void;
  onPatch: (row: PaymentRow, change: Partial<PaymentDraft>) => void;
  onBank: (row: PaymentRow) => void; onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (ids: string[], checked: boolean) => void; onExport: () => void; onReview: () => void; onSaved: (row?: PaymentRow) => void | Promise<void>;
};


export function PaymentRegister({rows,drafts,selected,canWrite,showCampaign,filters,canReview,onPatch,onBank,onSelect,onSelectAll,onExport,onReview,onSaved,filter,onFilterChange,busy,onSave,onDiscard}:Props) {
  const [changing,setChanging]=useState(false);
  const router=useRouter();
  const selectedRows=rows.filter(row=>selected.has(row.assignmentId));
  const removePending=selectedRows.length>0&&selectedRows.every(row=>row.revisionPending);
  const canPending=selectedRows.length>0&&selectedRows.every(row=>row.reserved===0&&(removePending?row.revisionPending:!row.revisionPending&&row.paid>0));
  async function togglePending() {
    if(!canPending||changing||busy)return;
    setChanging(true);
    try {
      const result=await setCreatorPaymentCostPending(selectedRows.map(row=>row.assignmentId),!removePending);
      if(!result.ok){toast.error(result.message);return;}
      onSelectAll(selectedRows.map(row=>row.assignmentId),false);
      await onSaved();
      router.refresh();
      toast.success(removePending?'Original payments restored. Balances recalculated.':'Payments retained and marked pending cost revision.');
    } catch {toast.error('Could not update pending state. Refresh and try again.');}
    finally {setChanging(false);}
  }
  const visible=rows.filter(row=>matchesPaymentFilter(row,filter));
  const eligible=visible.filter(row=>row.payable!==false);
  const incomplete=visible.filter(row=>validateBank(row.bank).length>0);
  const allowPreparation=!['paid','advance'].includes(filter);
  const dirty=new Set(changedPaymentPlans(rows,drafts).map(row=>row.assignmentId));
  const selectedTotals=new Map<string,number>();
  for(const row of visible.filter(row=>selected.has(row.assignmentId))) {
    const draft=drafts[row.assignmentId]??initialDraft(row);
    const value=calculatePayment(row,draft).payNow;
    if(Number.isFinite(value)) selectedTotals.set(draft.currency,(selectedTotals.get(draft.currency)??0)+value);
  }
  return <section className="card cp-planning" aria-label="Creator payment register">
    {canWrite&&selectedRows.length>0&&<div className="cp-revision-toolbar"><span>{selectedRows.length} creator lines selected</span><button className="b b--sm" disabled={!canPending||changing||busy||dirty.size>0} onClick={()=>void togglePending()}>{changing?'Updating…':removePending?'Remove pending':'Pending'}</button><small>{removePending?'Restore the original payments after generating the revised IO.':'Temporarily exclude recorded payments while revising agreed costs. Original payment details are retained.'}</small>{!canPending&&<small>Select only paid lines, or only lines already pending revision. Resolve pending bank exports first.</small>}{dirty.size>0&&<small>Save or discard draft payment edits first.</small>}</div>}
    <div className="bar"><div className="filts" role="group" aria-label="Payment status filter">{[['all','All'],['unpaid','Unpaid'],['paid','Paid'],['advance','Advance']].map(([value,label])=><button className="filt" key={value} aria-pressed={filter===value} onClick={()=>onFilterChange(value)}>{label}<b>{rows.filter(row=>matchesPaymentFilter(row,value)).length}</b></button>)}</div><div className="cp-search-fields">{filters}</div>{allowPreparation&&<><button className="b b--sm" onClick={onExport}>Export</button><button className="b b--sm b--pri" disabled={!canReview} onClick={onReview}>Review selected</button></>}</div>
    {!allowPreparation&&<p className="note note--info">{filter==='paid'?'Paid includes partially paid creators and advances.':'Outstanding advances.'} Reference view — use All or Unpaid to prepare payments.</p>}
    {!!incomplete.length&&allowPreparation&&<p className="note note--wrn"><span><b>{incomplete.length} of {visible.length} lines need bank details.</b> You can prepare amounts now; complete bank details before export.</span></p>}
    <div className="thead"><span>{allowPreparation&&<input type="checkbox" aria-label="Select all visible creators" disabled={!canWrite||!eligible.length} checked={eligible.length>0&&eligible.every(row=>selected.has(row.assignmentId))} onChange={e=>onSelectAll(eligible.map(row=>row.assignmentId),e.target.checked)}/>}</span><span>Creator</span><span>Vendor IO</span><span>Status</span><span className="num">Agreed incl. VAT</span><span className="num">Paid</span><span className="num">Remaining</span><span/></div>
    {visible.map(row=><PlanningRow key={row.assignmentId} row={row} draft={drafts[row.assignmentId]??initialDraft(row)} dirty={dirty.has(row.assignmentId)} selected={selected.has(row.assignmentId)} canWrite={canWrite} busy={busy} allowPreparation={allowPreparation} showCampaign={showCampaign} onPatch={onPatch} onBank={onBank} onSelect={onSelect} onSave={onSave} onDiscard={onDiscard} onSaved={onSaved}/>)}
    {!visible.length&&<div className="none"><b>No creators match</b><p>Try another filter or search.</p></div>}
    <footer className="foot"><span>{visible.length} payment lines</span><span className="sp"/>{!!selectedTotals.size&&<><span>Selected pay now</span>{[...selectedTotals].map(([currency,value])=><PaymentMoney key={currency} value={value} currency={currency}/>)}</>}</footer>
  </section>;
}
