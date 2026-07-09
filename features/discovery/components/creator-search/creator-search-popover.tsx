"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { useDebouncedValue } from "@/features/creators/picker/creator-selection-hooks";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

type Props = {
  /** External query (URL, clear filters, programmatic sync). */
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  loading?: boolean;
};

export function CreatorSearchPopover({
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  loading,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState(searchQuery);
  const debouncedDraft = useDebouncedValue(draftSearch, SEARCH_DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedDraft === searchQuery) return;
    onDebouncedSearchChange(debouncedDraft);
  }, [debouncedDraft, searchQuery, onDebouncedSearchChange]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs",
            hasQuery && "border-primary/30 bg-primary/5"
          )}
          aria-label={hasQuery ? `Search: ${searchQuery}` : "Search creators"}
        >
          <SearchIcon className="size-3.5 shrink-0" />
          {hasQuery ? (
            <span className="max-w-[100px] truncate font-normal text-muted-foreground sm:max-w-[140px]">
              {searchQuery}
            </span>
          ) : (
            <span className="sr-only">Search</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(300px,calc(100vw-1.5rem))] rounded-lg border-border bg-background p-2 shadow-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit(draftSearch);
            setOpen(false);
          }}
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            {loading ? (
              <Loader2Icon
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
              />
            ) : null}
            <Input
              ref={inputRef}
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Type to search"
              className="h-8 border-border bg-background pl-8 pr-8 text-[12px] focus-visible:border-primary"
            />
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
