"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allocatePaymentsAction,
  recordCollectionPaymentFromWorkspaceAction,
} from "@/features/collections/actions";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

type PaymentAllocationSectionProps = {
  invoices: CollectionInvoiceRow[];
  currency: AnalyticsCurrencyContext;
};

export function PaymentAllocationSection({
  invoices,
  currency,
}: PaymentAllocationSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [multiAmount, setMultiAmount] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});

  const open = invoices.filter((i) => i.outstanding > 0);
  const format = (n: number) => formatAnalyticsAmount(n, currency);

  const recordSingle = () => {
    const fd = new FormData();
    fd.set("invoice_id", invoiceId);
    fd.set("amount", amount);
    fd.set("payment_method", method);
    fd.set("reference_number", reference);
    fd.set("notes", notes);
    startTransition(async () => {
      const result = await recordCollectionPaymentFromWorkspaceAction(fd);
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message ?? "Payment recorded.");
    });
  };

  const allocateMulti = () => {
    const total = Number.parseFloat(multiAmount) || 0;
    const allocations = Object.entries(selected)
      .filter(([, amt]) => Number.parseFloat(amt) > 0)
      .map(([invoiceId, amt]) => ({
        invoiceId,
        amount: Number.parseFloat(amt),
      }));
    startTransition(async () => {
      const result = await allocatePaymentsAction({
        paymentAmount: total,
        paymentMethod: method,
        referenceNumber: reference,
        notes,
        allocations,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message ?? "Payments allocated.");
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">Record payment</h3>
        <div className="grid gap-2">
          <Label className="text-xs">Invoice</Label>
          <Select value={invoiceId} onValueChange={setInvoiceId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select invoice" />
            </SelectTrigger>
            <SelectContent>
              {open.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {formatDocumentNumberForDisplay(inv.document_number)} — {format(inv.outstanding)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Amount</Label>
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Notes / proof</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <Button type="button" size="sm" disabled={isPending || !invoiceId} onClick={recordSingle}>
          Mark paid / partial
        </Button>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">Split allocation</h3>
        <div className="grid gap-2">
          <Label className="text-xs">Total receipt amount</Label>
          <Input
            type="number"
            min={0}
            value={multiAmount}
            onChange={(e) => setMultiAmount(e.target.value)}
          />
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {open.slice(0, 15).map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {formatDocumentNumberForDisplay(inv.document_number)}
              </span>
              <Input
                className="h-8 w-24"
                type="number"
                min={0}
                placeholder="0"
                value={selected[inv.id] ?? ""}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, [inv.id]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={allocateMulti}>
          Allocate payments
        </Button>
      </div>
    </div>
  );
}
