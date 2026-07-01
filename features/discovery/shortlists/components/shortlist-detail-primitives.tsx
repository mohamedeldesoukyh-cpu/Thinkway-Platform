"use client";

import { CheckIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ShortlistDetailCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const showCheck = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border-[1.5px] border-border bg-background transition-colors",
        showCheck && "border-primary bg-primary",
        className
      )}
    >
      {indeterminate && !checked ? (
        <span className="h-0.5 w-2 rounded-full bg-white" aria-hidden />
      ) : (
        <CheckIcon
          className={cn("size-2.5 text-white", checked ? "opacity-100" : "opacity-0")}
          strokeWidth={3}
        />
      )}
    </button>
  );
}

export function ShortlistHeaderPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full border border-border bg-muted/60 px-2.5 text-[11px] font-semibold text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ShortlistDetailCard({
  children,
  className,
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: "default" | "none";
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        padding === "default" && "p-[22px] px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShortlistToolbarButton({
  children,
  className,
  variant = "outline",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all active:scale-[0.97]",
        variant === "outline" &&
          "border border-border bg-background text-muted-foreground hover:border-slate-300 hover:bg-muted/50",
        variant === "primary" &&
          "border-0 bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(0,87,255,0.28)] hover:-translate-y-px hover:shadow-[0_4px_18px_rgba(0,87,255,0.35)]",
        variant === "danger" &&
          "border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100",
        props.disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
