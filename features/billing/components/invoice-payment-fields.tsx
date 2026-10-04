"use client";
import { useEffect, useState } from "react";
import { invoicePaymentOptionsAction } from "@/features/billing/payment-options-action";
import { invoiceMilestoneDueDate } from "@/lib/billing/invoice-payment-deadline";

export function InvoicePaymentFields({ campaignId }: { campaignId: string }) {
  const [context, setContext] = useState<Awaited<ReturnType<typeof invoicePaymentOptionsAction>>>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [eventDate, setEventDate] = useState("");
  useEffect(() => {
    let active = true;
    setLoaded(false); setError(""); setContext(null); setSelected(""); setEventDate("");
    invoicePaymentOptionsAction(campaignId).then(value => {
      if (!active) return;
      setContext(value); setSelected(value?.milestones.length === 1 ? value.milestones[0].id ?? "" : ""); setLoaded(true);
    }).catch(() => { if (active) { setError("Could not load Client IO payment terms. Reopen the invoice form to retry."); setLoaded(true); } });
    return () => { active = false; };
  }, [campaignId]);
  const milestone = context?.milestones.find(m => m.id === selected);
  const dueDate = milestone ? invoiceMilestoneDueDate(milestone, {
    invoiceDate: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }),
    approvedAt: context?.io.approved_at, sentAt: context?.io.sent_at, eventDate,
  }) : null;
  return <div className="space-y-2">
    <div className="text-sm font-medium">Client IO payment terms</div>
    {!loaded ? <p className="text-sm text-muted-foreground">Loading payment terms…</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {context?.terms ? <p className="text-xs text-muted-foreground">{context.terms}</p> : null}
    {!!context?.milestones.length && <label className="block text-sm">Payment milestone
      <select name="payment_milestone_id" value={selected} onChange={e => { setSelected(e.target.value); setEventDate(""); }} required className="mt-1 h-10 w-full rounded-md border bg-background px-3">
        <option value="">Choose the installment being invoiced</option>
        {context.milestones.map(m => <option key={m.id} value={m.id}>{m.label} · {m.percent}%</option>)}
      </select>
    </label>}
    {milestone && !milestone.dueDate && ["on_completion", "on_kickoff", "custom", "calendar_date"].includes(milestone.dueTrigger) && <label className="block text-sm">
      {milestone.dueTrigger === "on_completion" ? "Actual completion date" : milestone.dueTrigger === "on_kickoff" ? "Actual kickoff date" : "Agreed payment trigger date"}
      <input name="payment_event_date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required className="mt-1 h-10 w-full rounded-md border px-3" />
    </label>}
    {milestone ? <p className="text-sm">Due date: <strong>{dueDate ?? "Awaiting payment trigger date"}</strong></p> : !context?.milestones.length && loaded && !error ? <label className="block text-sm">Agreed due date<input name="due_date" type="date" className="mt-1 h-10 w-full rounded-md border px-3" required /></label> : null}
    {milestone && /net\s*\d+/i.test(milestone.label) ? <p className="text-xs text-muted-foreground">Net terms start from the invoice date.</p> : null}
    <p className="text-xs text-muted-foreground">This deadline is used for aging and payment-due alerts.</p>
  </div>;
}
