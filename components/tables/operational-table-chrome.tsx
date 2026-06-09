"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  ArrowDownUpIcon,
  Columns3Icon,
  ListFilterIcon,
  SearchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const operationalTableChrome = {
  toolbarButton: cn(
    "group/table-tool relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2",
    "text-xs font-medium text-muted-foreground",
    "transition-colors duration-150",
    "hover:bg-muted/40 hover:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-product)]/25"
  ),
  toolbarButtonActive: "text-[var(--brand-product)] hover:text-[var(--brand-product)]",
  selectTrigger: cn(
    "h-8 w-fit gap-1.5 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none",
    "transition-colors duration-150",
    "hover:bg-muted/40 hover:text-foreground",
    "focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-product)]/25",
    "data-[state=open]:bg-muted/40 data-[state=open]:text-foreground"
  ),
  searchInput: cn(
    "h-8 rounded-lg border-0 bg-transparent pl-9 pr-9 text-xs shadow-none",
    "focus-visible:border-transparent focus-visible:ring-0"
  ),
  panelShell: "rounded-2xl border border-border/55 bg-popover shadow-xl",
} as const;

type OperationalTableToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
};

export function OperationalTableToolbarButton({
  icon: Icon,
  label,
  active = false,
  className,
  ...props
}: OperationalTableToolbarButtonProps) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className={cn(
        operationalTableChrome.toolbarButton,
        active && operationalTableChrome.toolbarButtonActive,
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function OperationalTableActionCluster({ children }: { children: ReactNode }) {
  return <div className="inline-flex shrink-0 flex-wrap items-center gap-0.5">{children}</div>;
}

type OperationalTableSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  isPending?: boolean;
};

export function OperationalTableSearchField({
  value,
  onChange,
  onClear,
  placeholder,
  isPending = false,
}: OperationalTableSearchFieldProps) {
  return (
    <div className="relative w-full min-w-[12rem] max-w-sm">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
        aria-hidden
      />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={operationalTableChrome.searchInput}
        aria-busy={isPending}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          aria-label="Clear search"
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export const OperationalTableIcons = {
  filter: ListFilterIcon,
  sort: ArrowDownUpIcon,
  settings: Columns3Icon,
} as const;
