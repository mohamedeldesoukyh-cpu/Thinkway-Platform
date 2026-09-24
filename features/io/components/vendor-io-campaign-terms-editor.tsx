"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VendorIoRow } from "@/features/io/types";
import { updateVendorIoCampaignTermsAction } from "@/features/io/update-vendor-io-campaign-terms-action";
import { VENDOR_IO_PAYMENT_PRESETS } from "@/lib/io/vendor-io-campaign-terms";
import { normalizeVendorIoCountry, resolveVendorIoCountry, vendorIoCountryLabel } from "@/lib/io/vendor-io-country";

type Field = "payment" | "usage" | "country";
const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CampaignTermsForm({ row, field, onSaved }: { row: VendorIoRow; field: Field; onSaved: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const current = row.special_payment_terms?.trim() ?? "";
  const [payment, setPayment] = useState(!current ? "inherit" : VENDOR_IO_PAYMENT_PRESETS.some(p => p === current) ? current : "custom");
  const [manual, setManual] = useState(current);
  const [usage, setUsage] = useState(row.usage_rights ?? "");
  const [country, setCountry] = useState(row.compliance_country_code ?? "");
  const inheritedCountry = normalizeVendorIoCountry(row.creator_country_code);

  return (
    <form className="space-y-5" onSubmit={event => {
      event.preventDefault();
      setMessage("");
      startTransition(async () => {
        try {
          const result = await updateVendorIoCampaignTermsAction({
            id: row.id, campaign_header_id: row.campaign_header_id, updated_at: row.updated_at,
            usage_rights: usage,
            special_payment_terms: payment === "inherit" ? "" : payment === "custom" ? manual : payment,
            compliance_country_code: country,
          });
          if (!result.ok) { setMessage(result.message); return; }
          toast.success(result.message);
          router.refresh();
          onSaved();
        } catch {
          setMessage("Could not save the terms. Please try again.");
        }
      });
    }}>
      <div className="space-y-2">
        <Label htmlFor={`usage-${row.id}`}>Usage rights / usage period</Label>
        <Textarea id={`usage-${row.id}`} value={usage} onChange={e => setUsage(e.target.value)}
          maxLength={2000} rows={3} autoFocus={field === "usage"} disabled={pending}
          placeholder="e.g. 30 days from first publication, digital channels and paid ads" />
        <p className="text-xs text-muted-foreground">Appears under Usage Period in the IO’s Engagement section.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`payment-${row.id}`}>Payment terms</Label>
        <select id={`payment-${row.id}`} className={selectClass} value={payment}
          onChange={e => setPayment(e.target.value)} disabled={pending} autoFocus={field === "payment"}>
          <option value="inherit">Use CRM default — {row.vendor_payment_terms_label}</option>
          {VENDOR_IO_PAYMENT_PRESETS.map(value => <option key={value} value={value}>{value}</option>)}
          <option value="custom">Custom / manual input</option>
        </select>
        {payment === "custom" && <div className="space-y-2">
          <Label htmlFor={`manual-payment-${row.id}`}>Custom payment schedule</Label>
          <Textarea id={`manual-payment-${row.id}`} value={manual} onChange={e => setManual(e.target.value)}
            maxLength={500} rows={3} required disabled={pending} />
        </div>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`country-${row.id}`}>Local compliance country</Label>
        <select id={`country-${row.id}`} className={selectClass} value={country}
          onChange={e => setCountry(e.target.value)} disabled={pending} autoFocus={field === "country"}>
          <option value="">{inheritedCountry ? `Use CRM country — ${vendorIoCountryLabel(inheritedCountry)}` : "Use existing default — Egypt"}</option>
          <option value="AE">United Arab Emirates</option>
          <option value="EG">Egypt</option>
        </select>
        <p className="text-xs text-muted-foreground">Sets the local-compliance clause. The governing-law clause remains Egypt.</p>
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSaved} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending || (payment === "custom" && !manual.trim())}>
          {pending ? "Saving…" : "Save IO terms"}
        </Button>
      </div>
    </form>
  );
}

export function VendorIoCampaignTermsEditor({ row, field = "payment" }: { row: VendorIoRow; field?: Field }) {
  const [open, setOpen] = useState(false);
  const label = field === "usage" ? row.usage_rights?.trim() || "Set usage rights"
    : field === "country" ? vendorIoCountryLabel(resolveVendorIoCountry(row.compliance_country_code, row.creator_country_code))
    : row.effective_payment_terms_label || "Set payment terms";
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button type="button" disabled={row.is_superseded}
        aria-label={`Edit ${field === "usage" ? "usage rights" : field === "country" ? "compliance country" : "payment terms"} for ${row.influencer_name}`}
        className="min-h-11 w-full rounded-md px-1 py-2 text-left text-xs leading-snug text-primary underline decoration-dotted underline-offset-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        {label}
      </button>
    </DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Campaign IO terms</DialogTitle>
        <DialogDescription>{row.influencer_name} · {row.document_number}. Changes apply only to this IO in {row.campaign_name}.</DialogDescription>
      </DialogHeader>
      {open && <CampaignTermsForm key={`${row.id}:${row.updated_at}`} row={row} field={field} onSaved={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>;
}
