"use client";

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { paymentAllocation } from './allocations';
import { money, type PaymentRow } from './model';

export function BalanceSummary({ rows, children }: { rows: PaymentRow[]; children: ReactNode }) {
  const groups = new Map<string, Map<string, { name: string; agreed: number; paid: number; remaining: number; held: number }>>();
  for (const row of rows) {
    const creators = groups.get(row.currency) ?? new Map();
    const creator = creators.get(row.creatorId ?? row.assignmentId) ?? { name: row.creator, agreed: 0, paid: 0, remaining: 0, held: 0 };
    const allocation = paymentAllocation(row);
    creator.agreed = money(creator.agreed + allocation.total);
    creator.paid = money(creator.paid + row.paid);
    creator.remaining = money(creator.remaining + allocation.remaining);
    creator.held = money(creator.held + (row.revisionPending ? row.pendingPaid ?? 0 : 0));
    creators.set(row.creatorId ?? row.assignmentId, creator);
    groups.set(row.currency, creators);
  }
  const format = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return <Dialog>
    <DialogTrigger asChild><button type="button" className="cp-balance-link" aria-label="View creator payment balance summary">{children}</button></DialogTrigger>
    <DialogContent className="cp-balance-dialog sm:max-w-3xl">
      <div className="pr-10"><DialogTitle>Creator payment summary</DialogTitle>
        <DialogDescription className="mt-2">Agreed amounts include VAT. Paid amounts exclude pending bank exports and payments held for cost revision. Negative remaining balances are advance payments.</DialogDescription></div>
      <div className="cp-balance-scroll">
        {[...groups].map(([currency, creators]) => {
          const entries = [...creators.values()];
          const total = entries.reduce((sum, row) => ({ agreed: money(sum.agreed + row.agreed), paid: money(sum.paid + row.paid), remaining: money(sum.remaining + row.remaining) }), { agreed: 0, paid: 0, remaining: 0 });
          return <section key={currency} className="cp-balance-group">
            <h3>{currency} <span>· {entries.length} creators</span></h3>
            <div className="cp-balance-table-scroll" role="region" aria-label={`${currency} creator balances`} tabIndex={0}>
              <table className="cp-balance-table">
                <thead><tr><th scope="col">Creator</th><th scope="col">Agreed amount</th><th scope="col">Paid</th><th scope="col">Remaining</th></tr></thead>
                <tbody>{entries.map((row, index) => <tr key={index}>
                  <th scope="row"><bdi>{row.name}</bdi>{row.held > 0 && <small>{currency} {format(row.held)} pending revision</small>}</th>
                  <td>{format(row.agreed)}</td><td className="cp-balance-paid">{format(row.paid)}</td>
                  <td className={row.remaining > 0 ? 'cp-balance-outstanding' : 'cp-balance-paid'}>{format(row.remaining)}{row.remaining < 0 && <small>Advance payment</small>}</td>
                </tr>)}</tbody>
                <tfoot><tr><th scope="row">Total · {currency}</th><td>{format(total.agreed)}</td><td className="cp-balance-paid">{format(total.paid)}</td><td className={total.remaining > 0 ? 'cp-balance-outstanding' : 'cp-balance-paid'}>{format(total.remaining)}</td></tr></tfoot>
              </table>
            </div>
          </section>;
        })}
        {!groups.size && <p>No creator payments yet.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
