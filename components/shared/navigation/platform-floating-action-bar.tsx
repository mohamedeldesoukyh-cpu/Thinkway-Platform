"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontalIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Thinkway brand accent — primary floating-bar actions only. */
export const PLATFORM_FLOATING_BAR_PRIMARY_CLASS =
  "platform-floating-bar-primary !bg-[#1D9E75] !text-white hover:!bg-[#188a67] dark:!bg-[#1D9E75] dark:hover:!bg-[#22b386]";

/** @deprecated Use PLATFORM_FLOATING_BAR_PRIMARY_CLASS */
export const GLASS_FLYOUT_PRIMARY_ACTION_CLASS = PLATFORM_FLOATING_BAR_PRIMARY_CLASS;

/** Solid pill surface — white background, soft shadow (no glass blur). */
export const PLATFORM_FLOATING_BAR_SURFACE_CLASSES = "platform-floating-bar";

/** @deprecated Use PLATFORM_FLOATING_BAR_SURFACE_CLASSES */
export const GLASS_PANEL_SURFACE_CLASSES = PLATFORM_FLOATING_BAR_SURFACE_CLASSES;

/** Scroll padding when the flyout is visible. */
export const FLOATING_ACTION_BAR_OFFSET = "7rem";

export const PLATFORM_FLOATING_BAR_CONTENT_CLASS =
  "pb-[var(--floating-action-bar-offset)] max-md:pb-[var(--floating-action-bar-offset-mobile)]";

/** @deprecated Use PLATFORM_FLOATING_BAR_CONTENT_CLASS */
export const GLASS_FLYOUT_CONTENT_CLASS = PLATFORM_FLOATING_BAR_CONTENT_CLASS;

/**
 * Apply bottom padding to scroll containers when a floating bar is visible.
 */
export function platformFloatingBarContentClass(open: boolean, className?: string): string {
  return cn(open && PLATFORM_FLOATING_BAR_CONTENT_CLASS, className);
}

/** @deprecated Use platformFloatingBarContentClass */
export const glassFlyoutContentClass = platformFloatingBarContentClass;

export type PlatformFloatingBarAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
};

/** @deprecated Use PlatformFloatingBarAction */
export type GlassFlyoutAction = PlatformFloatingBarAction & {
  variant?: "primary" | "outline" | "ghost";
};

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function partitionLegacyActions(
  actions: GlassFlyoutAction[],
  maxSecondary: number
): {
  primary: GlassFlyoutAction | undefined;
  secondary: GlassFlyoutAction[];
  overflow: GlassFlyoutAction[];
} {
  if (actions.length === 0) {
    return { primary: undefined, secondary: [], overflow: [] };
  }

  const explicitPrimary = actions.find(
    (a) => a.variant === "primary" || a.variant === undefined
  );
  const primary = explicitPrimary ?? actions[0];
  const rest = actions.filter((a) => a.id !== primary.id);

  const secondary: GlassFlyoutAction[] = [];
  const overflow: GlassFlyoutAction[] = [];

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

export type PlatformFloatingBarShellProps = {
  visible: boolean;
  position?: "center" | "right";
  messages?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Fixed viewport shell with slide-up animation. */
export function PlatformFloatingBarShell({
  visible,
  position = "center",
  messages,
  className,
  children,
}: PlatformFloatingBarShellProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col gap-2 px-4 pb-2 pt-2",
        "max-md:bottom-4 max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]",
        position === "right" && "items-end sm:pr-6",
        position === "center" && "items-center",
        className
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "pointer-events-auto transition-all duration-300 ease-out",
          position === "right"
            ? "w-full max-w-[min(100vw-2rem,42rem)]"
            : "w-full max-w-[min(100vw-2rem,56rem)]",
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
      >
        <div
          className={cn(
            "flex w-full min-w-0 items-center gap-0 overflow-x-auto px-3 py-2.5 sm:px-4",
            PLATFORM_FLOATING_BAR_SURFACE_CLASSES,
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          role="toolbar"
          aria-label="Selection actions"
        >
          {children}
        </div>

        {messages ? (
          <div
            className={cn(
              "mx-auto mt-2 max-w-lg px-2 text-center transition-opacity duration-300",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            {messages}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type PlatformFloatingBarSelectionProps = {
  selectedCount: number;
  selectionLabel?: string;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  selectableCount?: number;
  busy?: boolean;
  /** When false, hides the circular clear button. Default true. */
  showClearButton?: boolean;
  className?: string;
};

/** Left section: bold count + label, circular clear, optional select-all. */
export function PlatformFloatingBarSelection({
  selectedCount,
  selectionLabel = "item",
  onClearSelection,
  onSelectAll,
  selectableCount,
  busy,
  showClearButton = true,
  className,
}: PlatformFloatingBarSelectionProps) {
  const showSelectAll =
    onSelectAll != null &&
    selectableCount != null &&
    selectableCount > 0 &&
    selectedCount < selectableCount;

  return (
    <div className={cn("flex shrink-0 items-center gap-2 pr-3", className)}>
      <p className="shrink-0 whitespace-nowrap text-sm text-foreground">
        <span className="font-semibold tabular-nums">{selectedCount}</span>{" "}
        {pluralize(selectedCount, selectionLabel)} selected
      </p>
      {showClearButton ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="platform-floating-bar-clear size-7 shrink-0 rounded-full"
          onClick={onClearSelection}
          aria-label="Clear selection"
          disabled={busy}
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
      {showSelectAll ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="hidden shrink-0 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          onClick={onSelectAll}
          disabled={busy}
        >
          Select all
        </Button>
      ) : null}
    </div>
  );
}

export function PlatformFloatingBarDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("platform-floating-bar-divider mx-1 hidden h-6 shrink-0 sm:block", className)}
      aria-hidden
    />
  );
}

export function PlatformFloatingBarPrimaryButton({
  action,
  busy,
  className,
}: {
  action: PlatformFloatingBarAction;
  busy?: boolean;
  className?: string;
}) {
  const Icon = action.icon;
  const loading = action.loading ?? false;

  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        "h-9 shrink-0 rounded-lg px-4 text-sm font-medium",
        PLATFORM_FLOATING_BAR_PRIMARY_CLASS,
        className
      )}
      disabled={action.disabled || busy || loading}
      onClick={action.onClick}
    >
      {Icon ? <Icon data-icon="inline-start" className="size-4" /> : null}
      {action.label}
    </Button>
  );
}

export function PlatformFloatingBarSecondaryLink({
  action,
  busy,
  className,
}: {
  action: PlatformFloatingBarAction;
  busy?: boolean;
  className?: string;
}) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      className={cn(
        "platform-floating-bar-secondary inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      disabled={action.disabled || busy}
      onClick={action.onClick}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      {action.label}
    </button>
  );
}

export function PlatformFloatingBarOverflowMenu({
  actions,
  busy,
  className,
}: {
  actions: PlatformFloatingBarAction[];
  busy?: boolean;
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <>
      <PlatformFloatingBarDivider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(
              "size-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              className
            )}
            disabled={busy}
            aria-label="More actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                disabled={action.disabled || busy}
                variant={action.destructive ? "destructive" : "default"}
                onClick={action.onClick}
              >
                {Icon ? <Icon className="size-3.5" /> : null}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export type PlatformFloatingActionBarProps = {
  open: boolean;
  selectedCount: number;
  selectionLabel?: string;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  selectableCount?: number;
  primaryAction?: PlatformFloatingBarAction;
  secondaryActions?: PlatformFloatingBarAction[];
  overflowActions?: PlatformFloatingBarAction[];
  children?: ReactNode;
  messages?: ReactNode;
  busy?: boolean;
  emptyActionsMessage?: string;
  position?: "center" | "right";
  className?: string;
};

/**
 * Standard platform floating action bar — pill-shaped, white surface,
 * selection count + primary / secondary / overflow actions.
 */
export function PlatformFloatingActionBar({
  open,
  selectedCount,
  selectionLabel = "item",
  onClearSelection,
  onSelectAll,
  selectableCount,
  primaryAction,
  secondaryActions = [],
  overflowActions = [],
  children,
  messages,
  busy,
  emptyActionsMessage,
  position = "center",
  className,
}: PlatformFloatingActionBarProps) {
  const visible = open && selectedCount > 0;
  const hasActions =
    primaryAction != null ||
    secondaryActions.length > 0 ||
    overflowActions.length > 0 ||
    emptyActionsMessage != null;

  return (
    <PlatformFloatingBarShell
      visible={visible}
      position={position}
      messages={messages}
      className={className}
    >
      <PlatformFloatingBarSelection
        selectedCount={selectedCount}
        selectionLabel={selectionLabel}
        onClearSelection={onClearSelection}
        onSelectAll={onSelectAll}
        selectableCount={selectableCount}
        busy={busy}
      />

      {children ? (
        <>
          <PlatformFloatingBarDivider />
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-2">
            {children}
          </div>
        </>
      ) : null}

      {hasActions ? (
        <>
          <PlatformFloatingBarDivider className="ml-auto" />
          <div className="flex shrink-0 items-center gap-1 pl-2">
            {primaryAction ? (
              <PlatformFloatingBarPrimaryButton action={primaryAction} busy={busy} />
            ) : null}
            {secondaryActions.map((action) => (
              <PlatformFloatingBarSecondaryLink key={action.id} action={action} busy={busy} />
            ))}
            {overflowActions.length > 0 ? (
              <PlatformFloatingBarOverflowMenu actions={overflowActions} busy={busy} />
            ) : null}
            {!primaryAction &&
            secondaryActions.length === 0 &&
            overflowActions.length === 0 &&
            emptyActionsMessage ? (
              <span className="shrink-0 text-xs text-muted-foreground">{emptyActionsMessage}</span>
            ) : null}
          </div>
        </>
      ) : null}
    </PlatformFloatingBarShell>
  );
}

export type GlassSelectionFlyoutProps = {
  open: boolean;
  selectedCount: number;
  entityLabel?: string;
  actions?: GlassFlyoutAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  selectableCount?: number;
  busy?: boolean;
  children?: ReactNode;
  messages?: ReactNode;
  position?: "center" | "right";
  /** Max secondary link actions shown inline before overflow. Default 2. */
  maxVisibleActions?: number;
  emptyActionsMessage?: string;
  className?: string;
};

/**
 * Selection flyout — maps legacy `actions` array to primary / secondary / overflow layout.
 */
export function GlassSelectionFlyout({
  open,
  selectedCount,
  entityLabel = "item",
  actions = [],
  onClearSelection,
  onSelectAll,
  selectableCount,
  busy,
  children,
  messages,
  position = "center",
  maxVisibleActions = 2,
  emptyActionsMessage,
  className,
}: GlassSelectionFlyoutProps) {
  const { primary, secondary, overflow } = partitionLegacyActions(
    actions,
    Math.max(0, maxVisibleActions - 1)
  );

  return (
    <PlatformFloatingActionBar
      open={open}
      selectedCount={selectedCount}
      selectionLabel={entityLabel}
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      primaryAction={primary}
      secondaryActions={secondary}
      overflowActions={overflow}
      busy={busy}
      messages={messages}
      emptyActionsMessage={emptyActionsMessage}
      position={position}
      className={className}
    >
      {children}
    </PlatformFloatingActionBar>
  );
}
