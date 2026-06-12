"use client";

import {
  BanknoteIcon,
  CalendarIcon,
  CoinsIcon,
  FileTextIcon,
  PercentIcon,
  ReceiptIcon,
  type LucideIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { format } from "date-fns";

type InvoiceWorkspaceKpiStripProps = {
  invoice: InvoiceWorkspace;
};

type KpiAccent = "blue" | "purple" | "pink" | "green";

const ACCENT_TILE: Record<KpiAccent, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
};

export function InvoiceWorkspaceKpiStrip({ invoice }: InvoiceWorkspaceKpiStripProps) {
  const currency = invoice.currency;
  const dueDate = invoice.due_date
    ? format(new Date(`${invoice.due_date}T00:00:00`), "MMM d, yyyy")
    : "—";

  const items = [
    {
      id: "subtotal",
      label: "Subtotal (ex-VAT)",
      value: formatBillingMoney(invoice.subtotal, currency),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "vat",
      label: "Output VAT",
      value: formatBillingMoney(invoice.tax_amount, currency),
      icon: PercentIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "total",
      label: "Grand total",
      value: formatBillingMoney(invoice.total, currency),
      icon: FileTextIcon,
      accentClass: ACCENT_TILE.pink,
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: formatBillingMoney(invoice.outstanding, currency),
      icon: CoinsIcon,
      accentClass: ACCENT_TILE.green,
      valueAlert: invoice.outstanding > 0 ? ("warning" as const) : undefined,
    },
    {
      id: "collected",
      label: "Collected",
      value: formatBillingMoney(invoice.amount_paid, currency),
      icon: BanknoteIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "due-date",
      label: "Due date",
      value: dueDate,
      icon: CalendarIcon,
      accentClass: ACCENT_TILE.purple,
    },
  ] satisfies {
    id: string;
    label: string;
    value: string;
    icon: LucideIcon;
    accentClass: string;
    valueAlert?: "warning" | "danger";
  }[];

  return <KpiCarousel items={items} showNavigation={false} />;
}
