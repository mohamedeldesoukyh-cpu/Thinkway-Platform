"use client";

import { CheckIcon } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

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

/** Shortlist chrome only — one size, outlined, matching the header button layer. */
export const SHORTLIST_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-[10px] border-[0.8px] border-[#E3E8F2] bg-white px-3.5 text-[13px] font-semibold tracking-[-0.08px] text-[#41495A] transition-[border-color,color,box-shadow] hover:border-[rgba(0,87,255,0.35)] hover:text-[#0B52E0] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057ff] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none dark:border-border dark:bg-background dark:text-[var(--text-2)]";

export const SHORTLIST_TOOLBAR_BUTTON_PRIMARY_CLASS =
  "border-[rgba(0,87,255,0.55)] text-[12.5px] font-bold tracking-[-0.084px] text-[#0B52E0] shadow-[0_0_0_3px_rgba(0,87,255,0.08),0_2px_14px_-3px_rgba(0,87,255,0.4)] hover:border-[#0057ff] hover:text-[#0B52E0] hover:shadow-[0_0_0_3px_rgba(0,87,255,0.12),0_3px_16px_-3px_rgba(0,87,255,0.5)]";

export const SHORTLIST_TOOLBAR_BUTTON_WARN_CLASS =
  "border-[#F0D3A2] bg-[#FFF8EC] text-[#95651A] hover:border-[#E0B571] hover:text-[#7A5215]";

export function ShortlistToolbarCount({
  children,
  warn,
}: {
  children: ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-px font-mono text-[10.5px] font-semibold",
        warn
          ? "border-[#F0D3A2] bg-white text-[#95651A]"
          : "border-[#eef0f3] bg-[#f6f8fb] text-[#64748b]"
      )}
    >
      {children}
    </span>
  );
}

export const ShortlistToolbarButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "outline" | "primary" | "danger" | "ghost" | "glow" | "warn";
    size?: "default" | "sm";
  }
>(function ShortlistToolbarButton(
  { children, className, variant = "outline", size = "default", ...props },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      className={cn(
        SHORTLIST_TOOLBAR_BUTTON_CLASS,
        size === "sm" && "h-[30px] px-[11px] text-[12px]",
        variant === "ghost" &&
          "border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-muted/40",
        (variant === "primary" || variant === "glow") &&
          SHORTLIST_TOOLBAR_BUTTON_PRIMARY_CLASS,
        variant === "warn" && SHORTLIST_TOOLBAR_BUTTON_WARN_CLASS,
        variant === "danger" &&
          "border-transparent bg-transparent text-red-600 shadow-none hover:border-transparent hover:bg-red-500/10 hover:text-red-600",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
ShortlistToolbarButton.displayName = "ShortlistToolbarButton";

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
