"use client";

import { MoreHorizontalIcon, XIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DiscoverySelectionFlyoutMenuItem = {
  id: string;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
};

export type DiscoverySelectionFlyoutAction = {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
  /** When set, the action opens a menu instead of running a single click handler. */
  items?: DiscoverySelectionFlyoutMenuItem[];
};

type DiscoverySelectionFlyoutProps = {
  open: boolean;
  selectedCount: number;
  entityLabel: string;
  actions: DiscoverySelectionFlyoutAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  selectableCount?: number;
  busy?: boolean;
  emptyActionsMessage?: string;
  maxVisibleActions?: number;
  children?: ReactNode;
};

export const DISCOVERY_SELECTION_FLYOUT_CONTENT_CLASS =
  "pb-[5.25rem] max-md:pb-[4.75rem]";

export function discoverySelectionFlyoutContentClass(open: boolean, className?: string) {
  return cn(open && DISCOVERY_SELECTION_FLYOUT_CONTENT_CLASS, className);
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function partitionActions(
  actions: DiscoverySelectionFlyoutAction[],
  maxSecondary: number
): {
  primary: DiscoverySelectionFlyoutAction | undefined;
  secondary: DiscoverySelectionFlyoutAction[];
  overflow: DiscoverySelectionFlyoutAction[];
} {
  if (actions.length === 0) {
    return { primary: undefined, secondary: [], overflow: [] };
  }

  const explicitPrimary = actions.find(
    (action) => action.variant === "primary" || action.variant === undefined
  );
  const primary = explicitPrimary ?? actions[0];
  const rest = actions.filter((action) => action.id !== primary.id);

  const secondary: DiscoverySelectionFlyoutAction[] = [];
  const overflow: DiscoverySelectionFlyoutAction[] = [];

  for (const action of rest) {
    if (
      secondary.length < maxSecondary &&
      !action.destructive &&
      (action.variant === "outline" || action.variant === "ghost")
    ) {
      secondary.push(action);
    } else {
      overflow.push(action);
    }
  }

  return { primary, secondary, overflow };
}

function DiscoveryFlyoutDivider() {
  return (
    <div
      className="discovery-selection-flyout__divider mx-0.5 hidden h-6 w-px shrink-0 bg-white/15 sm:block"
      aria-hidden
    />
  );
}

/** Bulk selection flyout — Discovery command-bar chrome (Search, Shortlists). */
export function DiscoverySelectionFlyout({
  open,
  selectedCount,
  entityLabel,
  actions,
  onClearSelection,
  onSelectAll,
  selectableCount,
  busy,
  emptyActionsMessage,
  maxVisibleActions = 2,
  children,
}: DiscoverySelectionFlyoutProps) {
  const visible = open && selectedCount > 0;
  const { primary, secondary, overflow } = partitionActions(
    actions,
    Math.max(0, maxVisibleActions - 1)
  );

  const showSelectAll =
    onSelectAll != null &&
    selectableCount != null &&
    selectableCount > 0 &&
    selectedCount < selectableCount;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4",
        "max-md:bottom-4 max-md:pb-[env(safe-area-inset-bottom,0px)]"
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "discovery-selection-flyout pointer-events-auto w-max max-w-[min(calc(100vw-2rem),920px)] transition-all duration-300 ease-out",
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
        role="toolbar"
        aria-label="Selection actions"
      >
        <div className="discovery-selection-flyout__bar flex min-w-0 items-center gap-2 overflow-x-auto px-3 py-2.5 sm:gap-2.5 sm:px-4 sm:py-3">
          <div className="flex shrink-0 items-center gap-1.5 pr-0.5">
            <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-white/75">
              <span className="tabular-nums text-white">{selectedCount}</span>{" "}
              {pluralize(selectedCount, entityLabel)} selected
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={busy}
              className="discovery-selection-flyout__clear flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-white/20 bg-white/10 text-white/80 transition-colors hover:border-white/35 hover:bg-white/20 hover:text-white disabled:opacity-50"
              aria-label="Clear selection"
            >
              <XIcon className="size-3.5" />
            </button>
            {showSelectAll ? (
              <button
                type="button"
                onClick={onSelectAll}
                disabled={busy}
                className="hidden shrink-0 text-[11px] font-medium text-white/80 hover:text-white sm:inline-flex"
              >
                Select all
              </button>
            ) : null}
          </div>

          {primary || secondary.length > 0 || overflow.length > 0 || emptyActionsMessage ? (
            <>
              <DiscoveryFlyoutDivider />
              <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
                {primary ? (
                  <DiscoveryFlyoutPrimaryButton action={primary} busy={busy} />
                ) : null}
                {secondary.map((action) => (
                  <DiscoveryFlyoutSecondaryButton key={action.id} action={action} busy={busy} />
                ))}
                {overflow.length > 0 ? (
                  <DiscoveryFlyoutOverflowMenu actions={overflow} busy={busy} />
                ) : null}
                {!primary &&
                secondary.length === 0 &&
                overflow.length === 0 &&
                emptyActionsMessage ? (
                  <span className="shrink-0 text-[11px] text-[#64748b] dark:text-muted-foreground">{emptyActionsMessage}</span>
                ) : null}
              </div>
            </>
          ) : null}
          {children ? (
            <>
              <DiscoveryFlyoutDivider />
              <div className="flex shrink-0 items-center gap-1.5">{children}</div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DiscoveryFlyoutPrimaryButton({
  action,
  busy,
}: {
  action: DiscoverySelectionFlyoutAction;
  busy?: boolean;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || busy || action.loading}
      className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary inline-flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-xs disabled:opacity-50"
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {action.label}
    </button>
  );
}

function DiscoveryFlyoutSecondaryButton({
  action,
  busy,
}: {
  action: DiscoverySelectionFlyoutAction;
  busy?: boolean;
}) {
  const Icon = action.icon;
  const disabled = action.disabled || busy;
  const buttonClass =
    "creator-detail-sheet-action-btn inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-xs disabled:opacity-50";

  if (action.items?.length) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={disabled} className={buttonClass}>
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          side="top"
          sideOffset={8}
          className="discovery-selection-flyout-menu min-w-[14rem] w-auto rounded-2xl border border-[rgba(0,87,255,0.2)] bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] p-1.5 shadow-[0_10px_32px_rgba(0,87,255,0.12),0_2px_8px_rgba(15,23,42,0.06)] ring-0"
        >
          {action.items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              disabled={item.disabled || busy}
              onClick={item.onClick}
              className="discovery-selection-flyout-menu__item flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-2 text-xs font-medium text-[#334155] focus:bg-[rgba(0,87,255,0.08)] focus:text-[#0057FF]"
            >
              <span className="whitespace-nowrap">{item.label}</span>
              {item.description ? (
                <span className="text-[10px] font-normal text-[#64748b]">{item.description}</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={disabled}
      className={buttonClass}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="hidden sm:inline">{action.label}</span>
    </button>
  );
}

function DiscoveryFlyoutOverflowMenu({
  actions,
  busy,
}: {
  actions: DiscoverySelectionFlyoutAction[];
  busy?: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <>
      <DiscoveryFlyoutDivider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="creator-detail-sheet-action-btn size-9 shrink-0 px-0 text-[#64748b] hover:text-[#0057FF]"
            disabled={busy}
            aria-label="More actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="discovery-selection-flyout-menu min-w-[11.5rem] w-auto rounded-2xl border border-[rgba(0,87,255,0.2)] bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] p-1.5 shadow-[0_10px_32px_rgba(0,87,255,0.12),0_2px_8px_rgba(15,23,42,0.06)] ring-0"
        >
          <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b]">
            More actions
          </DropdownMenuLabel>
          {actions.map((action) => {
            const Icon = action.icon;
            if (action.items?.length) {
              return action.items.map((item) => (
                <DropdownMenuItem
                  key={`${action.id}-${item.id}`}
                  disabled={item.disabled || busy}
                  onClick={item.onClick}
                  className="discovery-selection-flyout-menu__item flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-2 text-xs font-medium text-[#334155] focus:bg-[rgba(0,87,255,0.08)] focus:text-[#0057FF]"
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.description ? (
                    <span className="text-[10px] font-normal text-[#64748b]">
                      {item.description}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ));
            }
            return (
              <DropdownMenuItem
                key={action.id}
                disabled={action.disabled || busy}
                variant={action.destructive ? "destructive" : "default"}
                onClick={action.onClick}
                className="discovery-selection-flyout-menu__item flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-2 text-xs font-medium text-[#334155] focus:bg-[rgba(0,87,255,0.08)] focus:text-[#0057FF] data-[variant=destructive]:focus:bg-red-50 data-[variant=destructive]:focus:text-red-600"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {Icon ? <Icon className="size-3.5 text-[#64748b]" aria-hidden /> : null}
                  {action.label}
                </span>
                {action.description ? (
                  <span className="pl-[1.375rem] text-[10px] font-normal text-[#64748b]">
                    {action.description}
                  </span>
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
