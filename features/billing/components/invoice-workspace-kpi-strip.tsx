"use client";

import { FinanceSuiteKpiStrip, type FinanceSuiteKpiItem } from "@/components/finance/suite";
import type { InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { format } from "date-fns";

type InvoiceWorkspaceKpiStripProps = {
  invoice: InvoiceWorkspace;
};

function outputVatHint(invoice: InvoiceWorkspace): string {
  const n = invoice.lines.length;
  const lineLabel = n === 1 ? "line" : "lines";
  if (n === 0) return "no lines";

  const percents = new Set(
    invoice.lines.map((line) =>
      line.revenue_vat_exempt ? "exempt" : String(line.revenue_vat_percent)
    )
  );
  if (percents.size === 1) {
    const only = [...percents][0];
    if (only === "exempt") return `exempt on ${n} ${lineLabel}`;
    return `${only}% on ${n} ${lineLabel}`;
  }
  return `VAT on ${n} ${lineLabel}`;
}

export function InvoiceWorkspaceKpiStrip({ invoice }: InvoiceWorkspaceKpiStripProps) {
  const currency = invoice.currency;
  const dueMissing = !invoice.due_date;
  const dueDate = invoice.due_date
    ? format(new Date(`${invoice.due_date}T00:00:00`), "MMM d, yyyy")
    : "Not set";
  const outstandingPct =
    invoice.total > 0 ? Math.round((invoice.outstanding / invoice.total) * 100) : 0;
  const paymentEvents = invoice.activity.filter(
    (item) => item.entity_type === "payments" || item.entity_type === "payment"
  ).length;
  const collectedHint =
    paymentEvents === 1
      ? "1 payment event in audit"
      : `${paymentEvents} payment events in audit`;

  const items: FinanceSuiteKpiItem[] = [
    {
      id: "subtotal",
      label: "Subtotal (ex-VAT)",
      value: formatBillingMoney(invoice.subtotal, currency),
    },
    {
      id: "vat",
      label: "Output VAT",
      value: formatBillingMoney(invoice.tax_amount, currency),
      hint: outputVatHint(invoice),
    },
    {
      id: "total",
      label: "Grand total",
      value: formatBillingMoney(invoice.total, currency),
      hint: "ex-VAT + VAT",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: formatBillingMoney(invoice.outstanding, currency),
      hint: `${outstandingPct}% of the invoice`,
      tone: invoice.outstanding > 0 ? "bad" : "ok",
    },
    {
      id: "collected",
      label: "Collected",
      value: formatBillingMoney(invoice.amount_paid, currency),
      hint: collectedHint,
      tone: paymentEvents > 0 && invoice.amount_paid === 0 ? "bad" : undefined,
    },
    {
      id: "due-date",
      label: "Due date",
      value: dueDate,
      hint: dueMissing ? "cannot be aged or chased" : undefined,
      tone: dueMissing ? "bad" : undefined,
    },
  ];

  return <FinanceSuiteKpiStrip items={items} />;
}
