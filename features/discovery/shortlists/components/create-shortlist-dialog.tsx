"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListPlusIcon, Loader2Icon } from "lucide-react";
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
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";
import type { ShortlistVisibilityV2 } from "@/types/database";

import { createShortlistV2 } from "../actions";
import {
  SELECTABLE_SHORTLIST_VISIBILITIES,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistBrandOption } from "../types";

const NO_BRAND = "__none__";

const SHORTLIST_PREVIEW_CREATORS = [
  {
    name: "Amira Khan",
    gradient: "from-sky-300/70 via-sky-400/40 to-blue-400/25",
    textClass: "text-sky-900 dark:text-sky-100",
  },
  {
    name: "Marcus Rivera",
    gradient: "from-amber-300/70 via-amber-400/40 to-orange-400/25",
    textClass: "text-amber-900 dark:text-amber-100",
  },
  {
    name: "Jade Stone",
    gradient: "from-rose-300/70 via-rose-400/40 to-pink-400/25",
    textClass: "text-rose-900 dark:text-rose-100",
  },
  {
    name: "Leo Park",
    gradient: "from-violet-300/70 via-violet-400/40 to-purple-400/25",
    textClass: "text-violet-900 dark:text-violet-100",
  },
] as const;

function ShortlistPreviewAvatarStack() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      <span className="sr-only">Preview of creators you will save to this shortlist</span>
      {SHORTLIST_PREVIEW_CREATORS.map((creator, index) => (
        <span
          key={creator.name}
          className={cn(
            "relative inline-flex size-7 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br text-[10px] font-semibold shadow-sm",
            "ring-2 ring-white/90 dark:border-white/20 dark:ring-[rgba(24,24,27,0.9)]",
            creator.gradient,
            creator.textClass,
            index > 0 && "-ml-2"
          )}
          style={{ zIndex: SHORTLIST_PREVIEW_CREATORS.length - index }}
        >
          {initialsFromCreatorName(creator.name)}
        </span>
      ))}
      <span
        className={cn(
          "relative -ml-2 z-0 inline-flex size-7 items-center justify-center rounded-full",
          "border border-dashed border-[#1D9E75]/40 bg-[#1D9E75]/8 ring-2 ring-white/90",
          "text-[#1D9E75] dark:border-[#1D9E75]/50 dark:bg-[#1D9E75]/12 dark:ring-[rgba(24,24,27,0.9)]"
        )}
      >
        <ListPlusIcon className="size-3.5" aria-hidden />
      </span>
    </div>
  );
}

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
        {trigger ?? (
          <Button className="h-9 gap-[7px] rounded-[10px] border border-primary bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(0,87,255,0.35),0_6px_16px_-6px_rgba(0,87,255,0.5)] hover:bg-[var(--blue-hover,#0048dd)]">
            <ListPlusIcon className="size-3.5" strokeWidth={2.4} />
            New Shortlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        overlayClassName="!bg-transparent bg-[radial-gradient(ellipse_90%_80%_at_50%_35%,rgba(15,23,42,0.05),rgba(15,23,42,0.02)_42%,transparent_72%)] supports-backdrop-filter:backdrop-blur-none dark:bg-[radial-gradient(ellipse_90%_80%_at_50%_35%,rgba(0,0,0,0.18),rgba(0,0,0,0.06)_42%,transparent_72%)]"
        className={cn(
          "overflow-hidden border border-white/70 bg-white/75 shadow-[0_24px_64px_-14px_rgba(15,23,42,0.16),0_10px_28px_-10px_rgba(15,23,42,0.08),0_0_0_1px_rgba(255,255,255,0.55)_inset]",
          "ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150",
          "dark:border-white/10 dark:bg-[rgba(24,24,27,0.72)] dark:shadow-[0_24px_64px_-14px_rgba(0,0,0,0.55),0_10px_28px_-10px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.05)_inset] dark:ring-white/[0.06] dark:backdrop-blur-2xl",
          "duration-200 data-open:zoom-in-[0.97] sm:max-w-lg"
        )}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-start gap-3">
            <ShortlistPreviewAvatarStack />
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle>Create shortlist</DialogTitle>
              <DialogDescription>
                Save discovered creators into a reviewable, approvable shortlist. A
                permanent SL serial is assigned automatically.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit}>
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
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="shortlist-visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as ShortlistVisibilityV2)}
                disabled={isPending}
              >
                <SelectTrigger
                  id="shortlist-visibility"
                  className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                >
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

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="shortlist-brand">Brand (optional)</Label>
              <Select value={brandId} onValueChange={setBrandId} disabled={isPending}>
                <SelectTrigger
                  id="shortlist-brand"
                  className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                >
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND}>No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id} className="truncate">
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
