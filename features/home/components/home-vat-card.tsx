import Link from "next/link";
import { accumulatedVatMonths, type VatLedger } from "@/features/finance/vat/ledger-model";

const amount = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const month = (period: string) => new Date(`${period}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export function HomeVatCard({ data }: { data: VatLedger }) {
  const rows = accumulatedVatMonths(data);
  const latest = rows.filter((row, index) => rows.findIndex(other => other.country === row.country && other.currency === row.currency) === index);
  return <section className="tw-c home-vat">
    <div className="tw-ch">
      <span className="tw-ct">Accumulated VAT payable</span>
      <span className="tw-cs">All recorded months · after credits and tax payments</span>
      <span className="tw-sp" />
      <Link className="tw-b sm" href="/finance/vat">Open VAT statement</Link>
    </div>
    {!rows.length ? <p className="home-vat-note">No confirmed VAT records yet.</p> : <>
      <div className="home-vat-totals">
        {latest.map(row => <div className="home-vat-total" key={`${row.country}|${row.currency}`}>
          <span className="home-vat-label">{row.country} · {row.currency} · through {month(row.period)}</span>
          <strong className="home-vat-amount">{row.currency} {amount(row.payable)}</strong>
          <span className={`home-vat-status ${row.payable > 0 ? 'due' : 'clear'}`}>{row.payable > 0 ? 'Needs to be paid' : 'No payment due'}</span>
          {row.credit > 0 && <span className="home-vat-note">Credit carried forward: {row.currency} {amount(row.credit)}</span>}
        </div>)}
      </div>
      <details className="home-vat-history">
        <summary className="home-vat-summary">Monthly breakdown · {rows.length} periods</summary>
        <p className="home-vat-note">Accumulated balance = previous balance + monthly VAT − tax paid. Countries and currencies remain separate.</p>
        <div className="home-vat-scroll">
          {rows.map(row => <div className="home-vat-row" key={`${row.period}|${row.country}|${row.currency}`}>
            <Link className="home-vat-period" href={`/finance/vat?period=${row.period}&country=${row.country}&currency=${row.currency}`}>{month(row.period)} · {row.country} · {row.currency}</Link>
            <span><span className="home-vat-label">Monthly VAT</span><span className="home-vat-number">{amount(row.balance)}</span></span>
            <span><span className="home-vat-label">Tax paid</span><span className="home-vat-number">{amount(row.paid)}</span></span>
            <span><span className="home-vat-label">Accumulated balance</span><strong className="home-vat-number">{amount(row.accumulated)}</strong></span>
          </div>)}
        </div>
      </details>
    </>}
  </section>;
}
