"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { switchQuotationClientBrand } from "@/features/quotations/lifecycle-actions";
import { forgetClientReviewShare } from "@/features/client-workspace/client-review-share-memory";
import type { QuotationDetail, PromoteWizardOptions } from "@/features/quotations/types";

export function ChangeQuotationClientDialog({ detail, options, disabled }: {
  detail: QuotationDetail;
  options: PromoteWizardOptions;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(detail.client_id ?? "");
  const [brandId, setBrandId] = useState(detail.brand_id ?? "");
  const [pending, startTransition] = useTransition();
  const brands = options.brands.filter(brand => brand.client_id === clientId);
  return <Dialog open={open} onOpenChange={next => {
    if (pending) return;
    if (next) { setClientId(detail.client_id ?? ""); setBrandId(detail.brand_id ?? ""); }
    setOpen(next);
  }}>
    <DialogTrigger asChild>
      <button type="button" className="tw-b sm" disabled={disabled}>Change client &amp; brand</button>
    </DialogTrigger>
    <DialogContent className="max-w-lg">
      <form onSubmit={event => {
        event.preventDefault();
        if (pending || !clientId || !brands.some(brand => brand.id === brandId)) return;
        startTransition(async () => {
          try {
            const result = await switchQuotationClientBrand({ quotationId: detail.id, clientId, brandId });
            if (!result.ok) { toast.error(result.message); return; }
            forgetClientReviewShare({ source: "quotation", id: detail.id });
            toast.success("Quotation client and brand updated.");
            setOpen(false);
            // Clear cached review links and quotation drafts after changing ownership.
            window.location.reload();
          } catch { toast.error("Could not change the client and brand. Please try again."); router.refresh(); }
        });
      }}>
        <DialogHeader>
          <DialogTitle>Change client &amp; brand</DialogTitle>
          <DialogDescription>Select an existing client and one of their brands for this quotation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">Current: {detail.client_name ?? "No client"} / {detail.brand_name ?? "No brand"}</p>
          <div className="space-y-2">
            <Label>Client</Label>
            <SearchableSelect options={options.clients.map(client => ({ value: client.id, label: client.name }))}
              value={clientId} onValueChange={value => { setClientId(value); setBrandId(""); }} disabled={pending} placeholder="Select client" />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <SearchableSelect options={brands.map(brand => ({ value: brand.id, label: brand.name }))}
              value={brandId} onValueChange={setBrandId} disabled={pending || !clientId} placeholder="Select brand" />
            {clientId && brands.length === 0 ? <p className="text-sm text-muted-foreground">This client has no brands. Add a brand in Clients first.</p> : null}
          </div>
          <p className="text-sm text-muted-foreground">Items and prices stay the same. The quotation will be unlinked from its original shortlist and plan. Existing client review links will expire; create a new link for the selected client.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending || !clientId || !brands.some(brand => brand.id === brandId) || (clientId === detail.client_id && brandId === detail.brand_id)}>{pending ? "Saving…" : "Save client & brand"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
