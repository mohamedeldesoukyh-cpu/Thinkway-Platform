"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

type PaymentAllocationSectionProps = {
  invoices: CollectionInvoiceRow[];
  currency: AnalyticsCurrencyContext;
};

export function PaymentAllocationSection({
  invoices,
}: PaymentAllocationSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [multiAmount, setMultiAmount] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});

  const open = invoices.filter((i) => i.outstanding > 0);
  const selectedInvoice = open.find((invoice) => invoice.id === invoiceId);

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
      else {
        toast.success(result.message ?? "Payment recorded.");
        setInvoiceId("");
        setAmount("");
        setReference("");
        setNotes("");
        router.refresh();
      }
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
      else {
        toast.success(result.message ?? "Payments allocated.");
        setMultiAmount("");
        setSelected({});
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">Record client payment</h3>
        <p className="text-sm text-muted-foreground">Select the client's invoice and enter the money received. Partial receipts update the invoice's remaining balance.</p>
        {open.length === 0 && <p className="text-sm text-muted-foreground">No invoices with an outstanding balance match your filters. Change the client filter or issue an invoice first.</p>}
        <div className="grid gap-2">
          <Label htmlFor="receipt-invoice" className="text-xs">Invoice</Label>
          <Select value={invoiceId} onValueChange={setInvoiceId}>
            <SelectTrigger id="receipt-invoice" className="h-9">
              <SelectValue placeholder="Select invoice" />
            </SelectTrigger>
            <SelectContent>
              {open.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {formatDocumentNumberForDisplay(inv.document_number)} — {inv.client_name} — {inv.currency} {inv.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          {selectedInvoice?.campaign_name && <p className="text-xs text-muted-foreground">Campaign: {selectedInvoice.campaign_name}</p>}
          <Label htmlFor="receipt-amount" className="text-xs">Amount received{selectedInvoice ? ` (${selectedInvoice.currency})` : ""}</Label>
          <Input id="receipt-amount" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="receipt-method" className="text-xs">Payment method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger id="receipt-method"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              <SelectItem value="wire">Wire transfer</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="credit_card">Credit card</SelectItem>
              <SelectItem value="debit_card">Debit card</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="receipt-reference" className="text-xs">Bank / payment reference</Label>
          <Input id="receipt-reference" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="receipt-notes" className="text-xs">Notes or proof link</Label>
          <Textarea id="receipt-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <Button type="button" size="sm" disabled={isPending || !selectedInvoice || !Number.isFinite(Number(amount)) || Number(amount) <= 0} onClick={recordSingle}>
          {isPending ? "Recording…" : "Record payment"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">Split one receipt across invoices</h3>
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
              <span className="min-w-0 flex-1 whitespace-normal break-words">
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
