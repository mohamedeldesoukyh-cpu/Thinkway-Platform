"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DetailClickableLabelProps = {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
};

/** Primary cell label that opens an operational detail drawer. */
export function DetailClickableLabel({
  children,
  onClick,
  title,
  className,
}: DetailClickableLabelProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "text-left font-medium text-foreground transition-colors hover:text-primary hover:underline",
        className
      )}
    >
      {children}
    </button>
  );
}
