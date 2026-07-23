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
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background shadow-sm",
        padding === "default" && "px-6 py-4",
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
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "primary" | "danger" | "ghost" | "glow";
  size?: "default" | "sm";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold transition-all active:scale-[0.97]",
        size === "sm"
          ? "h-8 rounded-[9px] px-3 text-[12.5px]"
          : "h-9 rounded-[10px] px-3.5 text-[13px]",
        variant === "outline" &&
          "border border-border bg-background text-[var(--text-2)] hover:border-border hover:bg-muted/30",
        variant === "ghost" &&
          "border border-transparent bg-transparent text-[var(--text-2)] hover:bg-muted/40",
        variant === "primary" &&
          "border border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,87,255,0.35),0_6px_16px_-6px_rgba(0,87,255,0.5)] hover:bg-[var(--blue-hover,#0048dd)]",
        variant === "danger" &&
          "border border-transparent bg-transparent text-red-600 hover:bg-red-500/10",
        variant === "glow" &&
          "border-[1.5px] border-primary/55 bg-background text-[var(--blue-text)] font-bold shadow-[0_0_0_3px_rgba(0,87,255,0.08),0_2px_14px_-3px_rgba(0,87,255,0.4)] hover:border-primary hover:bg-[var(--blue-light)] hover:shadow-[0_0_0_3px_rgba(0,87,255,0.14),0_4px_18px_-3px_rgba(0,87,255,0.55)] dark:bg-primary/5 [&_svg]:text-primary",
        props.disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ShortlistMetaDot() {
  return (
    <span
      className="size-[3px] shrink-0 rounded-full bg-muted-foreground/50"
      aria-hidden
    />
  );
}

export function ShortlistMetaItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  );
}
