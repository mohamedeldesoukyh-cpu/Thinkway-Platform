import { paymentAllocation } from './allocations';
import type { PaymentRow } from './model';

const amount = (n: number, currency: string) => `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CreatorPaymentSummary({ row }: { row: PaymentRow }) {
  const allocation = paymentAllocation(row);
  return <div className="cp-creator-summary-grid">
    <div className="cp-mini-card">
      <table className="cp-mini-table" aria-label={`Payment balance for ${row.creator}`}>
        <caption>Payment balance <span>{row.currency}</span></caption>
        <tbody>
          <tr><th scope="row">Total agreed incl. VAT</th><td>{amount(allocation.total, row.currency)}</td></tr>
          <tr><th scope="row">Total paid</th><td className="cp-paid-value">{amount(row.paid, row.currency)}</td></tr>
          <tr className="cp-mini-total"><th scope="row">Remaining</th><td>{amount(allocation.remaining, row.currency)}</td></tr>
        </tbody>
      </table>
    </div>
    <div className="cp-mini-card">
      <table className="cp-mini-table" aria-label={`Advance balance for ${row.creator}`}>
        <caption>Advance amounts <span>{allocation.live} / {allocation.count} deliverables live</span></caption>
        <tbody>
          <tr><th scope="row">Actual / earned incl. VAT</th><td>{amount(allocation.earned, row.currency)}</td></tr>
          <tr><th scope="row">Paid against earned</th><td>{amount(allocation.actual, row.currency)}</td></tr>
          <tr className="cp-mini-total"><th scope="row">Outstanding advance</th><td className={allocation.advance > 0 ? 'cp-advance-value' : undefined}>{amount(allocation.advance, row.currency)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>;
}
