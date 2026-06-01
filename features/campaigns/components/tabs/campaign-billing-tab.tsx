"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";

type CampaignBillingTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignBillingTab({ workspace }: CampaignBillingTabProps) {
  const { financials } = workspace;
  const currency = workspace.currency_code;

  const summary = [
    { label: "PO total", value: formatMoney(financials.po_total, currency) },
    {
      label: "Remaining PO",
      value: formatMoney(financials.remaining_po, currency),
    },
    { label: "Revenue", value: formatMoney(financials.revenue, currency) },
    { label: "Collected", value: formatMoney(financials.collected, currency) },
    {
      label: "Outstanding",
      value: formatMoney(financials.billing_outstanding, currency),
    },
    { label: "Margin", value: formatPercent(financials.margin_percent) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                      <TableCell className="font-mono text-xs">
                        {inv.document_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(`${inv.issue_date}T00:00:00`), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {inv.due_date
                          ? format(new Date(`${inv.due_date}T00:00:00`), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
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
                        {p.paid_at
                          ? format(new Date(p.paid_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
