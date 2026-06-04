"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGridIcon, Loader2Icon, SearchIcon, UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatorBrowserDialog } from "@/features/campaigns/components/creator-browser-dialog";
import { DocumentNumber } from "@/components/ui/document-number";
import { cn } from "@/lib/utils";
import type { InfluencerSearchResult } from "@/features/campaigns/types";

const RECENT_KEY = "thinkway:recent-influencers";
const RECENT_MAX = 5;

function loadRecent(): InfluencerSearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as InfluencerSearchResult[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: InfluencerSearchResult) {
  const existing = loadRecent().filter((r) => r.id !== item.id);
  const next = [item, ...existing].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

type InfluencerTypeaheadProps = {
  value: string;
  onSelect: (influencer: InfluencerSearchResult) => void;
  disabled?: boolean;
  selectedLabel?: string | null;
};

export function InfluencerTypeahead({
  value,
  onSelect,
  disabled,
  selectedLabel,
}: InfluencerTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InfluencerSearchResult[]>([]);
  const [recent, setRecent] = useState<InfluencerSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [browserOpen, setBrowserOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayList = query.trim().length >= 1 ? results : recent;

  const fetchResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      const res = await fetch(`/api/campaigns/influencers?${params}`);
      const data = (await res.json()) as {
        results?: InfluencerSearchResult[];
        error?: string;
      };
      setResults(data.results ?? []);
      setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchResults(query.trim());
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchResults]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(item: InfluencerSearchResult) {
    saveRecent(item);
    setRecent(loadRecent());
    onSelect(item);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || displayList.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, displayList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(displayList[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative grid gap-2">
      <Label htmlFor="influencer_search">Influencer / creator</Label>
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2">
          <UserIcon className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{selectedLabel}</p>
            <p className="text-xs text-muted-foreground">Selected — search below to change</p>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="influencer_search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Type to search creators… e.g. mo"
            disabled={disabled}
            className="pl-9"
            autoComplete="off"
          />
          {loading ? (
            <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => setBrowserOpen(true)}
          disabled={disabled}
        >
          <LayoutGridIcon data-icon="inline-start" />
          Browse
        </Button>
      </div>
      <CreatorBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={pick}
      />
      {open && displayList.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-md"
          role="listbox"
        >
          {!query.trim() && recent.length > 0 ? (
            <li className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Recent
            </li>
          ) : null}
          {displayList.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  index === activeIndex ? "bg-accent" : "hover:bg-accent/60"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(item)}
              >
                <span className="font-medium">{item.display_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  <DocumentNumber value={item.document_number} />
                </span>
                {item.platforms.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.platforms
                      .map((p) => `@${p.handle} · ${p.platform}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : open && query.trim() && !loading ? (
        <p className="text-xs text-muted-foreground">No creators match your search.</p>
      ) : null}
    </div>
  );
}
