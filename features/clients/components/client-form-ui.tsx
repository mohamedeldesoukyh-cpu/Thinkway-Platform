"use client";

import type { LucideIcon } from "lucide-react";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { cn } from "@/lib/utils";

/** Marks a form as the Ctrl+S / Cmd+S save target (see KeyboardShortcutsProvider). */
export const CLIENT_FORM_SHORTCUT_SAVE_ATTR = "data-shortcut-save";

/**
 * Footer hint for client profile tab forms that register `useClientFormSaveShortcut`.
 *
 * Wired forms (when their tab is active):
 * - Overview: `#client-overview-form`
 * - Brands: add-brand dialog (`#client-add-brand-form` when open)
 * - Legal: `#client-legal-form`
 * - Finance: `#client-finance-form`
 */
export const CLIENT_FORM_SAVE_SHORTCUT_HINT = "Ctrl+S to save";

/** Registers Ctrl+S / Cmd+S to submit a form when `enabled` (e.g. active tab or open dialog). */
export function useClientFormSaveShortcut({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useRegisterShortcut(
    enabled
      ? {
          id: `client-form-save-${formId}`,
          keys: "ctrl+s",
          label: "Save form",
          group: "Forms",
          global: true,
          handler: () => {
            if (disabled) return;
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          },
        }
      : null
  );
}

export function ClientFormKeyboardShortcuts({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useClientFormSaveShortcut({ formId, enabled, disabled });
  return null;
}

/** Form controls — Thinkway client form reference (Form_4: blue brand, neutral surfaces). */
export const CLIENT_FORM_MAX_WIDTH = "max-w-[880px]";

export const CLIENT_FORM_INPUT_CLASS = cn(
  "h-auto min-h-9 w-full rounded-[10px] border-[#E6EAF2] bg-[#F5F8FD] px-[13px] py-[11px] text-[13.5px] text-[#0B0F1A] shadow-none",
  "placeholder:text-[#9099A8]",
  "focus-visible:border-[#0057FF] focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-[#EEF4FF]"
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
  "text-[12.5px] font-semibold text-[#3A4254]";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-[#9099A8]";

export const CLIENT_FORM_PRIMARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent px-4 py-2.5",
  "bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)]",
  "text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)]",
  "transition-[transform,box-shadow] active:scale-[0.97]",
  "hover:shadow-[0_6px_20px_rgba(0,87,255,0.42)]",
  "disabled:pointer-events-none disabled:opacity-50"
);

/** Form_4 primary submit for client profile tabs (Brands, Legal, Finance). */
export function ClientProfileTabSaveButton({
  formId,
  label,
  pendingLabel = "Saving…",
  isPending = false,
  disabled = false,
  showSaveIcon = true,
}: {
  formId: string;
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  showSaveIcon?: boolean;
}) {
  return (
    <button
      type="submit"
      form={formId}
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      disabled={disabled || isPending}
    >
      {showSaveIcon ? (
        <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      ) : null}
      {isPending ? pendingLabel : label}
    </button>
  );
}

export const CLIENT_FORM_SECONDARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border border-[#E6EAF2] bg-white px-3 py-1.5",
  "text-xs font-semibold text-[#0B0F1A] transition-[border-color,background-color,transform]",
  "hover:border-[#D7DEEA] active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-[#5B6575] transition-colors",
  "hover:bg-[#F5F8FD] hover:text-[#0B0F1A] active:scale-[0.97]",
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
      <h1 className="text-[25px] font-extrabold tracking-[-0.035em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-[5px] text-sm text-[#5B6575]">{description}</p>
      ) : null}
    </header>
  );
}

export type ClientFormBreadcrumb = {
  label: string;
  href?: string;
};

/** Top bar — Form_4 breadcrumbs + Cancel / Save actions. */
export function ClientFormTopbar({
  breadcrumbs,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
}: {
  breadcrumbs: ClientFormBreadcrumb[];
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="z-15 flex h-[62px] shrink-0 items-center gap-4 border-b border-[#E6EAF2] bg-white/70 px-[26px] backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13.5px]">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-[#9099A8] opacity-50" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-medium text-[#9099A8] transition-colors hover:text-[#3A4254]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-semibold text-[#0B0F1A]" : "font-medium text-[#9099A8]"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {onCancel ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onCancel}
            disabled={saveDisabled}
          >
            Cancel
          </button>
        ) : null}
        {saveFormId ? (
          <button
            type="submit"
            form={saveFormId}
            className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
            disabled={saveDisabled}
          >
            <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
            {isSaving ? "Saving…" : saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Scrollable form body + pinned footer (Form_4 save bar pattern). */
export function ClientFormLayout({
  children,
  footer,
  topbar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <div className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {children}
      </div>
      {footer}
    </div>
  );
}

export const CLIENT_FORM_SCROLL_PADDING_CLASS = "px-[26px] pt-7 pb-[120px]";

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
        "overflow-hidden rounded-2xl border border-[#E6EAF2] bg-white shadow-[0_1px_2px_rgba(11,15,26,0.03)]",
        className
      )}
    >
      <header className="flex items-center gap-3 border-b border-[#E6EAF2] px-[22px] py-[18px]">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#EEF4FF] text-[#0057FF]">
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-px text-xs text-[#9099A8]">{description}</p>
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
    <div className="z-10 flex shrink-0 flex-wrap items-center gap-3.5 border-t border-[#E6EAF2] bg-white/[0.88] px-[26px] py-3.5 backdrop-blur-[14px]">
      {status ? (
        <div className="flex items-center gap-[7px] text-[12.5px] text-[#9099A8]">
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

export const CLIENT_PROFILE_BREADCRUMBS: ClientFormBreadcrumb[] = [
  { label: "Clients", href: "/clients" },
  { label: "Legal Entities", href: "/clients" },
  { label: "Edit" },
];

/** Shared Form_4 shell for client profile tabs (topbar, scroll body, optional dirty footer). */
export function ClientProfileTabShell({
  title,
  description,
  children,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={CLIENT_PROFILE_BREADCRUMBS}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}
