"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArchiveIcon, ExternalLinkIcon, FileTextIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  CampaignIntelligenceLibraryFilters,
  CampaignIntelligenceLibraryItem,
} from "@/lib/domains/intelligence/types";

import {
  archiveCampaignIntelligenceAction,
  getCampaignIntelligenceLibraryFilterOptionsAction,
  listCampaignIntelligenceLibraryAction,
  type CampaignIntelligenceLibraryFilterOptions,
} from "../actions/library-actions";

type Props = {
  onOpenInSearch?: (profileId: string) => void;
  activeProfileId?: string | null;
  compact?: boolean;
  className?: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "saved", label: "Saved" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

export function CampaignIntelligenceLibrary({
  onOpenInSearch,
  activeProfileId,
  compact = false,
  className,
}: Props) {
  const [items, setItems] = useState<CampaignIntelligenceLibraryItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<CampaignIntelligenceLibraryFilterOptions | null>(
    null
  );
  const [filters, setFilters] = useState<CampaignIntelligenceLibraryFilters>({
    status: "all",
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCampaignIntelligenceLibraryAction({
        ...filters,
        search: search.trim() || null,
      });
      setItems(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load intelligence library.");
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    void getCampaignIntelligenceLibraryFilterOptionsAction()
      .then(setFilterOptions)
      .catch(() => setFilterOptions({ brands: [], clients: [], campaigns: [] }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const campaignsForBrand = useMemo(() => {
    if (!filters.brandId || !filterOptions) return filterOptions?.campaigns ?? [];
    return filterOptions.campaigns.filter((campaign) => campaign.brandId === filters.brandId);
  }, [filterOptions, filters.brandId]);

  function updateFilter<K extends keyof CampaignIntelligenceLibraryFilters>(
    key: K,
    value: CampaignIntelligenceLibraryFilters[K]
  ) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "clientId") {
        next.brandId = null;
        next.campaignHeaderId = null;
      }
      if (key === "brandId") {
        next.campaignHeaderId = null;
      }
      return next;
    });
  }

  async function handleArchive(item: CampaignIntelligenceLibraryItem) {
    if (!window.confirm(`Archive "${item.title}"?`)) return;
    const result = await archiveCampaignIntelligenceAction(item.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Intelligence record archived.");
    void load();
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border border-[var(--camp-border)] bg-[var(--camp-surface)]",
        className
      )}
    >
      <div className="border-b border-[var(--camp-border)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold text-[var(--camp-text)]">
              Campaign Intelligence Library
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--camp-text-3)]">
              Shared brief intelligence across Discovery, campaigns, and AI workflows.
            </p>
          </div>
          {!compact ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link href="/discovery/search">
                <SearchIcon className="size-3.5" />
                Creator Search
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-[var(--camp-text-3)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 pl-8 text-xs"
            />
          </div>
          <Select
            value={filters.clientId ?? "all"}
            onValueChange={(value) =>
              updateFilter("clientId", value === "all" ? null : value)
            }
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All legal entities</SelectItem>
              {(filterOptions?.clients ?? []).map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.brandId ?? "all"}
            onValueChange={(value) => updateFilter("brandId", value === "all" ? null : value)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {(filterOptions?.brands ?? [])
                .filter((brand) => !filters.clientId || brand.clientId === filters.clientId)
                .map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.campaignHeaderId ?? "all"}
            onValueChange={(value) =>
              updateFilter("campaignHeaderId", value === "all" ? null : value)
            }
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaignsForBrand.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.documentNumber} · {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(value) =>
              updateFilter(
                "status",
                value as CampaignIntelligenceLibraryFilters["status"]
              )
            }
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-[var(--camp-text-3)]">
          <Loader2Icon className="size-4 animate-spin" />
          Loading library…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--camp-surface-2)] text-[var(--camp-text-3)]">
            <FileTextIcon className="size-4" />
          </div>
          <p className="text-sm font-medium text-[var(--camp-text)]">No intelligence records</p>
          <p className="max-w-sm text-xs text-[var(--camp-text-3)]">
            Upload a campaign brief in Creator Search or link intelligence from a campaign workspace.
          </p>
        </div>
      ) : (
        <ul
          className={cn(
            "overflow-y-auto [scrollbar-color:rgb(226_232_240)_transparent] [scrollbar-width:thin]",
            compact ? "max-h-[280px]" : "max-h-[min(60vh,640px)]"
          )}
        >
          {items.map((item) => {
            const isActive = item.id === activeProfileId;
            return (
              <li key={item.id} className="border-b border-[var(--camp-border)] last:border-b-0">
                <div
                  className={cn(
                    "flex items-start gap-3 px-4 py-3",
                    isActive && "bg-[var(--camp-blue)]/8"
                  )}
                >
                  <FileTextIcon className="mt-0.5 size-4 shrink-0 text-[var(--camp-text-3)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--camp-text)]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--camp-text-3)]">
                      {[item.brandName, item.clientName, item.campaignName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--camp-text-3)]">
                      {format(new Date(item.updatedAt), "MMM d, yyyy · h:mm a")}
                      {item.status !== "saved" ? ` · ${item.status}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {onOpenInSearch ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => onOpenInSearch(item.id)}
                      >
                        Open
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" asChild>
                        <Link href={`/discovery/search?profileId=${encodeURIComponent(item.id)}`}>
                          <ExternalLinkIcon className="size-3" />
                          Search
                        </Link>
                      </Button>
                    )}
                    {item.status !== "archived" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-[var(--camp-text-3)]"
                        onClick={() => void handleArchive(item)}
                        aria-label={`Archive ${item.title}`}
                      >
                        <ArchiveIcon className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
