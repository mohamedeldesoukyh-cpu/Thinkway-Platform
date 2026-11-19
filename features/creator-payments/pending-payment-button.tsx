"use client";
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setCreatorPaymentCostPending } from './actions';
import type { PaymentRow } from './model';

export function PendingPaymentButton({ rows, busy, disabled, onBusy, onSaved, className }: {
  rows: PaymentRow[]; busy: boolean; disabled: boolean; onBusy: (busy: boolean) => void;
  onSaved: () => Promise<void>; className: string;
}) {
  const router = useRouter();
  const remove = rows.length > 0 && rows.every(row => row.revisionPending);
  const eligible = rows.length > 0 && rows.every(row => row.reserved === 0 && (remove ? row.revisionPending : !row.revisionPending && row.paid > 0));
  async function toggle() {
    if (disabled || busy || !eligible) return;
    onBusy(true);
    try {
      const result = await setCreatorPaymentCostPending(rows.map(row => row.assignmentId), !remove);
      if (!result.ok) { toast.error(result.message); return; }
      await onSaved();
      router.refresh();
      toast.success(remove ? 'Original payments restored. Balances recalculated.' : 'Payments retained and marked pending cost revision.');
    } catch { toast.error('Could not update pending state. Refresh and try again.'); }
    finally { onBusy(false); }
  }
  return <button type="button" className={className} disabled={disabled || busy || !eligible} onClick={() => void toggle()}
    title={!eligible ? 'Select paid creators, or creators already pending revision. Resolve bank exports first.' : remove ? 'Restore original payments after revising the cost and generating the revised IO.' : 'Keep original payment details while temporarily unlocking cost revision.'}>
    {remove ? 'Remove pending' : 'Pending'}
  </button>;
}
