"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  FileTextIcon,
  LockIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import {
  approveLineForBillingAction,
  moveLineToBillingAction,
  requestFinanceOverrideAction,
  type BillingActionState,
} from "@/features/billing/actions";
import type { BillingLineRow } from "@/features/billing/types";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";

type CampaignBillingTabProps = {
  workspace: CampaignWorkspace;
  billingLines: BillingLineRow[];
};

export function CampaignBillingTab({
  workspace,
  billingLines,
}: CampaignBillingTabProps) {
  const { financials } = workspace;
  const currency = workspace.currency_code;
  const [invoiceOpen, setInvoiceOpen] = useState(false);

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

  const poWarnings = billingLines.filter((l) => l.po_over_consumed);

  return (
    <div className="space-y-4">
      {poWarnings.length > 0 ? (
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
          Billing lifecycle: draft → approved → moved to billing → invoiced → paid → closed
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/billing">Finance workspace</Link>
          </Button>
          <Button size="sm" onClick={() => setInvoiceOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Create invoice
          </Button>
        </div>
      </div>

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
          <CardTitle>Campaign line billing</CardTitle>
        </CardHeader>
        <CardContent>
          {billingLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaign lines.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">PO consumed</TableHead>
                    <TableHead>Locks</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingLines.map((line) => (
                    <CampaignLineBillingRow
                      key={line.id}
                      line={line}
                      campaignId={workspace.id}
                      currency={currency}
                    />
                  ))}
                </TableBody>
              </Table>
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

      <CreateInvoiceSheet
        campaignId={workspace.id}
        lines={billingLines}
        currency={currency}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
      />
    </div>
  );
}

function CampaignLineBillingRow({
  line,
  campaignId,
  currency,
}: {
  line: BillingLineRow;
  campaignId: string;
  currency: string;
}) {
  const cur = line.currency_code || currency;

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{line.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {line.document_number}
        </p>
      </TableCell>
      <TableCell>
        <BillingStatusBadge status={line.billing_status} />
      </TableCell>
      <TableCell className="text-right">{formatMoney(line.revenue, cur)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {line.po_over_consumed ? (
            <AlertTriangleIcon className="size-3.5 text-amber-500" />
          ) : null}
          <span>
            {formatMoney(line.po_consumed, cur)} / {formatMoney(line.po_amount, cur)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <LineLocks line={line} />
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
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        <LineBillingActions line={line} campaignId={campaignId} />
      </TableCell>
    </TableRow>
  );
}

function LineLocks({ line }: { line: BillingLineRow }) {
  const locks: string[] = [];
  if (line.revenue_locked) locks.push("Rev");
  if (line.cost_locked) locks.push("Cost");
  if (line.vendor_assignment_locked) locks.push("Vendor");

  if (locks.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {locks.map((l) => (
        <Badge key={l} variant="outline" className="gap-1 text-xs">
          <LockIcon className="size-3" />
          {l}
        </Badge>
      ))}
    </div>
  );
}

function LineBillingActions({
  line,
  campaignId,
}: {
  line: BillingLineRow;
  campaignId: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveLineForBillingAction,
    { ok: false } satisfies BillingActionState
  );
  const [moveState, moveAction, movePending] = useActionState(
    moveLineToBillingAction,
    { ok: false } satisfies BillingActionState
  );
  const [overrideState, overrideAction, overridePending] = useActionState(
    requestFinanceOverrideAction,
    { ok: false } satisfies BillingActionState
  );
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    for (const state of [approveState, moveState, overrideState]) {
      if (!state.message) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [approveState, moveState, overrideState]);

  const isLocked =
    line.revenue_locked || line.cost_locked || line.vendor_assignment_locked;

  return (
    <div className="flex flex-col items-end gap-1">
      {line.billing_status === "draft" ? (
        <form action={approveAction}>
          <input type="hidden" name="line_id" value={line.id} />
          <input type="hidden" name="campaign_id" value={campaignId} />
          <Button type="submit" size="sm" variant="outline" disabled={approvePending}>
            Approve
          </Button>
        </form>
      ) : null}
      {["approved", "draft"].includes(line.billing_status) && !line.invoice_id ? (
        <form action={moveAction}>
          <input type="hidden" name="line_id" value={line.id} />
          <input type="hidden" name="campaign_id" value={campaignId} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={movePending || line.po_over_consumed}
          >
            Move to billing
          </Button>
        </form>
      ) : null}
      {isLocked ? (
        showOverride ? (
          <form action={overrideAction} className="w-48 space-y-2 text-left">
            <input type="hidden" name="line_id" value={line.id} />
            <input type="hidden" name="campaign_id" value={campaignId} />
            <Textarea
              name="reason"
              placeholder="Override reason…"
              rows={2}
              className="text-xs"
              required
            />
            <Button type="submit" size="sm" variant="outline" disabled={overridePending}>
              Request override
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowOverride(true)}
          >
            Request override
          </Button>
        )
      ) : null}
    </div>
  );
}
