"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArchiveIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SearchIcon,
} from "lucide-react";
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
import {
  DiscoveryEmptyState,
  DiscoveryFilterBar,
  DiscoveryListCard,
  DiscoveryLoadingState,
  DiscoverySectionHeader,
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteMasthead,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";
import { formatDiscoveryDate } from "@/lib/discovery/format-discovery-date";
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
  const [filterOptions, setFilterOptions] =
    useState<CampaignIntelligenceLibraryFilterOptions | null>(null);
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load intelligence library.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    void getCampaignIntelligenceLibraryFilterOptionsAction()
      .then(setFilterOptions)
      .catch(() =>
        setFilterOptions({ brands: [], clients: [], campaigns: [] }),
      );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const campaignsForBrand = useMemo(() => {
    if (!filters.brandId || !filterOptions)
      return filterOptions?.campaigns ?? [];
    return filterOptions.campaigns.filter(
      (campaign) => campaign.brandId === filters.brandId,
    );
  }, [filterOptions, filters.brandId]);

  function updateFilter<K extends keyof CampaignIntelligenceLibraryFilters>(
    key: K,
    value: CampaignIntelligenceLibraryFilters[K],
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

  const countLabel = loading
    ? "…"
    : `${items.length} record${items.length === 1 ? "" : "s"}`;
  const mastheadMetrics = useMemo(
    () => [
      { label: "Records", value: items.length },
      {
        label: "Brands",
        value: new Set(items.map((item) => item.brandId).filter(Boolean)).size,
      },
      {
        label: "Legal entities",
        value: new Set(items.map((item) => item.clientId).filter(Boolean)).size,
      },
    ],
    [items],
  );

  const filterBar = (
    <DiscoveryFilterBar embedded countLabel={countLabel}>
      <div className="relative min-w-[180px] flex-1">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-[var(--text-3)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search intelligence…"
          className="h-9 rounded-[var(--radius)] border-[var(--tw-border)] pl-9 text-[12.5px]"
        />
      </div>
      <Select
        value={filters.clientId ?? "all"}
        onValueChange={(value) =>
          updateFilter("clientId", value === "all" ? null : value)
        }
      >
        <SelectTrigger className="h-9 min-w-[130px] text-[12.5px] font-semibold">
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
        onValueChange={(value) =>
          updateFilter("brandId", value === "all" ? null : value)
        }
      >
        <SelectTrigger className="h-9 min-w-[130px] text-[12.5px] font-semibold">
          <SelectValue placeholder="Brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All brands</SelectItem>
          {(filterOptions?.brands ?? [])
            .filter(
              (brand) =>
                !filters.clientId || brand.clientId === filters.clientId,
            )
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
        <SelectTrigger className="h-9 min-w-[130px] text-[12.5px] font-semibold">
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
            value as CampaignIntelligenceLibraryFilters["status"],
          )
        }
      >
        <SelectTrigger className="h-9 min-w-[130px] text-[12.5px] font-semibold">
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
    </DiscoveryFilterBar>
  );

  return (
    <div
      className={cn(
        "discovery-suite min-w-0 bg-[var(--tw-bg)]",
        compact && "rounded-[var(--radius-md)]",
        className,
      )}
    >
      {!compact ? (
        <DiscoverySuiteMasthead
          title="Campaign Intelligence Library"
          metrics={mastheadMetrics}
          freezeOnScroll={false}
        />
      ) : null}

      <DiscoveryListCard
        className={cn(items.length > 0 && !loading && "mb-0 rounded-b-none")}
      >
        {compact ? (
          <DiscoverySectionHeader
            title="Campaign Intelligence Library"
            description="Shared brief intelligence across Discovery, campaigns, and AI workflows."
          />
        ) : null}
        {filterBar}
      </DiscoveryListCard>

      {loading ? (
        <DiscoveryListCard className="rounded-t-none">
          <DiscoveryLoadingState message="Loading library…" className="py-12" />
        </DiscoveryListCard>
      ) : items.length === 0 ? (
        <DiscoveryListCard className="rounded-t-none">
          <DiscoveryEmptyState
            title="No intelligence records"
            description="Upload a campaign brief in Creator Search or link intelligence from a campaign workspace."
            icon={FileTextIcon}
            className="py-12"
          />
        </DiscoveryListCard>
      ) : (
        <DiscoverySuiteGrid
          cols="minmax(200px,1.4fr) 150px minmax(170px,1fr) 150px 132px"
          minWidth={860}
          className="rounded-t-none"
          scrollerClassName={cn(
            "overflow-y-auto [scrollbar-color:rgb(226_232_240)_transparent] [scrollbar-width:thin]",
            compact ? "max-h-[280px]" : "max-h-[min(60vh,640px)]",
          )}
          header={
            <>
              <DiscoverySuiteCell>Brief</DiscoverySuiteCell>
              <DiscoverySuiteCell>Brand</DiscoverySuiteCell>
              <DiscoverySuiteCell>Legal entity</DiscoverySuiteCell>
              <DiscoverySuiteCell>Created</DiscoverySuiteCell>
              <DiscoverySuiteCell>Action</DiscoverySuiteCell>
            </>
          }
        >
          {items.map((item) => {
            const isActive = item.id === activeProfileId;
            return (
              <DiscoverySuiteRow
                key={item.id}
                selected={isActive}
                className="group"
              >
                <DiscoverySuiteCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <FileTextIcon className="mt-0.5 size-4 shrink-0 text-[var(--text-3)]" />
                    <div className="min-w-0 flex-1">
                      <p className="tw-nm">{item.title}</p>
                      <p className="tw-s">
                        {[item.campaignDocumentNumber, item.campaignName]
                          .filter(Boolean)
                          .join(" · ") || item.status}
                      </p>
                    </div>
                  </div>
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-br">
                  {item.brandName ?? <span className="tw-miss">not set</span>}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-t">
                  {item.clientName ?? <span className="tw-miss">not set</span>}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-d">
                  {formatDiscoveryDate(item.createdAt) || (
                    <span className="tw-miss">not set</span>
                  )}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell>
                  <div className="tw-act">
                    {onOpenInSearch ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] font-bold"
                        onClick={() => onOpenInSearch(item.id)}
                      >
                        Open
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] font-bold"
                        asChild
                      >
                        <Link
                          href={`/discovery/search?profileId=${encodeURIComponent(item.id)}`}
                        >
                          <ExternalLinkIcon className="size-3" />
                          Search
                        </Link>
                      </Button>
                    )}
                    {item.status !== "archived" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-[var(--text-3)]"
                        onClick={() => void handleArchive(item)}
                        aria-label={`Archive ${item.title}`}
                      >
                        <ArchiveIcon className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </DiscoverySuiteCell>
              </DiscoverySuiteRow>
            );
          })}
        </DiscoverySuiteGrid>
      )}
    </div>
  );
}
