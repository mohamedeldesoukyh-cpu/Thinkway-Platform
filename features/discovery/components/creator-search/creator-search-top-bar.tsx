"use client";

import { ListPlusIcon, SaveIcon, SearchIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
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
  total,
  loadedCount,
  onSaveSearch,
  onCreateList,
  loading,
}: Props) {
  return (
    <div className="shrink-0 border-b border-[#E6EAF2] bg-white px-4 py-2.5 md:px-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold tracking-tight text-[#0B0F1A]">Creator Search</h1>
          <p className="text-[11px] text-[#9099A8]">
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
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onSaveSearch}
          >
            <SaveIcon className="size-3.5" />
            Save Search
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onCreateList}>
            <ListPlusIcon className="size-3.5" />
            Create List
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
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9099A8]" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search creator by name, username, or keyword"
            className="h-9 border-[#E6EAF2] bg-[#F5F8FD] pl-9 text-[13px] focus-visible:border-[#0057FF] focus-visible:bg-white"
          />
        </div>
        <Button type="submit" size="sm" className="h-9 px-4" disabled={loading}>
          Search
        </Button>
      </form>
    </div>
  );
}
