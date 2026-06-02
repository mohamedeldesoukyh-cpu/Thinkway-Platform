"use client";

import type { ClientStatementPayload } from "@/lib/collections/queries/client-statements";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import { AGING_BUCKET_LABELS } from "@/lib/collections/aging";

type ClientStatementViewProps = {
  statement: ClientStatementPayload | null;
};

/** Export/PDF-ready grouped statement (HTML structure only). */
export function ClientStatementView({ statement }: ClientStatementViewProps) {
  if (!statement) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a client in filters to generate an AR statement.
      </p>
    );
  }

  const currency = {
    primary_currency: statement.currency,
    is_mixed_currency: false,
    currencies: [statement.currency],
    mixed_label: null,
  };
  const format = (n: number) => formatAnalyticsAmount(n, currency);

  return (
    <article
      className="rounded-2xl border border-border bg-card p-6 print:border-0 print:shadow-none"
      data-statement-export
    >
      <header className="border-b border-border pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Accounts receivable statement
        </p>
        <h2 className="font-heading text-xl font-semibold">{statement.client_name}</h2>
        <p className="text-xs text-muted-foreground">
          Generated {new Date(statement.generated_at).toLocaleString()} · {statement.currency}
        </p>
      </header>

      <section className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Invoiced</p>
          <p className="font-semibold">{format(statement.summary.total_invoiced)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="font-semibold">{format(statement.summary.total_collected)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="font-semibold">{format(statement.summary.total_outstanding)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="font-semibold text-red-600">
            {format(statement.summary.overdue_amount)}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-medium">Aging</h3>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-5">
          {statement.aging_buckets.map((b) => (
            <li key={b.bucket}>
              {AGING_BUCKET_LABELS[b.bucket]}: {format(b.amount)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-medium">Open invoices</h3>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2">Document</th>
              <th>Due</th>
              <th className="text-right">Outstanding</th>
              <th>Aging</th>
            </tr>
          </thead>
          <tbody>
            {statement.invoices
              .filter((i) => i.outstanding > 0)
              .map((inv) => (
                <tr key={inv.document_number} className="border-b border-border/60">
                  <td className="py-2 font-mono">{inv.document_number}</td>
                  <td>{inv.due_date ?? "—"}</td>
                  <td className="text-right">{format(inv.outstanding)}</td>
                  <td>{AGING_BUCKET_LABELS[inv.aging_bucket as keyof typeof AGING_BUCKET_LABELS] ?? inv.aging_bucket}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-medium">Recent payments</h3>
        <ul className="mt-2 space-y-1 text-xs">
          {statement.payments.slice(0, 10).map((p) => (
            <li key={p.document_number}>
              {p.document_number} · {format(p.amount)}
              {p.paid_at ? ` · ${p.paid_at.slice(0, 10)}` : ""}
              {p.reference_number ? ` · ref ${p.reference_number}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
