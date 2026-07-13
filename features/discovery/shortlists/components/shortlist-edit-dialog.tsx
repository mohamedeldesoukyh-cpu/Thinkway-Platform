"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { updateShortlistDetails } from "../actions";
import type {
  ShortlistBrandOption,
  ShortlistClientOption,
  ShortlistDetail,
} from "../types";

const NO_CLIENT = "";
const NO_BRAND = "";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ShortlistDetail;
  clients: ShortlistClientOption[];
  brands: ShortlistBrandOption[];
};

export function ShortlistEditDialog({
  open,
  onOpenChange,
  detail,
  clients,
  brands,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description ?? "");
  const [clientId, setClientId] = useState(detail.client_id ?? NO_CLIENT);
  const [brandId, setBrandId] = useState(detail.brand_id ?? NO_BRAND);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(detail.name);
    setDescription(detail.description ?? "");
    setClientId(detail.client_id ?? NO_CLIENT);
    setBrandId(detail.brand_id ?? NO_BRAND);
  }, [open, detail]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: client.name,
        description: client.legal_name ?? undefined,
      })),
    [clients]
  );

  const brandOptions = useMemo(() => {
    const filtered = clientId
      ? brands.filter((brand) => brand.client_id === clientId)
      : brands;
    return filtered.map((brand) => ({
      value: brand.id,
      label: brand.name,
      description: brand.client_name ?? undefined,
    }));
  }, [brands, clientId]);

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    if (!nextClientId) {
      setBrandId(NO_BRAND);
      return;
    }
    const brandStillValid = brands.some(
      (brand) => brand.id === brandId && brand.client_id === nextClientId
    );
    if (!brandStillValid) setBrandId(NO_BRAND);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Shortlist name is required.");
      return;
    }

    const hasClient = Boolean(clientId);
    const hasBrand = Boolean(brandId);
    if (hasClient !== hasBrand) {
      toast.error("Select both legal entity and brand, or clear the commercial link.");
      return;
    }

    const commercialChanged =
      (hasClient ? clientId : null) !== detail.client_id ||
      (hasBrand ? brandId : null) !== detail.brand_id;

    startTransition(async () => {
      const result = await updateShortlistDetails({
        shortlistId: detail.id,
        name: trimmedName,
        description: description.trim() || null,
        ...(commercialChanged
          ? {
              clientId: hasClient ? clientId : null,
              brandId: hasBrand ? brandId : null,
            }
          : {}),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message ?? "Shortlist updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden border border-white/70 bg-white/75 shadow-[0_24px_64px_-14px_rgba(15,23,42,0.16)]",
          "ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150",
          "dark:border-white/10 dark:bg-[rgba(24,24,27,0.72)] dark:ring-white/[0.06]",
          "sm:max-w-lg"
        )}
      >
        <DialogHeader>
          <DialogTitle>Edit shortlist</DialogTitle>
          <DialogDescription>
            Update the shortlist name, notes, and commercial link for quotations and
            campaigns.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit-shortlist-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-shortlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Shortlist name"
              required
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-shortlist-description">Description</Label>
            <Textarea
              id="edit-shortlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes"
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Commercial link</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Link this shortlist to a legal entity and brand. Linked quotations with
                matching or empty client/brand will sync automatically.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Legal entity
                </Label>
                <SearchableSelect
                  options={[{ value: NO_CLIENT, label: "No legal entity" }, ...clientOptions]}
                  value={clientId}
                  onValueChange={handleClientChange}
                  disabled={isPending}
                  placeholder="Select legal entity"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Brand
                </Label>
                <SearchableSelect
                  options={[{ value: NO_BRAND, label: "No brand" }, ...brandOptions]}
                  value={brandId}
                  onValueChange={setBrandId}
                  disabled={isPending || !clientId}
                  placeholder={clientId ? "Select brand" : "Select legal entity first"}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
