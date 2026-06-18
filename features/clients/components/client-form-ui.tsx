"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Form controls — Thinkway client form reference (Form_1, brand-green focus ring). */
export const CLIENT_FORM_MAX_WIDTH = "max-w-[880px]";

export const CLIENT_FORM_INPUT_CLASS = cn(
  "h-auto min-h-9 w-full rounded-[10px] border-border/80 bg-muted/30 px-[13px] py-[11px] text-[13.5px] shadow-none",
  "placeholder:text-muted-foreground/70",
  "focus-visible:border-[var(--brand-product)] focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-[var(--brand-product)]/15"
);

export const CLIENT_FORM_SELECT_TRIGGER_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "justify-between text-left font-normal"
);

export const CLIENT_FORM_TEXTAREA_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "min-h-[90px] resize-y leading-relaxed"
);

export const CLIENT_FORM_FIELD_LABEL_CLASS =
  "text-[12.5px] font-semibold text-foreground/85";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-muted-foreground";

export const CLIENT_FORM_PRIMARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-[var(--brand-product)] px-4 py-2.5",
  "text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(29,158,117,0.3)]",
  "transition-[transform,box-shadow] active:scale-[0.97]",
  "hover:shadow-[0_6px_20px_rgba(29,158,117,0.42)]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-muted-foreground transition-colors",
  "hover:bg-muted/50 hover:text-foreground active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export function ClientFormPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h2 className="text-[25px] font-extrabold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-[5px] text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

export function ClientFormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(11,15,26,0.03)]",
        className
      )}
    >
      <header className="flex items-center gap-3 border-b border-border/80 px-[22px] py-[18px]">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--brand-product)]/10 text-[var(--brand-product)]">
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-px text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="space-y-[18px] p-[22px]">{children}</div>
    </section>
  );
}

export function ClientFormGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-[18px] sm:grid-cols-2", className)}>{children}</div>
  );
}

export function ClientFormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-[7px]", className)}>
      <Label htmlFor={htmlFor} className={CLIENT_FORM_FIELD_LABEL_CLASS}>
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p className={CLIENT_FORM_FIELD_HINT_CLASS}>{hint}</p>
        ) : (
          hint
        )
      ) : null}
    </div>
  );
}

export function ClientFormSaveBar({
  children,
  status,
  onDiscard,
  discardLabel = "Discard",
  discardDisabled,
}: {
  children: ReactNode;
  status?: ReactNode;
  onDiscard?: () => void;
  discardLabel?: string;
  discardDisabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center gap-3.5 border-t border-border/80 bg-background/[0.88] px-[26px] py-3.5 backdrop-blur-[14px] sm:-mx-5 md:-mx-0 md:rounded-b-[20px]">
      {status ? (
        <div className="flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2.5">
        {onDiscard ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            {discardLabel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ClientFormUnsavedStatus() {
  return (
    <>
      <span
        className="size-[7px] shrink-0 rounded-full bg-amber-600 shadow-[0_0_6px_#C2740B]"
        aria-hidden
      />
      Unsaved changes
    </>
  );
}
