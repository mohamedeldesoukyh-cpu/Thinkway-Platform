"use client";

import { useEffect, useState } from "react";
import { createSearchDebouncer } from "./creator-search-timing";

import { normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";

import {
  clearDiscoverySearchDraft,
  readDiscoverySearchDraft,
  writeDiscoverySearchDraft,
} from "./creator-search-draft-storage";

function normalizeSearchDraft(value: string): string {
  const normalized = /^https?:\/\//i.test(value.trim()) || value.trim().startsWith("@") ? normalizeDiscoverySearchQuery(value) : value.trim();
  return normalized || value;
}

type Props = {
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  loading?: boolean;
};

/** Pack `.tw-search` field — always visible in the Creators card header. */
export function CreatorSearchInlineField({
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  loading,
}: Props) {
  const [draft, setDraft] = useState(
    () => searchQuery.trim() || readDiscoverySearchDraft()
  );
  const [debouncer] = useState(() => createSearchDebouncer());
  const [previousQuery, setPreviousQuery] = useState(searchQuery);
  if (previousQuery !== searchQuery) { setPreviousQuery(searchQuery); setDraft(searchQuery); }
  useEffect(() => () => debouncer.cancel(), [debouncer]);

  useEffect(() => {
    debouncer.cancel();
    if (!searchQuery.trim()) clearDiscoverySearchDraft();
    else writeDiscoverySearchDraft(searchQuery);
  }, [searchQuery, debouncer]);

  function apply(next: string) {
    const normalized = normalizeSearchDraft(next);
    setDraft(normalized);
    writeDiscoverySearchDraft(normalized);
    debouncer.submit(() => onSearchSubmit(normalized));
  }

  return (
    <span className="tw-search" style={{ flex: "0 0 230px" }}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4.3-4.3" />
      </svg>
      <input
        className="tw-in"
        value={draft}
        placeholder="Search creators…"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search creators"
        aria-busy={loading || undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          writeDiscoverySearchDraft(next);
          debouncer.schedule(() => {
            onDebouncedSearchChange(normalizeSearchDraft(next));
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply(draft);
          }
        }}
      />
    </span>
  );
}
