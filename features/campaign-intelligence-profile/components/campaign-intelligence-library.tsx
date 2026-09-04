"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "@/features/discovery/components/design-system/discovery-suite-cols";
import { formatDiscoveryDateTime } from "@/lib/discovery/format-discovery-date";
import { cn } from "@/lib/utils";
import type {
  CampaignIntelligenceLibraryFilters,
  CampaignIntelligenceLibraryItem,
} from "@/lib/domains/intelligence/types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import {
  archiveCampaignIntelligenceAction,
  getCampaignIntelligenceLibraryFilterOptionsAction,
  listCampaignIntelligenceLibraryAction,
  openCampaignIntelligenceFromLibraryAction,
  type CampaignIntelligenceLibraryFilterOptions,
} from "../actions/library-actions";
import { CampaignIntelligenceDetailSheet } from "./campaign-intelligence-detail-sheet";
import {
  buildIntelligenceLibraryNote,
  countDuplicateRecords,
  findIntelligenceDuplicateGroups,
} from "../lib/intelligence-library-duplicates";

type Props = {
  onOpenInSearch?: (profileId: string) => void;
  activeProfileId?: string | null;
  compact?: boolean;
  className?: string;
  headerAction?: ReactNode;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "saved", label: "Saved" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

const INTEL_COLS = DISCOVERY_COLS.intel;
const INTEL_MIN_W = DISCOVERY_GRID_MIN_W.intel ?? 1080;

export function CampaignIntelligenceLibrary({
  onOpenInSearch,
  activeProfileId,
  compact = false,
  className,
  headerAction,
}: Props) {
  const [portfolio, setPortfolio] = useState<CampaignIntelligenceLibraryItem[]>(
    []
  );
  const [items, setItems] = useState<CampaignIntelligenceLibraryItem[]>([]);
  const [filterOptions, setFilterOptions] =
    useState<CampaignIntelligenceLibraryFilterOptions | null>(null);
  const [filters, setFilters] = useState<CampaignIntelligenceLibraryFilters>({
    status: "all",
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [briefProfile, setBriefProfile] =
    useState<CampaignIntelligenceProfile | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    try {
      const list = await listCampaignIntelligenceLibraryAction({ status: "all" });
      setPortfolio(list);
    } catch {
      setPortfolio([]);
    }
  }, []);

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
          : "Could not load intelligence library."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    void getCampaignIntelligenceLibraryFilterOptionsAction()
      .then(setFilterOptions)
      .catch(() =>
        setFilterOptions({ brands: [], clients: [], campaigns: [] })
      );
    void loadPortfolio();
  }, [loadPortfolio]);

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
      (campaign) => campaign.brandId === filters.brandId
    );
  }, [filterOptions, filters.brandId]);

  const duplicateGroups = useMemo(
    () => findIntelligenceDuplicateGroups(portfolio),
    [portfolio]
  );
  const duplicateCount = useMemo(
    () => countDuplicateRecords(portfolio),
    [portfolio]
  );
  const libraryNote = useMemo(
    () => buildIntelligenceLibraryNote(duplicateGroups),
    [duplicateGroups]
  );

  const newestLabel = useMemo(() => {
    if (portfolio.length === 0) return "—";
    const newest = portfolio.reduce((best, item) =>
      new Date(item.createdAt).getTime() > new Date(best.createdAt).getTime()
        ? item
        : best
    );
    return formatDiscoveryDateTime(newest.createdAt).split(" · ")[0] ?? "—";
  }, [portfolio]);

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
    void loadPortfolio();
  }

  async function handleOpenBrief(item: CampaignIntelligenceLibraryItem) {
    setOpeningId(item.id);
    try {
      const state = await openCampaignIntelligenceFromLibraryAction(item.id);
      if (!state?.profile) {
        toast.error("Could not open this brief.");
        return;
      }
      setBriefProfile(state.profile);
      setBriefOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open this brief."
      );
    } finally {
      setOpeningId(null);
    }
  }

  function searchHref(item: CampaignIntelligenceLibraryItem) {
    return `/discovery/search?profileId=${encodeURIComponent(item.id)}`;
  }

  function handleSearch(item: CampaignIntelligenceLibraryItem) {
    if (onOpenInSearch) {
      onOpenInSearch(item.id);
      return;
    }
    window.location.assign(searchHref(item));
  }

  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const countLabel = loading
    ? "…"
    : `${items.length} of ${portfolio.length} shown`;

  const mastheadMetrics = useMemo(
    () => [
      { label: "Records", value: portfolio.length },
      {
        label: "Brands",
        value: new Set(portfolio.map((item) => item.brandId).filter(Boolean))
          .size,
      },
      {
        label: "Legal entities",
        value: new Set(portfolio.map((item) => item.clientId).filter(Boolean))
          .size,
      },
      {
        label: "Campaigns",
        value: new Set(
          portfolio.map((item) => item.campaignHeaderId).filter(Boolean)
        ).size,
      },
      { label: "Newest", value: newestLabel, tone: "s" as const },
      {
        label: "Duplicates",
        value: duplicateCount,
        tone: duplicateCount > 0 ? ("r" as const) : undefined,
      },
    ],
    [portfolio, newestLabel, duplicateCount]
  );

  const creatorSearchControl = headerAction ?? (
    <Button
      size="sm"
      className="h-8 gap-1.5 rounded-[8px] px-3 text-[12px] font-semibold"
      asChild
    >
      <Link href="/discovery/search">
        <SearchIcon className="size-3.5" />
        Creator search
      </Link>
    </Button>
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
                !filters.clientId || brand.clientId === filters.clientId
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
            value as CampaignIntelligenceLibraryFilters["status"]
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
      {creatorSearchControl}
    </DiscoveryFilterBar>
  );

  const header = (
    <>
      <DiscoverySuiteCell>
        <input
          type="checkbox"
          className="tw-ck"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={toggleSelectAll}
          aria-label="Select all"
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Brief</DiscoverySuiteCell>
      <DiscoverySuiteCell>Brand</DiscoverySuiteCell>
      <DiscoverySuiteCell>Legal entity</DiscoverySuiteCell>
      <DiscoverySuiteCell>Created</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Action
      </DiscoverySuiteCell>
    </>
  );

  const footer = (
    <>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell>
        {items.length} of {portfolio.length} shown
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
    </>
  );

  return (
    <div
      className={cn(
        "discovery-suite min-w-0 bg-[var(--tw-bg)]",
        compact && "rounded-[var(--radius-md)]",
        className
      )}
    >
      {!compact ? (
        <DiscoverySuiteMasthead
          title="Campaign intelligence library"
          subtitle="Shared brief intelligence for Discovery, campaigns, Studio and AI"
          metrics={mastheadMetrics}
          freezeOnScroll={false}
        />
      ) : null}

      <DiscoveryListCard
        className={cn(items.length > 0 && !loading && "mb-0 rounded-b-none")}
      >
        {compact ? (
          <DiscoverySectionHeader
            title="Campaign intelligence library"
            description={`${portfolio.length} records · shared brief intelligence for Discovery, campaigns, Studio and AI`}
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
        <>
          <DiscoverySuiteGrid
            cols="intel"
            minWidth={INTEL_MIN_W}
            className="rounded-t-none"
            scrollerClassName={cn(
              "overflow-y-auto [scrollbar-color:rgb(226_232_240)_transparent] [scrollbar-width:thin]",
              compact ? "max-h-[280px]" : "max-h-[min(60vh,640px)]"
            )}
            header={header}
            footer={footer}
          >
            {items.map((item) => {
              const isActive = item.id === activeProfileId;
              const isSelected = selectedIds.has(item.id);
              const isDuplicate = duplicateGroups.some(
                (group) =>
                  group.title === item.title &&
                  group.brandName === item.brandName &&
                  group.clientName === item.clientName
              );
              const clientLabel = item.clientName ?? "";
              return (
                <DiscoverySuiteRow
                  key={item.id}
                  selected={isActive || isSelected}
                  warn={isDuplicate}
                  className="group"
                >
                  <DiscoverySuiteCell>
                    <input
                      type="checkbox"
                      className="tw-ck"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.title}`}
                    />
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <p className="tw-nm">{item.title}</p>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-br">
                    {item.brandName ?? (
                      <span className="tw-miss">not set</span>
                    )}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    {clientLabel ? (
                      <span className="tw-t" title={clientLabel}>
                        {clientLabel}
                      </span>
                    ) : (
                      <span className="tw-miss">not set</span>
                    )}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-d">
                    {formatDiscoveryDateTime(item.createdAt) || (
                      <span className="tw-miss">not set</span>
                    )}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell align="end">
                    <div className="tw-act">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] font-bold"
                        disabled={openingId === item.id}
                        onClick={() => void handleOpenBrief(item)}
                      >
                        Open
                      </Button>
                      {onOpenInSearch ? (
                        <Button
                          size="sm"
                          className="h-7 px-2 text-[11px] font-bold"
                          onClick={() => handleSearch(item)}
                        >
                          Search
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px] font-bold"
                          asChild
                        >
                          <Link href={searchHref(item)}>
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
          <p className={cn("tw-note", duplicateCount > 0 && "wrn")}>
            {libraryNote}
          </p>
        </>
      )}

      {briefProfile ? (
        <CampaignIntelligenceDetailSheet
          open={briefOpen}
          onOpenChange={(open) => {
            setBriefOpen(open);
            if (!open) setBriefProfile(null);
          }}
          profile={briefProfile}
        />
      ) : null}

      <span className="sr-only" aria-hidden>
        {INTEL_COLS}
      </span>
    </div>
  );
}
