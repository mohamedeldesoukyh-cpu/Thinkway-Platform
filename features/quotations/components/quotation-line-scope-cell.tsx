"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { QuotationCreatorPlatformOption } from "@/features/quotations/actions";
import { QUOTATION_POST_TYPES } from "@/lib/quotations/quotation-deliverable-types";
import { cn } from "@/lib/utils";

import type { DeliverableDraft } from "@/features/quotations/components/quotation-line-fields";

type PostTypesProps = {
  deliverableDrafts: DeliverableDraft[];
  saveDeliverables: (next: DeliverableDraft[]) => void;
  onAddDeliverable: () => void;
  costCurrency: string;
};

export function QuotationLinePostTypesCell({
  deliverableDrafts,
  saveDeliverables,
  onAddDeliverable,
  costCurrency,
}: PostTypesProps) {
  return (
    <div className="space-y-2 py-0.5">
      {deliverableDrafts.length === 0 ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={onAddDeliverable}
        >
          <PlusIcon className="size-3" />
          Add post type
        </Button>
      ) : (
        deliverableDrafts.map((draft) => (
          <div
            key={draft.key}
            className={cn(
              "space-y-1.5 rounded-lg border border-border/70 bg-background/80 p-2"
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(72px,88px)_28px] items-center gap-1">
              <Select
                value={draft.type}
                onValueChange={(type) => {
                  saveDeliverables(
                    deliverableDrafts.map((d) => (d.key === draft.key ? { ...d, type } : d))
                  );
                }}
              >
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Post type" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {QUOTATION_POST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-7 px-1 text-center text-[10px]"
                inputMode="numeric"
                min={1}
                value={String(draft.quantity)}
                onChange={(e) => {
                  const quantity = Math.max(1, Number(e.target.value) || 1);
                  saveDeliverables(
                    deliverableDrafts.map((d) => (d.key === draft.key ? { ...d, quantity } : d))
                  );
                }}
                aria-label="Quantity"
              />
              <Input
                className="h-7 text-[10px]"
                inputMode="decimal"
                placeholder={`Total ${costCurrency}`}
                value={draft.revenue != null && draft.revenue > 0 ? String(draft.revenue) : ""}
                onChange={(e) => {
                  const revenue = Number(e.target.value) || 0;
                  saveDeliverables(
                    deliverableDrafts.map((d) =>
                      d.key === draft.key ? { ...d, revenue } : d
                    )
                  );
                }}
                aria-label="Total price for this post type"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                onClick={() => saveDeliverables(deliverableDrafts.filter((d) => d.key !== draft.key))}
                aria-label="Remove post type"
              >
                <Trash2Icon className="size-3" />
              </Button>
            </div>
            <Textarea
              rows={1}
              className="min-h-[36px] resize-y text-[10px] leading-snug"
              placeholder="Service description for this post type…"
              value={draft.service_description ?? ""}
              onChange={(e) => {
                const service_description = e.target.value;
                saveDeliverables(
                  deliverableDrafts.map((d) =>
                    d.key === draft.key ? { ...d, service_description } : d
                  )
                );
              }}
            />
          </div>
        ))
      )}
      {deliverableDrafts.length > 0 ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={onAddDeliverable}
        >
          <PlusIcon className="size-3" />
          Add post type
        </Button>
      ) : null}
    </div>
  );
}

export function QuotationLinePlatformCell({
  loadingPlatforms,
  platformSelectOptions,
  platform,
  onPlatformChange,
  defaultOpen,
  forceSelect,
}: {
  loadingPlatforms: boolean;
  platformSelectOptions: QuotationCreatorPlatformOption[];
  platform: string | null;
  onPlatformChange: (platform: string) => void;
  /** Open the platform picker on mount (e.g. after adding a manual row). */
  defaultOpen?: boolean;
  /** When true, always render a select even with a single platform option. */
  forceSelect?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (loadingPlatforms) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" />
      </div>
    );
  }

  if (platformSelectOptions.length > 1 || forceSelect) {
    return (
      <Select
        open={open}
        onOpenChange={setOpen}
        value={platform ?? ""}
        onValueChange={onPlatformChange}
      >
        <SelectTrigger className="h-7 border-0 bg-transparent px-0 text-[11px] shadow-none">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          {platformSelectOptions.map((p) => (
            <SelectItem key={p.platform} value={p.platform}>
              {p.platform}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <span className="truncate text-[11px] capitalize text-muted-foreground">
      {platform ?? "—"}
    </span>
  );
}
