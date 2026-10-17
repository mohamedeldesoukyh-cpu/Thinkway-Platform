"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalDetailSheet, OperationalDetailCommandBar, DetailField } from "./operational-detail-panel";
import { getCampaignRevenueShareAction, saveCampaignRevenueShareAction } from "../actions/revenue-share-actions";
import type { RevenueShare } from "@/lib/campaigns/revenue-share";
import { formatMoney } from "../utils";

type Loaded = Extract<Awaited<ReturnType<typeof getCampaignRevenueShareAction>>, { ok: true }>["data"];

export function CampaignRevenueShare({ campaignId, share, amountLabel }: {
  campaignId: string; share?: RevenueShare | null; amountLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function load() {
    setOpen(true); setError(""); setData(null);
    startTransition(async () => {
      try {
        const result = await getCampaignRevenueShareAction(campaignId);
        if (result.ok) setData(result.data); else setError(result.message);
      } catch { setError("Unable to load revenue share. Please try again."); }
    });
  }
  return <>
    <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      aria-label="Edit campaign revenue share" onClick={load}>
      {amountLabel ?? (share ? share.mode === "percent" ? `${share.value}%` : formatMoney(share.value, share.currency) : "Add share")}
    </button>
    <OperationalDetailSheet open={open} onOpenChange={setOpen} title="Revenue share" description="Campaign revenue share and profit" variant="detail" dismissOnFocusOutside={false}>
      <OperationalDetailCommandBar contextLabel="Revenue share" contextHandle={data?.document_number}
        title={data?.name ?? "Campaign revenue share"} subtitle="Internal · Agency, client or commission deduction" />
      {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<Button variant="outline" onClick={load}>Retry</Button></div>}
      {pending && !data && <p role="status" className="p-6">Loading campaign financials…</p>}
      {data && <RevenueShareForm key={data.updated_at} data={data} onSaved={() => { setOpen(false); router.refresh(); }} />}
    </OperationalDetailSheet>
  </>;
}

function RevenueShareForm({ data, onSaved }: { data: Loaded; onSaved: () => void }) {
  const [mode, setMode] = useState<"amount" | "percent">(data.share?.mode ?? "amount");
  const [value, setValue] = useState(String(data.share?.mode === "percent" ? data.share.value : data.amount));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const numeric = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(numeric) && numeric >= 0;
  const amount = valid ? Math.round((mode === "percent" ? data.revenue * numeric / 100 : numeric) * 100) / 100 : 0;
  const percent = data.revenue > 0 ? amount / data.revenue * 100 : 0;
  const gp = Math.round((data.gp - amount) * 100) / 100;
  const margin = data.revenue > 0 ? gp / data.revenue * 100 : 0;
  const money = (n: number) => formatMoney(n, data.currency);
  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
    event.preventDefault(); setError("");
    startTransition(async () => {
      try {
        const result = await saveCampaignRevenueShareAction({ campaignId: data.id, currency: data.currency,
          updated_at: data.updated_at, mode, value: numeric });
        if (result.ok) onSaved(); else setError(result.message);
      } catch { setError("Unable to save revenue share. Please try again."); }
    });
  }}>
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      <section className="rounded-2xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Campaign financials</h3>
        <DetailField label="Revenue including agency fees & FX">{money(data.revenue)}</DetailField>
        <DetailField label="Cost including usage rights">{money(data.cost)}</DetailField>
        <DetailField label="GP before revenue share">{money(data.gp)}</DetailField>
        <DetailField label="GP margin before revenue share">{data.revenue > 0 ? (data.gp / data.revenue * 100).toFixed(2) : "0.00"}%</DetailField>
      </section>
      <section className="space-y-4 rounded-2xl border bg-white p-4">
        <h3 className="font-semibold">Revenue share</h3>
        <p className="text-sm text-muted-foreground">Edit either field. The last field edited determines whether the share stays a fixed amount or follows revenue as a percentage.</p>
        <label className="block space-y-2 text-sm font-medium">Amount ({data.currency})
          <Input type="number" min="0" step="0.01" disabled={pending} value={mode === "amount" ? value : amount}
            onChange={e => { setMode("amount"); setValue(e.target.value); }} />
        </label>
        <label className="block space-y-2 text-sm font-medium">Percentage of revenue (%)
          <Input type="number" min="0" step="any" disabled={pending} value={mode === "percent" ? value : Number(percent.toFixed(6))}
            onChange={e => { setMode("percent"); setValue(e.target.value); }} />
        </label>
        <p className="text-xs text-muted-foreground">Saving as {mode === "percent" ? "a percentage of revenue" : `a fixed ${data.currency} amount`}. Enter 0 to remove the deduction.</p>
      </section>
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-live="polite">
        <DetailField label="Revenue share deduction">{money(amount)}</DetailField>
        <DetailField label="GP after revenue share">{money(gp)}</DetailField>
        <DetailField label="GP margin after revenue share">{margin.toFixed(2)}%</DetailField>
        <DetailField label="Markup / FM after revenue share">{data.cost > 0 ? `${(gp / data.cost * 100).toFixed(2)}%` : "—"}</DetailField>
      </section>
      <p className="text-xs text-muted-foreground">P&L deducts this share proportionally as revenue goes live. VR refund remains a separate deduction.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
    <div className="border-t bg-white p-5"><Button type="submit" disabled={pending || !valid}>{pending ? "Saving…" : "Save revenue share"}</Button></div>
  </form>;
}
