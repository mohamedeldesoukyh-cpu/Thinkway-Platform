"use client";

import Link from "next/link";
import { AlertTriangleIcon, LockIcon } from "lucide-react";

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
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import type { BillingLineRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";

type BillingLinesTableProps = {
  lines: BillingLineRow[];
  showCampaign?: boolean;
  currency?: string;
};

export function BillingLinesTable({
  lines,
  showCampaign = true,
  currency = "USD",
}: BillingLinesTableProps) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No campaign lines in billing scope.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            {showCampaign ? <TableHead>Campaign</TableHead> : null}
            <TableHead>Client</TableHead>
            <TableHead>Billing status</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">GP</TableHead>
            <TableHead className="text-right">PO / consumed</TableHead>
            <TableHead>Locks</TableHead>
            <TableHead>Invoice</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const cur = line.currency_code || currency;
            return (
              <TableRow key={line.id}>
                <TableCell>
                  <p className="font-medium">{line.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {line.document_number}
                  </p>
                </TableCell>
                {showCampaign ? (
                  <TableCell>
                    <Link
                      href={`/campaigns/${line.campaign_header_id}?tab=billing`}
                      className="text-sm hover:underline"
                    >
                      {line.campaign_name}
                    </Link>
                  </TableCell>
                ) : null}
                <TableCell className="max-w-[120px] truncate text-sm">
                  {line.client_name}
                </TableCell>
                <TableCell>
                  <BillingStatusBadge status={line.billing_status} />
                </TableCell>
                <TableCell className="text-right">
                  {formatBillingMoney(line.revenue, cur)}
                </TableCell>
                <TableCell className="text-right">
                  {formatBillingMoney(line.cost, cur)}
                </TableCell>
                <TableCell className="text-right">
                  <span>{formatBillingMoney(line.gp, cur)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({formatPercent(line.margin_percent)})
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {line.po_over_consumed ? (
                      <AlertTriangleIcon className="size-3.5 text-amber-500" />
                    ) : null}
                    <span className="text-sm">
                      {formatBillingMoney(line.po_consumed, cur)} /{" "}
                      {formatBillingMoney(line.po_amount, cur)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBillingMoney(line.remaining_po, cur)} remaining
                  </p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {line.revenue_locked ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <LockIcon className="size-3" />
                        Rev
                      </Badge>
                    ) : null}
                    {line.cost_locked ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <LockIcon className="size-3" />
                        Cost
                      </Badge>
                    ) : null}
                    {line.vendor_assignment_locked ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <LockIcon className="size-3" />
                        Vendor
                      </Badge>
                    ) : null}
                    {!line.revenue_locked &&
                    !line.cost_locked &&
                    !line.vendor_assignment_locked ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {line.invoice_id ? (
                    <Link
                      href={`/billing/invoices/${line.invoice_id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {line.invoice_document_number}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

type BillingLinesCardProps = BillingLinesTableProps & {
  title?: string;
};

export function BillingLinesCard({
  lines,
  showCampaign = true,
  title = "Campaign line billing",
}: BillingLinesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <BillingLinesTable lines={lines} showCampaign={showCampaign} />
      </CardContent>
    </Card>
  );
}
