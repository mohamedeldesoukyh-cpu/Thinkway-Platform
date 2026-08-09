"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { useDebouncedValue } from "@/features/creators/picker/creator-selection-hooks";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";

import {
  clearDiscoverySearchDraft,
  readDiscoverySearchDraft,
  writeDiscoverySearchDraft,
} from "./creator-search-draft-storage";
import {
  DISCOVERY_TOOLBAR_ICON_PROPS,
  DiscoveryToolbarActiveBadge,
  discoveryToolbarBtnClass,
} from "./creator-search-toolbar-utils";
import { shouldPropagateDebouncedSearchDraft } from "./creator-search-popover-sync";

/** Typing is instant; browse/URL update after this pause while the popover is open. */
const APPLY_SEARCH_DEBOUNCE_MS = 280;

function normalizeSearchDraft(value: string): string {
  const normalized = normalizeDiscoverySearchQuery(value);
  return normalized || value;
}

type Props = {
  /** External query (URL, clear filters, programmatic sync). */
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  loading?: boolean;
};

function resolveDraftSeed(searchQuery: string): string {
  if (searchQuery.trim()) return searchQuery;
  return readDiscoverySearchDraft();
}

export function CreatorSearchPopover({
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  loading,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState(() => resolveDraftSeed(searchQuery));
  const debouncedDraft = useDebouncedValue(draftSearch, APPLY_SEARCH_DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousSearchQueryRef = useRef(searchQuery);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setDraftSearch(searchQuery);
    if (!searchQuery.trim()) {
      clearDiscoverySearchDraft();
    } else {
      writeDiscoverySearchDraft(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      const seed = searchQuery.trim() || readDiscoverySearchDraft();
      setDraftSearch(seed);
      const id = requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open, searchQuery]);

  useEffect(() => {
    if (!open) return;
    if (
      !shouldPropagateDebouncedSearchDraft({
        debouncedDraft,
        draftSearch,
        searchQuery,
        previousSearchQuery: previousSearchQueryRef.current,
      })
    ) {
      return;
    }
    onDebouncedSearchChange(debouncedDraft);
    writeDiscoverySearchDraft(debouncedDraft);
  }, [debouncedDraft, draftSearch, open, searchQuery, onDebouncedSearchChange]);

  useEffect(() => {
    previousSearchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={discoveryToolbarBtnClass(hasQuery)}
              aria-label={hasQuery ? `Search: ${searchQuery}` : "Search creators"}
            >
              <SearchIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
              {hasQuery ? <DiscoveryToolbarActiveBadge /> : null}
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">Search</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(300px,calc(100vw-1.5rem))] rounded-lg border-border bg-background p-2 shadow-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = normalizeSearchDraft(draftSearch);
            setDraftSearch(next);
            writeDiscoverySearchDraft(next);
            onSearchSubmit(next);
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
              onChange={(e) => {
                const next = normalizeSearchDraft(e.target.value);
                setDraftSearch(next);
                writeDiscoverySearchDraft(next);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!pasted?.trim()) return;
                const next = normalizeSearchDraft(pasted);
                if (next === pasted.trim()) return;
                e.preventDefault();
                setDraftSearch(next);
                writeDiscoverySearchDraft(next);
              }}
              placeholder="Name, @handle, or profile link"
              className="h-8 border-border bg-background pl-8 pr-8 text-[12px] focus-visible:border-primary"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
