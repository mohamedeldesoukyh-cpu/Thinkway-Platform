"use client";
import { useState } from 'react';
import { toast } from 'sonner';
import { updateCreatorPaymentDetails } from './actions';
import type { PaymentRow } from './model';

export function UpdatePaymentDetailsButton({row,disabled,onSaved}:{row:PaymentRow;disabled:boolean;onSaved:()=>void|Promise<void>}) {
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  async function update() {
    if(pending||disabled) return;
    setPending(true); setError('');
    try {
      const result=await updateCreatorPaymentDetails({ioId:row.ioId,fee:row.fee,vat:row.vat,currency:row.currency});
      if(!result.ok) {setError(result.message);return;}
      toast.success('Payment details updated. Original creator IO unchanged.');
      await onSaved();
    } catch {setError('Could not refresh payment details. Please try again.');}
    finally {setPending(false);}
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" className="b b--sm b--pri" disabled={disabled||pending} onClick={()=>void update()}>{pending?'Updating…':'Update payment details'}</button>
    <span className="text-xs text-muted-foreground">Use the current fee, VAT and currency for payment. Original creator IO stays unchanged.</span>
    {error&&<span role="alert" className="text-xs text-red-600">{error}</span>}
  </span>;
}
