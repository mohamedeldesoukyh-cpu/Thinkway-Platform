"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DROPDOWN_CHECKBOX_CLASS,
  DROPDOWN_EMPTY_CLASS,
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_ITEM_SELECTED_CLASS,
  DROPDOWN_SEARCH_CLASS,
  DROPDOWN_SURFACE_LIST_CLASS,
} from "@/components/ui/dropdown-surface";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deliverableTypesLabel,
  isPostTypeAllowedForCreator,
  QUOTATION_POST_TYPES,
  quotationPostTypeLabel,
  toggleDeliverableType,
} from "@/lib/quotations/quotation-deliverable-types";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (types: string[]) => void;
  allowedPlatforms: string[];
  /** When set, overrides the default types-only summary (e.g. includes per-type quantities). */
  summaryLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Open the type picker on mount (e.g. after adding a manual row). */
  defaultOpen?: boolean;
  compact?: boolean;
};

export function QuotationPostTypeMultiSelect({
  value,
  onChange,
  allowedPlatforms,
  summaryLabel,
  className,
  disabled,
  defaultOpen,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const label =
    summaryLabel ?? deliverableTypesLabel({ type: value[0] ?? "", types: value });
  const hasSelection = value.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUOTATION_POST_TYPES;
    return QUOTATION_POST_TYPES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!defaultOpen) return;
    setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlightedIndex(0);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (filtered.length === 0) return 0;
      return Math.min(prev, filtered.length - 1);
    });
  }, [filtered.length]);

  useEffect(() => {
    if (!open || filtered.length === 0) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-type-option-index="${highlightedIndex}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open, filtered.length]);

  function toggleType(typeValue: string) {
    if (!isPostTypeAllowedForCreator(typeValue, allowedPlatforms)) return;
    onChange(toggleDeliverableType(value, typeValue));
  }

  function handleListKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (filtered.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filtered.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(filtered.length - 1);
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      const option = filtered[highlightedIndex];
      if (option) toggleType(option.value);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setHighlightedIndex(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            compact
              ? "type-sel h-[34px] min-h-[34px] w-full justify-between gap-2 px-2.5 py-0 text-left font-normal shadow-none"
              : "h-auto min-h-8 w-full justify-between gap-2 px-2 py-1.5 text-left font-normal",
            className
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 text-[12.5px] leading-none",
              compact ? "truncate whitespace-nowrap" : "whitespace-normal text-[11px] leading-snug",
              hasSelection ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {hasSelection ? label : "Select type…"}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dropdown
        align="start"
        sideOffset={6}
        className="w-[min(100vw-2rem,17rem)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        onKeyDown={handleListKeyDown}
      >
        <div className={DROPDOWN_SEARCH_CLASS}>
          <SearchIcon className="thinkway-dropdown-search__icon size-3.5" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            className="thinkway-dropdown-search__input"
            placeholder="Search types…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={(event) => {
              // Keep arrows / Space for list navigation; Enter confirms and closes.
              if (
                event.key === "ArrowDown" ||
                event.key === "ArrowUp" ||
                event.key === "Home" ||
                event.key === "End" ||
                event.key === "Enter" ||
                event.key === " "
              ) {
                handleListKeyDown(event);
                return;
              }
              event.stopPropagation();
            }}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="quotation-post-type-list"
          />
        </div>
        <div
          ref={listRef}
          id="quotation-post-type-list"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Post types"
          className={DROPDOWN_SURFACE_LIST_CLASS}
        >
          {filtered.length === 0 ? (
            <p className={DROPDOWN_EMPTY_CLASS}>No matches</p>
          ) : (
            filtered.map((t, index) => {
              const checked = value.includes(t.value);
              const allowed = isPostTypeAllowedForCreator(t.value, allowedPlatforms);
              const highlighted = index === highlightedIndex;
              return (
                <label
                  key={t.value}
                  data-type-option-index={index}
                  data-slot="dropdown-menu-checkbox-item"
                  data-highlighted={highlighted ? "" : undefined}
                  role="option"
                  aria-selected={checked}
                  className={cn(
                    DROPDOWN_ITEM_CLASS,
                    checked && allowed && DROPDOWN_ITEM_SELECTED_CLASS,
                    allowed ? "cursor-pointer" : "cursor-not-allowed opacity-45"
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!allowed}
                    onCheckedChange={() => {
                      if (!allowed) return;
                      toggleType(t.value);
                    }}
                    className={DROPDOWN_CHECKBOX_CLASS}
                    aria-label={t.label}
                    tabIndex={-1}
                  />
                  <span className="min-w-0 flex-1 text-xs font-medium text-[#0f172a] dark:text-foreground">
                    {t.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Accessible summary for remove buttons etc. */
export function selectedPostTypesAriaLabel(types: string[]): string {
  if (!types.length) return "post types";
  return types.map((t) => quotationPostTypeLabel(t)).join(", ");
}
