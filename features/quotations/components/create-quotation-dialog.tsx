"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlankQuotation } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationFormOptions } from "@/features/quotations/types";

export function CreateQuotationDialog({ options }: { options: QuotationFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [pending, startTransition] = useTransition();

  const clientOptions = useMemo(
    () => options.clients.map((c) => ({ value: c.id, label: c.name })),
    [options.clients]
  );

  const brandOptions = useMemo(() => {
    const filtered = clientId
      ? options.brands.filter((b) => b.client_id === clientId)
      : [];
    return filtered.map((b) => ({ value: b.id, label: b.name }));
  }, [clientId, options.brands]);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a quotation name.");
      return;
    }
    if (!clientId || !brandId) {
      toast.error("Select client and brand.");
      return;
    }
    startTransition(async () => {
      const res = await createBlankQuotation({
        name: trimmed,
        client_id: clientId,
        brand_id: brandId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Quotation created.");
      setOpen(false);
      setName("");
      setClientId("");
      setBrandId("");
      if (res.data?.id) router.push(quotationDetailPath(res.data.id, res.data.serial_number));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-9 gap-[7px] border-0 px-3.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_rgba(0,87,255,0.22)] hover:brightness-105"
          style={{ backgroundImage: "var(--tw-brand-gradient)" }}
        >
          <PlusIcon className="size-3.5" strokeWidth={2.4} />
          New Quotation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New client quotation</DialogTitle>
          <DialogDescription>
            Client and brand are required. You can link a campaign inside the workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="quotation-name">Quotation name</Label>
            <Input
              id="quotation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramadan 2026 — Brand X"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Legal entity</Label>
            <SearchableSelect
              options={clientOptions}
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setBrandId("");
              }}
              placeholder="Select client"
            />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <SearchableSelect
              options={brandOptions}
              value={brandId}
              onValueChange={setBrandId}
              disabled={!clientId}
              placeholder={clientId ? "Select brand" : "Select client first"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
