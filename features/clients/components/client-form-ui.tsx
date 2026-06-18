"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Form controls — Thinkway client form reference (rounded inputs, brand focus ring). */
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

export function ClientFormPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6 sm:mb-[26px]">
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[26px] sm:tracking-[-0.02em]">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
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
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm",
        className
      )}
    >
      <header className="flex items-center gap-3 border-b border-border/80 px-5 py-4 sm:px-[22px] sm:py-[18px]">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--brand-product)]/10 text-[var(--brand-product)]">
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-tight text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="space-y-[18px] p-5 sm:p-[22px]">{children}</div>
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
}: {
  children: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-border/80 bg-background/85 px-4 py-3.5 backdrop-blur-md sm:-mx-5 sm:px-5 md:-mx-0 md:rounded-b-2xl">
      {status ? (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}
