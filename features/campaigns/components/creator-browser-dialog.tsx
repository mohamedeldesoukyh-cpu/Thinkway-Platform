"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitCompareArrowsIcon, Loader2Icon } from "lucide-react";

import { OperationalTableSearchField } from "@/components/tables/operational-table-chrome";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
import { CreatorUnifiedCard } from "@/features/campaigns/components/creator-unified-card";
import {
  addCreatorToCampaignShortlistAction,
  browseUnifiedCreatorsAction,
} from "@/features/campaigns/creator-discovery-actions";
import { isAssignableCreator, unifiedToInfluencerSearch } from "@/lib/creators/adapters";
import type { InfluencerSearchResult } from "@/features/campaigns/types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";

type CreatorBrowserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (creator: InfluencerSearchResult) => void;
  campaignHeaderId?: string;
};

export function CreatorBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  campaignHeaderId,
}: CreatorBrowserDialogProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [source, setSource] = useState("all");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [minEngagement, setMinEngagement] = useState("");
  const [minViews, setMinViews] = useState("");
  const [minThinkwayScore, setMinThinkwayScore] = useState("");
  const [minAiScore, setMinAiScore] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [internalCount, setInternalCount] = useState(0);
  const [discoveryCount, setDiscoveryCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCreator, setDetailCreator] = useState<UnifiedCreatorResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchCreators = useCallback(async () => {
    setLoading(true);
    try {
      const result = await browseUnifiedCreatorsAction({
        search: search.trim() || undefined,
        platform: platform || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        category: category.trim() || undefined,
        language: language.trim() || undefined,
        source: source === "all" ? undefined : (source as UnifiedCreatorResult["source_type"]),
        minFollowers: minFollowers ? Number(minFollowers) : undefined,
        maxFollowers: maxFollowers ? Number(maxFollowers) : undefined,
        minEngagement: minEngagement ? Number(minEngagement) : undefined,
        minViews: minViews ? Number(minViews) : undefined,
        minThinkwayScore: minThinkwayScore ? Number(minThinkwayScore) : undefined,
        minAiScore: minAiScore ? Number(minAiScore) : undefined,
        verifiedOnly,
        page,
        pageSize: 12,
      });
      setCreators(result.creators);
      setTotal(result.total);
      setInternalCount(result.internal_count);
      setDiscoveryCount(result.discovery_count);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    platform,
    country,
    city,
    category,
    language,
    source,
    minFollowers,
    maxFollowers,
    minEngagement,
    minViews,
    minThinkwayScore,
    minAiScore,
    verifiedOnly,
    page,
  ]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void fetchCreators(), 200);
    return () => clearTimeout(timer);
  }, [open, fetchCreators]);

  useEffect(() => {
    if (open) setPage(1);
  }, [
    open,
    search,
    platform,
    country,
    city,
    category,
    language,
    source,
    minFollowers,
    maxFollowers,
    minEngagement,
    minViews,
    minThinkwayScore,
    minAiScore,
    verifiedOnly,
  ]);

  const selectedCreators = useMemo(
    () => creators.filter((c) => selectedIds.has(c.unified_id)),
    [creators, selectedIds]
  );

  function pick(creator: UnifiedCreatorResult) {
    const legacy = unifiedToInfluencerSearch(creator);
    if (!legacy) {
      setStatusMessage("Public discovery profiles must be added to shortlist or imported first.");
      return;
    }
    onSelect(legacy);
    onOpenChange(false);
  }

  async function bulkAddToShortlist() {
    if (!campaignHeaderId || selectedCreators.length === 0) return;
    for (const creator of selectedCreators) {
      await addCreatorToCampaignShortlistAction(campaignHeaderId, creator);
    }
    setStatusMessage(`Added ${selectedCreators.length} creators to campaign shortlist.`);
    setSelectedIds(new Set());
  }

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Creator Browser</DialogTitle>
            <DialogDescription>
              Internal vendors and public discovery profiles in one search. Thinkway score ranks
              blended results.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <OperationalTableSearchField
                value={search}
                onChange={setSearch}
                onClear={() => setSearch("")}
                placeholder="Search name, handle, bio, niche…"
              />
              <Button
                type="button"
                variant={compareMode ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setCompareMode((v) => !v)}
              >
                <GitCompareArrowsIcon className="size-3.5" data-icon="inline-start" />
                Compare
              </Button>
              {campaignHeaderId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={selectedCreators.length === 0}
                  onClick={() => void bulkAddToShortlist()}
                >
                  Add {selectedCreators.length || ""} to shortlist
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                label="Platform"
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: "", label: "All platforms" },
                  ...DISCOVERY_PLATFORMS.map((p) => ({ value: p, label: p })),
                ]}
              />
              <FilterSelect
                label="Source"
                value={source}
                onChange={setSource}
                options={[
                  { value: "all", label: "All sources" },
                  { value: "internal", label: "Internal" },
                  { value: "public_discovery", label: "Public Discovery" },
                  { value: "oauth_verified", label: "OAuth Verified" },
                  { value: "imported", label: "Imported" },
                ]}
              />
              <div className="grid gap-2">
                <Label>Country</Label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  placeholder="AE, EG, SA"
                  className="h-8 text-xs"
                  maxLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Dubai"
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Category / niche</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Beauty, gaming"
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Language</Label>
                <Input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="ar, en"
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Min followers</Label>
                <Input
                  type="number"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Max followers</Label>
                <Input
                  type="number"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Min engagement %</Label>
                <Input
                  type="number"
                  step={0.1}
                  value={minEngagement}
                  onChange={(e) => setMinEngagement(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Min avg views</Label>
                <Input
                  type="number"
                  value={minViews}
                  onChange={(e) => setMinViews(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Min Thinkway score</Label>
                <Input
                  type="number"
                  value={minThinkwayScore}
                  onChange={(e) => setMinThinkwayScore(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Min AI brand fit</Label>
                <Input
                  type="number"
                  value={minAiScore}
                  onChange={(e) => setMinAiScore(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                />
                Verified only
              </label>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {total} creators · {internalCount} internal · {discoveryCount} discovery
            </p>

            {statusMessage ? (
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                {statusMessage}
              </p>
            ) : null}

            {compareMode && selectedCreators.length >= 2 ? (
              <div className="grid gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 md:grid-cols-2">
                {selectedCreators.slice(0, 3).map((creator) => (
                  <CreatorUnifiedCard key={creator.unified_id} creator={creator} compact />
                ))}
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2Icon className="mr-2 size-5 animate-spin" />
                Loading creators…
              </div>
            ) : creators.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No creators match your filters.
              </p>
            ) : (
              <div className="grid gap-3">
                {creators.map((creator) => (
                  <CreatorUnifiedCard
                    key={creator.unified_id}
                    creator={creator}
                    selected={selectedIds.has(creator.unified_id)}
                    onToggleSelect={
                      campaignHeaderId || compareMode
                        ? (checked) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(creator.unified_id);
                              else next.delete(creator.unified_id);
                              return next;
                            });
                          }
                        : undefined
                    }
                    onOpenDetail={() => setDetailCreator(creator)}
                    onPrimaryAction={() => pick(creator)}
                    primaryActionLabel={
                      isAssignableCreator(creator) ? "Assign to line" : "Shortlist only"
                    }
                  />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <CreatorDetailSheet
        creator={detailCreator}
        open={Boolean(detailCreator)}
        onOpenChange={(v) => !v && setDetailCreator(null)}
        onAssign={pick}
        campaignHeaderId={campaignHeaderId}
      />
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || "__all"} value={o.value || "__all"}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
