import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export {
  DROPDOWN_SURFACE_CLASS as DISCOVERY_DIALOG_SELECT_CONTENT_CLASS,
  DROPDOWN_SURFACE_CLASS as DISCOVERY_CHECKBOX_POPOVER_CONTENT_CLASS,
  DROPDOWN_SURFACE_LIST_CLASS as DISCOVERY_CHECKBOX_POPOVER_LIST_CLASS,
  DROPDOWN_ITEM_CLASS as DISCOVERY_DIALOG_LIST_ITEM_CLASS,
  DROPDOWN_ITEM_SELECTED_CLASS,
  DROPDOWN_ITEM_CLASS as DISCOVERY_DIALOG_SELECT_ITEM_CLASS,
  DROPDOWN_CHECKBOX_CLASS as DISCOVERY_DIALOG_CHECKBOX_CLASS,
} from "@/components/ui/dropdown-surface";

export const DISCOVERY_DIALOG_CONTENT_CLASS = cn(
  "discovery-dialog-content flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden rounded-2xl border border-[rgba(0,87,255,0.2)] dark:border-[rgba(0,87,255,0.28)] bg-[#f8fafc] dark:bg-background p-0 shadow-[0_10px_32px_rgba(0,87,255,0.12),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.2)] ring-0 sm:max-w-md",
  "[&_[data-slot=dialog-close]]:top-3.5 [&_[data-slot=dialog-close]]:right-3.5 [&_[data-slot=dialog-close]]:size-8 [&_[data-slot=dialog-close]]:rounded-[10px] [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-[rgba(0,87,255,0.14)] dark:[&_[data-slot=dialog-close]]:border-[rgba(0,87,255,0.24)] [&_[data-slot=dialog-close]]:bg-white dark:[&_[data-slot=dialog-close]]:bg-card [&_[data-slot=dialog-close]]:text-[#64748b] dark:[&_[data-slot=dialog-close]]:text-muted-foreground [&_[data-slot=dialog-close]]:shadow-none hover:[&_[data-slot=dialog-close]]:border-[rgba(0,87,255,0.24)] hover:[&_[data-slot=dialog-close]]:bg-[rgba(239,246,255,0.95)] dark:hover:[&_[data-slot=dialog-close]]:bg-primary/10 hover:[&_[data-slot=dialog-close]]:text-[#0057FF] dark:hover:[&_[data-slot=dialog-close]]:text-blue-300"
);

/** Outer header padding — matches filter drawer command-bar wrap. */
export const DISCOVERY_DIALOG_HEADER_WRAP_CLASS =
  "discovery-dialog-header shrink-0 bg-[#f8fafc] dark:bg-background px-4 pt-3.5 pb-0";

/** Gradient card inside header — matches filter drawer / flyout bar. */
export const DISCOVERY_DIALOG_HEADER_BAR_CLASS = "discovery-dialog-header__bar";

/** @deprecated Use DISCOVERY_DIALOG_HEADER_WRAP_CLASS + DISCOVERY_DIALOG_HEADER_BAR_CLASS */
export const DISCOVERY_DIALOG_HEADER_CLASS = DISCOVERY_DIALOG_HEADER_WRAP_CLASS;

export const DISCOVERY_DIALOG_TITLE_CLASS =
  "text-sm font-bold tracking-[-0.02em] text-[#0f172a] dark:text-foreground";

export const DISCOVERY_DIALOG_DESC_CLASS =
  "text-xs leading-relaxed text-[#64748b] dark:text-muted-foreground";

export const DISCOVERY_DIALOG_FORM_CLASS = "discovery-dialog-form flex min-h-0 flex-1 flex-col";

export const DISCOVERY_DIALOG_BODY_CLASS =
  "discovery-dialog-body min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#eef2f8] dark:bg-muted px-4 py-3";

export const DISCOVERY_DIALOG_FOOTER_CLASS =
  "discovery-dialog-footer creator-detail-sheet-footer shrink-0 border-t border-[rgba(0,87,255,0.08)] dark:border-[rgba(0,87,255,0.16)] bg-[#f8fafc] dark:bg-background px-4 py-3";

export const DISCOVERY_DIALOG_FOOTER_ACTIONS_CLASS =
  "creator-detail-sheet-footer__actions w-full justify-end gap-2";

export const DISCOVERY_DIALOG_FIELD_LABEL_CLASS =
  "discovery-dialog-field-label text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground";

export const DISCOVERY_DIALOG_FORM_PANEL_CLASS = "discovery-dialog-form-panel";

export const DISCOVERY_DIALOG_PANEL_CLASS = "discovery-dialog-panel";

export const DISCOVERY_DIALOG_SCROLL_CLASS = "discovery-dialog-scroll";

export const DISCOVERY_DIALOG_INPUT_CLASS =
  "discovery-dialog-input h-9 w-full rounded-[10px] border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card px-3 text-xs text-[#0f172a] dark:text-foreground shadow-none placeholder:text-[#94a3b8] dark:placeholder:text-muted-foreground focus-visible:border-[#0057FF] focus-visible:ring-[3px] focus-visible:ring-[rgba(0,87,255,0.12)]";

export const DISCOVERY_DIALOG_TEXTAREA_CLASS = cn(
  DISCOVERY_DIALOG_INPUT_CLASS,
  "discovery-dialog-textarea min-h-[72px] resize-none py-2"
);

export const DISCOVERY_DIALOG_SEARCH_WRAP_CLASS = "discovery-dialog-search relative";

export const DISCOVERY_DIALOG_SEARCH_ICON_CLASS =
  "pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#94a3b8] dark:text-muted-foreground";

/** Search inputs — extra left padding so the icon does not overlap placeholder text. */
export const DISCOVERY_DIALOG_SEARCH_INPUT_CLASS = cn(
  DISCOVERY_DIALOG_INPUT_CLASS,
  "pl-9 pr-3"
);

export const DISCOVERY_DIALOG_TABS_CLASS = "discovery-dialog-tabs space-y-2.5";

export const DISCOVERY_DIALOG_TABS_LIST_CLASS =
  "discovery-dialog-tabs__list grid h-9 w-full grid-cols-2 rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-[#f8fafc] dark:bg-muted p-0.5";

export const DISCOVERY_DIALOG_TABS_TRIGGER_CLASS =
  "discovery-dialog-tabs__trigger rounded-[8px] text-xs font-semibold text-[#64748b] dark:text-muted-foreground transition-colors data-active:bg-white dark:data-active:bg-card data-active:text-[#0057FF] dark:data-active:text-blue-300 data-active:shadow-[0_1px_3px_rgba(0,87,255,0.12)]";

export const DISCOVERY_DIALOG_PANEL_INSET_CLASS = "discovery-dialog-panel--inset";

export const DISCOVERY_DIALOG_TABS_CONTENT_CLASS = "discovery-dialog-tabs__content";

export const DISCOVERY_DIALOG_CREATOR_ITEM_CLASS = "discovery-dialog-creator-item";

export const DISCOVERY_DIALOG_RECENT_BUTTON_CLASS = "discovery-dialog-recent-button";

export const DISCOVERY_DIALOG_EMPTY_CLASS = "discovery-dialog-empty";

export const DISCOVERY_DIALOG_HINT_CLASS =
  "discovery-dialog-hint text-[11px] text-[#64748b] dark:text-muted-foreground";

export const DISCOVERY_DIALOG_PRIMARY_BUTTON_CLASS =
  "creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary h-8 gap-1.5 px-3 text-xs";

export const DISCOVERY_DIALOG_CANCEL_BUTTON_CLASS =
  "creator-detail-sheet-action-btn h-8 px-3 text-xs";

type DiscoveryDialogChromeProps = {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Standard Discovery dialog layout — filter drawer / flyout chrome. */
export function DiscoveryDialogChrome({
  header,
  children,
  footer,
  className,
}: DiscoveryDialogChromeProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {header ? <div className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>{header}</div> : null}
      <div className={DISCOVERY_DIALOG_BODY_CLASS}>{children}</div>
      {footer ? <div className={DISCOVERY_DIALOG_FOOTER_CLASS}>{footer}</div> : null}
    </div>
  );
}

type DiscoveryDialogHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function DiscoveryDialogHeader({
  eyebrow = "Discovery",
  title,
  description,
  className,
}: DiscoveryDialogHeaderProps) {
  return (
    <div className={cn(DISCOVERY_DIALOG_HEADER_BAR_CLASS, className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
        {eyebrow}
      </p>
      <div className={DISCOVERY_DIALOG_TITLE_CLASS}>{title}</div>
      {description ? (
        <div className={cn(DISCOVERY_DIALOG_DESC_CLASS, "mt-0.5")}>{description}</div>
      ) : null}
    </div>
  );
}
