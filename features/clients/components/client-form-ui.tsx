"use client";

import type { LucideIcon } from "lucide-react";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

import { PlatformV6PageSectionHeader, PlatformV6WideFormBlock } from "@/components/platform/platform-v6-layout";
import { Label } from "@/components/ui/label";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { cn } from "@/lib/utils";

const ClientProfilePlatformContext = createContext(false);

export function ClientProfilePlatformProvider({
  platformV6,
  children,
}: {
  platformV6?: boolean;
  children: ReactNode;
}) {
  return (
    <ClientProfilePlatformContext.Provider value={Boolean(platformV6)}>
      {children}
    </ClientProfilePlatformContext.Provider>
  );
}

export function useClientProfilePlatformV6() {
  return useContext(ClientProfilePlatformContext);
}

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
  "h-auto min-h-9 w-full rounded-[10px] border-border bg-muted px-[13px] py-[11px] text-[13.5px] text-foreground shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-primary/20"
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
  "text-[12.5px] font-semibold text-foreground";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-muted-foreground";

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
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5",
  "text-xs font-semibold text-foreground transition-[border-color,background-color,transform]",
  "hover:border-border/80 active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-muted-foreground transition-colors",
  "hover:bg-muted hover:text-foreground active:scale-[0.97]",
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
        <p className="mt-[5px] text-sm text-muted-foreground">{description}</p>
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
    <div className="z-15 flex h-[62px] shrink-0 items-center gap-4 border-b border-border bg-background/70 px-[26px] backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13.5px]">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground opacity-50" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
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
  iconClassName,
  toolbar,
  bodyClassName,
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  toolbar?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  /** Tighter padding for dialogs and constrained viewports. */
  compact?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <PlatformV6WideFormBlock
        icon={Icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        toolbar={toolbar}
        bodyClassName={bodyClassName}
        footer={footer}
        className={className}
      >
        {children}
      </PlatformV6WideFormBlock>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]",
        compact ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border",
          compact ? "px-4 py-3" : "px-[22px] py-[18px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary",
            compact ? "size-8" : "size-[34px]"
          )}
        >
          <Icon
            className={compact ? "size-4" : "size-[18px]"}
            strokeWidth={1.8}
            aria-hidden
          />
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
      <div
        className={cn(
          compact ? "space-y-3.5 p-4" : "space-y-[18px] p-[22px]",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function ClientFormGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  /** Override column layout when platform v6 is active. */
  columns?: 3 | 4;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const v6GridClass =
    columns === 4 ? "platform-v6-form-grid-4" : "platform-v6-form-grid";

  return (
    <div
      className={cn(
        platformV6
          ? v6GridClass
          : "grid gap-[18px] sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
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
  const platformV6 = useClientProfilePlatformV6();

  return (
    <div className={cn("grid gap-[7px]", className)}>
      <Label
        htmlFor={htmlFor}
        className={
          platformV6 ? "platform-v6-field-label" : CLIENT_FORM_FIELD_LABEL_CLASS
        }
      >
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p
            className={
              platformV6 ? "platform-v6-field-hint" : CLIENT_FORM_FIELD_HINT_CLASS
            }
          >
            {hint}
          </p>
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
    <div className="z-10 flex shrink-0 flex-wrap items-center gap-3.5 border-t border-border bg-background/90 px-[26px] py-3.5 backdrop-blur-[14px]">
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
  beforeHeader,
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
  /** Renders above the page title (e.g. onboarding progress strip). */
  beforeHeader?: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        {beforeHeader}
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

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
