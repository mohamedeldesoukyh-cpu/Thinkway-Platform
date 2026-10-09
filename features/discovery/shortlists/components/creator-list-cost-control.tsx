
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const [feedback, setFeedback] = useState("");
  const [invalid, setInvalid] = useState(false);
  const parse = () => {
    const clean = amount.replace(/,/g, "").trim();
    if (!clean) return null;
    return /^\d+(\.\d{0,2})?$/.test(clean) ? Number(clean) : NaN;
  };
  function save(nextVisible = visible) {
    const number = parse();
    if (number !== null && (!Number.isFinite(number) || number > 999999999999.99)) {
      setInvalid(true); setFeedback(amount.trim().startsWith("-") ? "Must be 0 or more" : "Enter a valid amount with max 2 decimals");
      return;
    }
    setInvalid(false); setFeedback("");
    startTransition(async () => {
      try {
        const result = await updateShortlistDetails({ shortlistId, creatorListCost: { amount: number, currency, visible: nextVisible } });
        if (!result.ok) { setFeedback(result.message ?? "Could not save. Please retry."); setInvalid(true); return; }
        setAmount(formatAmount(number));
        setVisible(nextVisible);
        setFeedback("Saved");
        toast.success(nextVisible ? "Total Avg Cost saved for the Creator List." : "Total Avg Cost saved and hidden from the Creator List.");
        router.refresh();
      } catch { setInvalid(true); setFeedback("Could not save. Please retry."); }
    });
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); save(); }} className="sl-tac" aria-label="Creator List total average cost">
      <div><label htmlFor="creator-list-total-cost" className="sl-tac__l">Total Avg Cost</label><small className="sl-cost-caption">manually entered</small></div>
      <input id="creator-list-total-cost" className="q-in" aria-label="Total Avg Cost amount" aria-invalid={invalid} aria-describedby="sl-cost-feedback" inputMode="decimal" value={amount} placeholder="Not set" disabled={disabled || pending} onChange={event => { setAmount(event.target.value); setFeedback(""); setInvalid(false); }} />
      <select className="q-sel" aria-label="Total Avg Cost currency" value={currency} onChange={event => setCurrency(event.target.value)} disabled={disabled || pending}>{COMMERCIAL_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}</select>
      <button className="sl-tac__tg" type="button" aria-pressed={visible} aria-label="Show Total Avg Cost in Creator List" title="Visibility in Creator List output only" onClick={() => save(!visible)} disabled={disabled || pending}><s />{visible ? "Shown" : "Hidden"}</button>
      <button type="submit" className="q-b q-b--pri q-b--sm" disabled={disabled || pending}>{pending ? "Saving…" : "Save"}</button>
      <span id="sl-cost-feedback" role="status" className={"sl-tac__st " + (invalid ? "err" : feedback ? "ok" : "")}>{feedback}</span>
    </form>
  );
}
