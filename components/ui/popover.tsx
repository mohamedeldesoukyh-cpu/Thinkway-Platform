"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { useFullscreenPortalContainer } from "@/lib/hooks/use-fullscreen-portal-container";
import { DROPDOWN_SURFACE_CLASS } from "@/components/ui/dropdown-surface";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "end",
  sideOffset = 6,
  container,
  dropdown = false,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  container?: HTMLElement | null;
  /** Apply platform dropdown surface styling (checkbox lists, type pickers). */
  dropdown?: boolean;
}) {
  const fullscreenContainer = useFullscreenPortalContainer();

  return (
    <PopoverPrimitive.Portal container={container ?? fullscreenContainer}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[110] w-80 origin-(--radix-popover-content-transform-origin) text-popover-foreground outline-none",
          dropdown
            ? cn(DROPDOWN_SURFACE_CLASS, "p-0")
            : "rounded-xl border border-border/60 bg-popover p-0 shadow-lg",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
