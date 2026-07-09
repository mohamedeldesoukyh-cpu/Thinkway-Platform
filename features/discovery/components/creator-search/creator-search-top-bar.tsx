"use client";



import { ListPlusIcon, SaveIcon, SparklesIcon } from "lucide-react";

import Link from "next/link";



import { Button } from "@/components/ui/button";

import {

  DISCOVERY_PAGE_IDENTITY,

  DiscoveryPageIconBadge,

} from "@/features/discovery/components/discovery-page-identity";



type Props = {

  total: number;

  loadedCount: number;

  onSaveSearch: () => void;

  onCreateList: () => void;

  loading?: boolean;

};



export function CreatorSearchTopBar({

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

    </div>

  );

}

