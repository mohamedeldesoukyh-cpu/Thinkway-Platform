import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import type { InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type InvoiceHtmlPreviewProps = {
  invoice: InvoiceWorkspace;
  backHref?: string;
};

export function InvoiceHtmlPreview({ invoice, backHref }: InvoiceHtmlPreviewProps) {
  const issueDate = new Date(`${invoice.issue_date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dueDate = invoice.due_date
    ? new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-8 text-foreground shadow-sm print:border-0 print:shadow-none">
      {backHref ? (
        <div className="mb-6 print:hidden">
          <Link href={backHref} className="text-sm text-primary hover:underline">
            ← Back to invoice
          </Link>
        </div>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1D9E75]">
            Thinkway
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Operational tax invoice (preview)</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold tracking-tight">
            <DocumentNumber value={invoice.document_number} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Issue date: {issueDate}</p>
          <p className="text-sm text-muted-foreground">Due date: {dueDate}</p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Bill to</p>
          <p className="mt-1 font-medium">{invoice.client.name}</p>
          <p className="text-sm text-muted-foreground">
            <DocumentNumber value={invoice.client.document_number} />
          </p>
        </div>
        {invoice.campaign ? (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Campaign</p>
            <p className="mt-1 font-medium">{invoice.campaign.name}</p>
            <p className="text-sm text-muted-foreground">
              <DocumentNumber value={invoice.campaign.document_number} />
            </p>
          </div>
        ) : null}
      </section>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Unit (ex-VAT)</th>
            <th className="py-2 pr-2 text-right">VAT</th>
            <th className="py-2 text-right">Line total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id} className="border-b border-border/60">
              <td className="py-2.5 pr-2">
                <p>{line.description}</p>
                {line.line_document_number ? (
                  <p className="text-xs text-muted-foreground">
                    <DocumentNumber value={line.line_document_number} />
                  </p>
                ) : null}
              </td>
              <td className="py-2.5 pr-2 text-right tabular-nums">{line.quantity}</td>
              <td className="py-2.5 pr-2 text-right tabular-nums">
                {formatBillingMoney(line.revenue_before_vat, invoice.currency)}
              </td>
              <td className="py-2.5 pr-2 text-right tabular-nums">
                {line.revenue_vat_exempt
                  ? "Exempt"
                  : formatBillingMoney(line.revenue_vat_amount, invoice.currency)}
              </td>
              <td className="py-2.5 text-right tabular-nums font-medium">
                {formatBillingMoney(line.line_total, invoice.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-8 flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal (ex-VAT)</dt>
            <dd className="tabular-nums font-medium">
              {formatBillingMoney(invoice.subtotal, invoice.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">VAT</dt>
            <dd className="tabular-nums font-medium">
              {formatBillingMoney(invoice.tax_amount, invoice.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base">
            <dt className="font-semibold">Total</dt>
            <dd className="tabular-nums font-semibold">
              {formatBillingMoney(invoice.total, invoice.currency)}
            </dd>
          </div>
          {invoice.amount_paid > 0 ? (
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Paid</dt>
              <dd className="tabular-nums">
                {formatBillingMoney(invoice.amount_paid, invoice.currency)}
              </dd>
            </div>
          ) : null}
        </dl>
      </footer>

      {invoice.notes ? (
        <section className="mt-8 rounded-lg bg-muted/40 p-4 text-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
        </section>
      ) : null}

      <p className="mt-8 text-center text-xs text-muted-foreground print:mt-12">
        Preview only — Phase 2b will add downloadable PDF export.
      </p>
    </article>
  );
}
