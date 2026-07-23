"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

type TooltipIconButtonProps = ComponentProps<typeof Button> & {
  tooltip: string;
  tooltipSide?: TooltipSide;
};

export function TooltipIconButton({
  tooltip,
  tooltipSide = "top",
  className,
  children,
  ...props
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button className={cn(className)} {...props}>
          {children}
          <span className="sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

type TooltipHintProps = {
  label: string;
  side?: TooltipSide;
  children: ReactElement;
};

/** Wrap any control (button, icon, etc.) with a hover reference tooltip. */
export function TooltipHint({ label, side = "top", children }: TooltipHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

type TooltipLabelProps = {
  label: string;
  side?: TooltipSide;
  children: ReactNode;
  className?: string;
};

/** Non-interactive symbol with a hover reference tooltip. */
export function TooltipLabel({ label, side = "top", children, className }: TooltipLabelProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", className)} tabIndex={0}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
