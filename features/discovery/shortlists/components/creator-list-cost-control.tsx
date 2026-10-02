"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { updateShortlistDetails } from "../actions";
import type { CreatorListCost } from "../creator-list-cost";

const formatAmount = (amount: number | null) => amount === null ? "" : amount.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function CreatorListCostControl({ shortlistId, value, disabled }: { shortlistId: string; value?: CreatorListCost; disabled: boolean }) {
  const initial = value ?? { amount: null, currency: "EGP", visible: false };
  const [amount, setAmount] = useState(formatAmount(initial.amount));
  const [currency, setCurrency] = useState(initial.currency);
  const [visible, setVisible] = useState(initial.visible);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const parse = () => {
    const clean = amount.replace(/,/g, "").trim();
    if (!clean) return null;
    return /^\d+(\.\d{0,2})?$/.test(clean) ? Number(clean) : NaN;
  };
  function save(nextVisible = visible) {
    const number = parse();
    if (number !== null && (!Number.isFinite(number) || number > 999999999999.99)) {
      toast.error("Enter an amount with up to two decimal places.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateShortlistDetails({ shortlistId, creatorListCost: { amount: number, currency, visible: nextVisible } });
        if (!result.ok) { toast.error(result.message); return; }
        setAmount(formatAmount(number));
        setVisible(nextVisible);
        toast.success(nextVisible ? "Total Avg Cost saved for the Creator List." : "Total Avg Cost saved and hidden from the Creator List.");
        router.refresh();
      } catch { toast.error("Could not save Total Avg Cost. Please retry."); }
    });
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); save(); }} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-slate-900 shadow-sm" aria-label="Creator List total average cost">
      <label htmlFor="creator-list-total-cost" className="text-xs font-semibold">Total Avg Cost</label>
      <input id="creator-list-total-cost" aria-label="Total Avg Cost amount" inputMode="decimal" value={amount} placeholder="0" disabled={disabled || pending}
        onChange={(event) => setAmount(event.target.value)} onBlur={() => { const parsed = parse(); if (parsed === null || Number.isFinite(parsed)) setAmount(formatAmount(parsed)); }}
        className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-right text-sm tabular-nums text-slate-900" />
      <select aria-label="Total Avg Cost currency" value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={disabled || pending} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900">
        {COMMERCIAL_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
      </select>
      <Switch checked={visible} onCheckedChange={(checked) => save(checked)} disabled={disabled || pending} aria-label="Show Total Avg Cost in Creator List" />
      <span className="text-xs text-slate-600">{visible ? "Shown" : "Hidden"}</span>
      <button type="submit" disabled={disabled || pending} className="h-8 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
