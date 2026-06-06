"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createClientCreditNoteAction,
  type FinanceAdjustmentActionState,
} from "@/features/finance/adjustments/actions";
import type { InvoiceSearchResult } from "@/features/finance/adjustments/types";
import { formatMoney } from "@/features/campaigns/utils";
import { computeAdjustmentVatAmounts } from "@/lib/finance/credit-note-vat";

type ClientCreditNoteWorkspaceProps = {
  invoices: InvoiceSearchResult[];
};

export function ClientCreditNoteWorkspace({ invoices }: ClientCreditNoteWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [vatAffected, setVatAffected] = useState(true);
  const [notes, setNotes] = useState("");

  const [state, formAction, pending] = useActionState(createClientCreditNoteAction, {
    ok: false,
  } satisfies FinanceAdjustmentActionState);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((inv) => {
      const haystack = [
        inv.document_number,
        inv.client_name,
        inv.brand_name,
        inv.campaign_document_number,
        inv.campaign_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [invoices, query]);

  const selected = invoices.find((inv) => inv.id === selectedId) ?? null;

  const preview = useMemo(() => {
    if (!selected) return null;
    const amount_before_vat = Number(amount) || 0;
    return computeAdjustmentVatAmounts({
      amount_before_vat,
      source_revenue_before_vat: selected.revenue_before_vat,
      source_vat_amount: selected.vat_amount,
      vat_affected: vatAffected,
    });
  }, [selected, amount, vatAffected]);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-4 rounded-3xl border p-4">
        <div>
          <h3 className="text-sm font-semibold">1. Search invoice</h3>
          <p className="text-xs text-muted-foreground">
            Filter by invoice number, campaign, client, or brand.
          </p>
        </div>
        <Input
          placeholder="Search invoices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching invoices.</p>
          ) : (
            filtered.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => setSelectedId(inv.id)}
                className={`w-full rounded-2xl border p-3 text-left transition hover:bg-muted/40 ${
                  selectedId === inv.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <DocumentNumber value={inv.document_number} />
                  <Badge variant="outline" className="text-[10px]">
                    {inv.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {inv.client_name}
                  {inv.campaign_document_number
                    ? ` · ${inv.campaign_document_number}`
                    : null}
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums">
                  {formatMoney(inv.total_after_vat, inv.currency)}
                </p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border p-4">
        <div>
          <h3 className="text-sm font-semibold">2. Create credit note</h3>
          <p className="text-xs text-muted-foreground">
            Serial assigned on save. Records are never deleted — cancel or void only.
          </p>
        </div>

        {!selected ? (
          <p className="text-sm text-muted-foreground">Select an invoice to continue.</p>
        ) : (
          <>
            <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
              <p className="font-medium">
                <DocumentNumber value={selected.document_number} />
              </p>
              <p className="text-xs text-muted-foreground">
                Revenue {formatMoney(selected.revenue_before_vat, selected.currency)} · VAT{" "}
                {formatMoney(selected.vat_amount, selected.currency)} · Total{" "}
                {formatMoney(selected.total_after_vat, selected.currency)}
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="invoice_id" value={selected.id} />
              <div className="grid gap-2">
                <Label htmlFor="issue_date">CN date</Label>
                <Input
                  id="issue_date"
                  name="issue_date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason">CN reason</Label>
                <Input
                  id="reason"
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount_before_vat">CN amount (before VAT)</Label>
                <Input
                  id="amount_before_vat"
                  name="amount_before_vat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="hidden" name="vat_affected" value={vatAffected ? "true" : "false"} />
                <input
                  id="vat_affected"
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={vatAffected}
                  onChange={(e) => setVatAffected(e.target.checked)}
                />
                <Label htmlFor="vat_affected">VAT affected (proportional reduction)</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {preview ? (
                <div className="rounded-2xl border p-3 text-sm">
                  <p className="text-muted-foreground">Total reduction</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatMoney(preview.amount_after_vat, selected.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Revenue −{formatMoney(preview.amount_before_vat, selected.currency)}
                    {preview.vat_amount > 0
                      ? ` · VAT −${formatMoney(preview.vat_amount, selected.currency)}`
                      : " · VAT unchanged"}
                  </p>
                </div>
              ) : null}

              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Create draft credit note"}
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
