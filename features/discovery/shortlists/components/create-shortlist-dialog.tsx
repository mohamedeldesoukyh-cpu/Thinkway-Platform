"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ShortlistVisibilityV2 } from "@/types/database";

import { createShortlistV2 } from "../actions";
import {
  SELECTABLE_SHORTLIST_VISIBILITIES,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistBrandOption } from "../types";

const NO_BRAND = "__none__";

export function CreateShortlistDialog({
  brands,
  trigger,
}: {
  brands: ShortlistBrandOption[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ShortlistVisibilityV2>("private");
  const [brandId, setBrandId] = useState<string>(NO_BRAND);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setVisibility("private");
    setBrandId(NO_BRAND);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Shortlist name is required");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createShortlistV2({
          name: trimmed,
          description: description.trim() || null,
          visibility,
          brandId: brandId === NO_BRAND ? null : brandId,
        });
        toast.success(
          `Shortlist ${created.serial_number ?? ""} "${created.name}" created`.trim()
        );
        setOpen(false);
        reset();
        router.push(`/discovery/shortlists/${created.id}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create shortlist");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button>New shortlist</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create shortlist</DialogTitle>
          <DialogDescription>
            Save discovered creators into a reviewable, approvable shortlist. A
            permanent SL serial is assigned automatically.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="shortlist-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="shortlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Q3 Beauty Shortlist"
              autoFocus
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shortlist-description">Description</Label>
            <Textarea
              id="shortlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes about this list"
              rows={3}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shortlist-visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as ShortlistVisibilityV2)}
                disabled={isPending}
              >
                <SelectTrigger id="shortlist-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_SHORTLIST_VISIBILITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SHORTLIST_VISIBILITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shortlist-brand">Brand (optional)</Label>
              <Select value={brandId} onValueChange={setBrandId} disabled={isPending}>
                <SelectTrigger id="shortlist-brand">
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND}>No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.client_name ? `${brand.name} · ${brand.client_name}` : brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Create shortlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
