"use client";

import {
  BanknoteIcon,
  CalendarIcon,
  CoinsIcon,
  FileTextIcon,
  PercentIcon,
  ReceiptIcon,
} from "lucide-react";

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { format } from "date-fns";

type InvoiceWorkspaceKpiStripProps = {
  invoice: InvoiceWorkspace;
};

export function InvoiceWorkspaceKpiStrip({ invoice }: InvoiceWorkspaceKpiStripProps) {
  const currency = invoice.currency;
  const dueDate = invoice.due_date
    ? format(new Date(`${invoice.due_date}T00:00:00`), "MMM d, yyyy")
    : "—";

  const items: KpiCarouselItem[] = [
    {
      id: "subtotal",
      label: "Subtotal (ex-VAT)",
      value: formatBillingMoney(invoice.subtotal, currency),
      icon: ReceiptIcon,
      accentKey: "blue",
    },
    {
      id: "vat",
      label: "Output VAT",
      value: formatBillingMoney(invoice.tax_amount, currency),
      icon: PercentIcon,
      accentKey: "purple",
    },
    {
      id: "total",
      label: "Grand total",
      value: formatBillingMoney(invoice.total, currency),
      icon: FileTextIcon,
      accentKey: "pink",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: formatBillingMoney(invoice.outstanding, currency),
      icon: CoinsIcon,
      accentKey: "green",
      valueAlert: invoice.outstanding > 0 ? "warning" : undefined,
    },
    {
      id: "collected",
      label: "Collected",
      value: formatBillingMoney(invoice.amount_paid, currency),
      icon: BanknoteIcon,
      accentKey: "blue",
    },
    {
      id: "due-date",
      label: "Due date",
      value: dueDate,
      icon: CalendarIcon,
      accentKey: "purple",
    },
  ];

  return <KpiStrip items={items} showNavigation={false} />;
}
