"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import {
  DROPDOWN_EMPTY_CLASS,
  DROPDOWN_SEARCH_CLASS,
  DROPDOWN_SURFACE_LIST_CLASS,
  DROPDOWN_TRIGGER_CLASS,
  dropdownItemClass,
} from "@/components/ui/dropdown-surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
};

type SearchableSelectProps = {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Optional wider/taller menu surface (e.g. campaign jump with code + name). */
  contentClassName?: string;
  emptyMessage?: string;
  onOpenChange?: (open: boolean) => void;
};

export function SearchableSelect({
  id,
  name,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  contentClassName,
  emptyMessage = "No matches",
  onOpenChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(q))
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? placeholder;
  const hasValue = Boolean(value && selected);

  useEffect(() => {
    if (!open) return;
    const focusSearch = () => searchInputRef.current?.focus();
    // Wait for the portal content to mount, then focus so typing searches immediately.
    const raf = requestAnimationFrame(() => {
      focusSearch();
      window.setTimeout(focusSearch, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
          if (!next) setQuery("");
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            id={id}
            type="button"
            data-slot="select-trigger"
            data-placeholder={hasValue ? undefined : "true"}
            disabled={disabled}
            className={cn(DROPDOWN_TRIGGER_CLASS, className)}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {hasValue && selected?.description ? (
                <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
                  <span className="truncate">{selected.label}</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {selected.description}
                  </span>
                </span>
              ) : (
                selectedLabel
              )}
            </span>
            <ChevronsUpDownIcon className="thinkway-dropdown-trigger__icon size-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn(
            "z-[130] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]",
            contentClassName
          )}
          align="start"
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            // Keep Radix menu typeahead from stealing keystrokes meant for search.
            if (event.target === searchInputRef.current) {
              event.stopPropagation();
            }
          }}
        >
          <div
            className={DROPDOWN_SEARCH_CLASS}
            onPointerDown={(event) => event.preventDefault()}
          >
            <SearchIcon className="thinkway-dropdown-search__icon size-3.5" aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              className="thinkway-dropdown-search__input"
              placeholder="Search camp code or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className={DROPDOWN_SURFACE_LIST_CLASS}>
            {filtered.length === 0 ? (
              <p className={DROPDOWN_EMPTY_CLASS}>{emptyMessage}</p>
            ) : (
              filtered.map((option) => {
                const isSelected = value === option.value;
                return (
                  <DropdownMenuItem
                    key={option.value || "__empty__"}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      dropdownItemClass(isSelected),
                      "flex items-center justify-between gap-2"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="thinkway-dropdown-item__description truncate">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <CheckIcon className="size-4 shrink-0" /> : null}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
