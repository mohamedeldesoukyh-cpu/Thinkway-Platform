"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addOtherService, searchOtherServiceVendors, createOtherServiceVendor } from "./actions";

type Vendor = { id: string; display_name: string; document_number?: string | null };

export function OtherServiceVendorPicker({ scope, value, onChange }: {
  scope: "quotation" | "campaign"; value: Vendor | null; onChange: (vendor: Vendor) => void;
}) {
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const latch = useRef(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void searchOtherServiceVendors(scope, search).then(result => {
        if (!active) return;
        if (result.ok) { setVendors(result.vendors); setError(""); }
        else setError(result.message);
      }).catch(() => { if (active) setError("Could not load vendors. Try searching again."); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [scope, search]);
  return <fieldset className="space-y-2 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Vendor</legend>
    {value && <p className="text-sm">Selected: <strong>{value.display_name}</strong></p>}
    <Input aria-label="Search vendors" placeholder="Search vendors by name…" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="max-h-32 overflow-y-auto" role="group" aria-label="Matching vendors">
      {vendors.map(vendor => <button type="button" key={vendor.id} aria-pressed={value?.id === vendor.id}
        className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
        onClick={() => onChange(vendor)}>{vendor.display_name} <span className="text-muted-foreground">{vendor.document_number}</span></button>)}
      {!vendors.length && <p className="p-2 text-sm text-muted-foreground">No matching vendors. You can create one below.</p>}
    </div>
    <Button type="button" variant="outline" size="sm" onClick={() => setCreating(!creating)}>+ Create vendor</Button>
    {creating && <div className="space-y-2 border-t pt-2">
      <Input aria-label="New vendor name" placeholder="Vendor name" id="other-service-vendor-name" defaultValue={search} />
      <Input aria-label="New vendor email" placeholder="Email (optional)" type="email" id="other-service-vendor-email" />
      <Button type="button" size="sm" disabled={busy} onClick={async event => {
        if (latch.current) return;
        const root = event.currentTarget.parentElement;
        const name = root?.querySelector<HTMLInputElement>("#other-service-vendor-name")?.value.trim() ?? "";
        const email = root?.querySelector<HTMLInputElement>("#other-service-vendor-email")?.value.trim() ?? "";
        if (!name) { setError("Enter a vendor name."); return; }
        latch.current = true; setBusy(true); setError("");
        try {
          const result = await createOtherServiceVendor({ name, email, country: "" });
          if (!result.ok || !result.vendorId) { setError(result.message ?? "Could not create vendor."); return; }
          onChange({ id: result.vendorId, display_name: name }); setCreating(false); setSearch(name);
        } catch { setError("Could not create vendor. Please retry."); }
        finally { latch.current = false; setBusy(false); }
      }}>{busy ? "Creating…" : "Create and select vendor"}</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}

export function OtherServiceButton({ scope, documentId, currency, onAdded }: {
  scope: "quotation" | "campaign"; documentId: string; currency: string; onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latch = useRef(false);
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => { setError(""); setOpen(true); }}>+ Other service</Button>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Add other service</DialogTitle>
          <DialogDescription>Add a service such as videography, photography, or production under Others.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={async event => {
          event.preventDefault();
          if (latch.current) return;
          if (!vendor) { setError("Select or create a vendor."); return; }
          const form = new FormData(event.currentTarget);
          latch.current = true; setBusy(true); setError("");
          try {
            const result = await addOtherService({ scope, documentId, vendorId: vendor.id,
              title: String(form.get("title")), description: String(form.get("description")),
              cost: Number(form.get("cost")), revenue: Number(form.get("revenue")),
              currency, agencyFeePercent: Number(form.get("af")) });
            if (!result.ok) { setError(result.message ?? "Could not add service."); return; }
            toast.success("Other service added."); setOpen(false); setVendor(null); onAdded();
          } catch { setError("Could not add service. Please retry."); }
          finally { latch.current = false; setBusy(false); }
        }}>
          <label className="block space-y-1 text-sm">Service name<Input name="title" required maxLength={200} placeholder="e.g. Videographer" /></label>
          <label className="block space-y-1 text-sm">Description<textarea name="description" maxLength={1800} rows={2} className="w-full rounded-md border bg-background p-2" placeholder="Scope, deliverables, and duration" /></label>
          <OtherServiceVendorPicker scope={scope} value={vendor} onChange={setVendor} />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">Vendor cost ({currency})<Input name="cost" type="number" min="0" step="0.01" required defaultValue="0" /></label>
            <label className="space-y-1 text-sm">Client price before AF/VAT ({currency})<Input name="revenue" type="number" min="0" step="0.01" required defaultValue="0" /></label>
          </div>
          <label className="block space-y-1 text-sm">Agency fee %<Input name="af" type="number" min="0" max="100" step="0.01" defaultValue="0" required /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} type="submit">{busy ? "Adding…" : "Add service"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
