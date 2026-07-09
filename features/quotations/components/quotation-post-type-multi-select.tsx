"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  deliverableTypesLabel,
  isPostTypeAllowedForCreator,
  QUOTATION_POST_TYPES,
  quotationPostTypeLabel,
  toggleDeliverableType,
} from "@/lib/quotations/quotation-deliverable-types";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (types: string[]) => void;
  allowedPlatforms: string[];
  /** When set, overrides the default types-only summary (e.g. includes per-type quantities). */
  summaryLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function QuotationPostTypeMultiSelect({
  value,
  onChange,
  allowedPlatforms,
  summaryLabel,
  className,
  disabled,
}: Props) {
  const label =
    summaryLabel ?? deliverableTypesLabel({ type: value[0] ?? "", types: value });
  const hasSelection = value.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-auto min-h-8 w-full justify-between gap-2 px-2 py-1.5 text-left font-normal",
            className
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 whitespace-normal text-[11px] leading-snug",
              hasSelection ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,18rem)] p-2">
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {QUOTATION_POST_TYPES.map((t) => {
            const checked = value.includes(t.value);
            const allowed = isPostTypeAllowedForCreator(t.value, allowedPlatforms);
            return (
              <label
                key={t.value}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5",
                  allowed ? "cursor-pointer hover:bg-muted/60" : "cursor-not-allowed opacity-45"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={!allowed}
                  onCheckedChange={() => {
                    if (!allowed) return;
                    onChange(toggleDeliverableType(value, t.value));
                  }}
                  className="mt-0.5"
                  aria-label={t.label}
                />
                <span className="min-w-0 flex-1 text-[11px] leading-snug">{t.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Accessible summary for remove buttons etc. */
export function selectedPostTypesAriaLabel(types: string[]): string {
  if (!types.length) return "post types";
  return types.map((t) => quotationPostTypeLabel(t)).join(", ");
}
