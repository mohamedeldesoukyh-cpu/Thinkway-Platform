"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ListPlusIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageIconBadge,
} from "@/features/discovery/components/discovery-page-identity";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CREATOR_SEARCH_SORT_FIELDS,
  defaultDirectionForSortField,
  type CreatorSearchSortDirection,
  type CreatorSearchSortField,
  type CreatorSearchSortState,
} from "./creator-search-types";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
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
    <div className="shrink-0 border-b border-border bg-background px-3 py-2 md:px-4">
      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <DiscoveryPageIconBadge
            identity={DISCOVERY_PAGE_IDENTITY.search}
            size="sm"
            className="!size-8 !rounded-lg"
          />
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight text-foreground">
              {DISCOVERY_PAGE_IDENTITY.search.title}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {loading
                ? "Searching…"
                : `${loadedCount.toLocaleString()} loaded · ${total.toLocaleString()} matched`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
            <Link href="/ai">
              <SparklesIcon className="size-3.5" />
              AI Search
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onSaveSearch}>
            <SaveIcon className="size-3.5" />
            <span className="hidden sm:inline">Save Search</span>
          </Button>
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={onCreateList}>
            <ListPlusIcon className="size-3.5" />
            <span className="hidden sm:inline">Create List</span>
          </Button>
        </div>
      </div>

      <form
        className="mt-1.5 flex gap-1.5"
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
            placeholder="Search by name, category, location, hashtags…"
            className="h-8 border-border bg-muted pl-9 text-[12px] focus-visible:border-primary focus-visible:bg-background"
          />
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <ArrowUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Select
            value={sort.field}
            onValueChange={(value) =>
              onSortChange({
                field: value as CreatorSearchSortField,
                direction: defaultDirectionForSortField(value as CreatorSearchSortField),
              })
            }
          >
            <SelectTrigger className="h-8 w-[140px] border-border bg-background text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {CREATOR_SEARCH_SORT_FIELDS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort.direction}
            onValueChange={(value) =>
              onSortChange({ ...sort, direction: value as CreatorSearchSortDirection })
            }
          >
            <SelectTrigger className="h-8 w-[118px] border-border bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">
                <span className="flex items-center gap-1.5">
                  <ArrowUpIcon className="size-3" />
                  Ascending
                </span>
              </SelectItem>
              <SelectItem value="desc">
                <span className="flex items-center gap-1.5">
                  <ArrowDownIcon className="size-3" />
                  Descending
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="sm" className="h-8 px-3" disabled={loading}>
          Search
        </Button>
      </form>
    </div>
  );
}
