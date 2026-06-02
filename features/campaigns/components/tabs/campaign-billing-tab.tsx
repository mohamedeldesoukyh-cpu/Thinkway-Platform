"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  FileTextIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignmentBillingGroupsTable } from "@/features/billing/components/assignment-billing-groups-table";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
import type {
  AssignmentBillingGroup,
  BillingLineRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

function formatBillingDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

function formatBillingDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

type CampaignBillingTabProps = {
  workspace: CampaignWorkspace;
  billingLines: BillingLineRow[];
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
};

export function CampaignBillingTab({
  workspace,
  billingLines,
  billingGroups,
  operationalBilling,
}: CampaignBillingTabProps) {
  const { financials, po } = workspace;
  const currency = workspace.currency_code;
  const [legacyInvoiceOpen, setLegacyInvoiceOpen] = useState(false);
  const [operationalInvoiceOpen, setOperationalInvoiceOpen] = useState(false);

  const poAlert =
    financials.po_exceeded || po.po_status === "exceeded"
      ? "danger"
      : po.po_status === "near_limit"
        ? "warning"
        : null;

  const summary = [
    {
      label: "PO total",
      value: formatMoney(financials.po_total, currency),
      alert: poAlert,
    },
    {
      label: "PO consumed",
      value: formatMoney(financials.po_consumed, currency),
      alert: poAlert,
    },
    {
      label: "Remaining PO",
      value: formatMoney(financials.remaining_po, currency),
      alert: poAlert,
    },
    { label: "Revenue", value: formatMoney(financials.revenue, currency) },
    { label: "Collected", value: formatMoney(financials.collected, currency) },
    {
      label: "Outstanding",
      value: formatMoney(financials.billing_outstanding, currency),
    },
    { label: "Margin", value: formatPercent(financials.margin_percent ?? 0) },
  ];

  const poWarnings = billingLines.filter((l) => l.po_over_consumed);
  const headerPoExceeded = financials.po_exceeded;

  return (
    <div className="space-y-4">
      {headerPoExceeded ? (
        <div className="flex items-start gap-2 rounded-3xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Campaign PO exceeded</p>
            <p>
              Consumed {formatMoney(financials.po_consumed, currency)} exceeds approved PO{" "}
              {formatMoney(financials.po_total, currency)}. Finance override may be required.
            </p>
          </div>
        </div>
      ) : poWarnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">PO over-consumption warning</p>
            <p>
              {poWarnings.length} line{poWarnings.length === 1 ? "" : "s"} exceed
              PO allocation. Finance override required before billing.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Billing lifecycle: draft → approved → moved to billing → partially invoiced → invoiced → paid → closed
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/billing">Finance workspace</Link>
          </Button>
          <Button
            size="sm"
            onClick={() =>
              operationalBilling ? setOperationalInvoiceOpen(true) : setLegacyInvoiceOpen(true)
            }
          >
            <PlusIcon data-icon="inline-start" />
            Create invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => (
          <Card
            key={item.label}
            className={cn(
              item.alert === "danger" &&
                "border-red-500/50 bg-red-500/5 dark:bg-red-500/10",
              item.alert === "warning" &&
                "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "font-heading text-2xl font-semibold tracking-tight",
                  item.alert === "danger" && "text-red-600 dark:text-red-400",
                  item.alert === "warning" && "text-amber-700 dark:text-amber-300"
                )}
              >
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational billing</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {operationalBilling ? (
            <BillingCampaignDrilldown
              detail={operationalBilling}
              onInvoice={() => setOperationalInvoiceOpen(true)}
            />
          ) : (
            <div className="p-4">
              <AssignmentBillingGroupsTable
                groups={billingGroups}
                billingLines={billingLines}
                currency={currency}
                campaignId={workspace.id}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {workspace.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices linked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Issue date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/billing/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
                        >
                          <FileTextIcon className="size-3" />
                          {inv.document_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatBillingDate(inv.issue_date)}</TableCell>
                      <TableCell>{formatBillingDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(inv.total, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(inv.amount_paid, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(inv.outstanding, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {workspace.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.document_number}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.invoice_document_number}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatBillingDateTime(p.paid_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceSheet
        campaignId={workspace.id}
        groups={billingGroups}
        currency={currency}
        open={legacyInvoiceOpen}
        onOpenChange={setLegacyInvoiceOpen}
      />

      {operationalBilling ? (
        <InvoiceGenerationSheet
          campaignId={workspace.id}
          currency={operationalBilling.currency_code}
          rollup={operationalBilling.rollup}
          operationalRows={operationalBilling.operational_rows}
          appendableInvoices={operationalBilling.appendable_invoices}
          open={operationalInvoiceOpen}
          onOpenChange={setOperationalInvoiceOpen}
        />
      ) : null}
    </div>
  );
}
