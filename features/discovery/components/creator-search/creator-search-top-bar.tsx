"use client";

import {
  ArrowUpDownIcon,
  ListPlusIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CREATOR_SEARCH_SORTS, type CreatorSearchSort } from "./creator-search-types";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  sort: CreatorSearchSort;
  onSortChange: (value: CreatorSearchSort) => void;
  total: number;
  loadedCount: number;
  onSaveSearch: () => void;
  onCreateList: () => void;
  loading?: boolean;
};

export function CreatorSearchTopBar({
  search,
  onSearchChange,
  onSearchSubmit,
  sort,
  onSortChange,
  total,
  loadedCount,
  onSaveSearch,
  onCreateList,
  loading,
}: Props) {
  return (
    <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 md:px-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold tracking-tight text-foreground">Creator Search</h1>
          <p className="text-[11px] text-muted-foreground">
            {loading
              ? "Searching…"
              : `${loadedCount.toLocaleString()} loaded · ${total.toLocaleString()} matched`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link href="/ai">
              <SparklesIcon className="size-3.5" />
              AI Search
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onSaveSearch}>
            <SaveIcon className="size-3.5" />
            <span className="hidden sm:inline">Save Search</span>
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onCreateList}>
            <ListPlusIcon className="size-3.5" />
            <span className="hidden sm:inline">Create List</span>
          </Button>
        </div>
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search creator by name, username, or keyword"
            className="h-9 border-border bg-muted pl-9 text-[13px] focus-visible:border-primary focus-visible:bg-background"
          />
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <ArrowUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Select value={sort} onValueChange={(value) => onSortChange(value as CreatorSearchSort)}>
            <SelectTrigger className="h-9 w-[150px] border-border bg-background text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {CREATOR_SEARCH_SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="sm" className="h-9 px-4" disabled={loading}>
          Search
        </Button>
      </form>
    </div>
  );
}
