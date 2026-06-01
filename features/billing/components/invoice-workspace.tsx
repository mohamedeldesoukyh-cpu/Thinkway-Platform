"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CollectionStatusBadge,
} from "@/features/billing/components/billing-status-badge";
import { InvoiceRegenerationPanel } from "@/features/billing/components/invoice-regeneration-panel";
import {
  recordCollectionPaymentAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { FINANCIAL_APPROVAL_STAGE_LABELS } from "@/features/billing/constants";
import type { InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { Badge } from "@/components/ui/badge";

type InvoiceWorkspaceViewProps = {
  invoice: InvoiceWorkspace;
};

export function InvoiceWorkspaceView({ invoice }: InvoiceWorkspaceViewProps) {
  const [paymentState, paymentAction, paymentPending] = useActionState(
    recordCollectionPaymentAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!paymentState.message) return;
    if (paymentState.ok) toast.success(paymentState.message);
    else toast.error(paymentState.message);
  }, [paymentState]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/billing">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to billing
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {invoice.document_number}
          </h2>
          <CollectionStatusBadge status={invoice.collection_status} />
          <Badge variant="outline" className="capitalize">
            {invoice.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {invoice.client.name}
          {invoice.campaign ? ` · ${invoice.campaign.name}` : null}
        </p>
      </div>

      <InvoiceRegenerationPanel invoice={invoice} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total" value={formatBillingMoney(invoice.total, invoice.currency)} />
        <SummaryCard
          label="Collected"
          value={formatBillingMoney(invoice.amount_paid, invoice.currency)}
        />
        <SummaryCard
          label="Outstanding"
          value={formatBillingMoney(invoice.outstanding, invoice.currency)}
        />
        <SummaryCard
          label="Due date"
          value={
            invoice.due_date
              ? format(new Date(`${invoice.due_date}T00:00:00`), "MMM d, yyyy")
              : "—"
          }
        />
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lines">Line items</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="activity">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice lines</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pulled from campaign lines · revenue locked on invoicing
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign line</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs">
                        {line.line_document_number ?? "—"}
                      </TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatBillingMoney(line.unit_price, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBillingMoney(line.line_total, invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          {invoice.outstanding > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record payment</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={paymentAction} className="grid max-w-md gap-4">
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={invoice.outstanding}
                      defaultValue={invoice.outstanding}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Method</Label>
                    <Select name="payment_method" defaultValue="bank_transfer">
                      <SelectTrigger id="payment_method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        <SelectItem value="wire">Wire</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="credit_card">Credit card</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reference_number">Reference</Label>
                    <Input id="reference_number" name="reference_number" />
                  </div>
                  <Button type="submit" disabled={paymentPending}>
                    Record collection
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">
                          {p.document_number}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBillingMoney(p.amount, p.currency)}
                        </TableCell>
                        <TableCell className="capitalize">
                          {p.payment_method.replace("_", " ")}
                        </TableCell>
                        <TableCell className="capitalize">{p.status}</TableCell>
                        <TableCell>
                          {p.paid_at
                            ? format(new Date(p.paid_at), "MMM d, yyyy HH:mm")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval chain</CardTitle>
              <p className="text-sm text-muted-foreground">
                Finance → CFO/Admin
              </p>
            </CardHeader>
            <CardContent>
              {invoice.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval requests.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decided</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {FINANCIAL_APPROVAL_STAGE_LABELS[a.approval_stage]}
                        </TableCell>
                        <TableCell>{a.title}</TableCell>
                        <TableCell className="capitalize">{a.status}</TableCell>
                        <TableCell>
                          {a.decided_at
                            ? format(new Date(a.decided_at), "MMM d, yyyy")
                            : "Pending"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries.</p>
              ) : (
                <ul className="space-y-3">
                  {invoice.activity.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.actor?.full_name ?? item.actor?.email ?? "System"}
                        </p>
                      </div>
                      <time className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
