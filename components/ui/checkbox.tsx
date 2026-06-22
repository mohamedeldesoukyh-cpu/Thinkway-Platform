"use client";

import * as React from "react";
import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group peer size-4 shrink-0 rounded-[4px] border border-[#E6EAF2] bg-white shadow-xs transition-colors outline-none",
        "focus-visible:border-[#0057FF] focus-visible:ring-2 focus-visible:ring-[#0057FF]/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-[#0057FF] data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white",
        "data-[state=indeterminate]:border-[#0057FF] data-[state=indeterminate]:bg-[#0057FF] data-[state=indeterminate]:text-white",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="size-3 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
        <MinusIcon
          className="hidden size-3 group-data-[state=indeterminate]:block"
          strokeWidth={3}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
