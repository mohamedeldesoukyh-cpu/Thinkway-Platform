"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheckIcon,
  Loader2Icon,
  SearchIcon,
  UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
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
import { PLATFORM_OPTIONS } from "@/features/campaigns/constants";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { InfluencerSearchResult } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type CreatorBrowserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (creator: InfluencerSearchResult) => void;
};

function formatFollowers(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function CreatorBrowserDialog({
  open,
  onOpenChange,
  onSelect,
}: CreatorBrowserDialogProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [minFollowers, setMinFollowers] = useState("");
  const [minEngagement, setMinEngagement] = useState("");
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<InfluencerSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchCreators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: "browse", page: String(page) });
      if (search.trim()) params.set("q", search.trim());
      if (platform) params.set("platform", platform);
      if (country.trim()) params.set("country", country.trim());
      if (category.trim()) params.set("category", category.trim());
      if (minFollowers.trim()) params.set("minFollowers", minFollowers.trim());
      if (minEngagement.trim()) params.set("minEngagement", minEngagement.trim());

      const res = await fetch(`/api/campaigns/influencers?${params}`);
      const data = (await res.json()) as {
        creators?: InfluencerSearchResult[];
        total?: number;
        error?: string;
      };
      setCreators(data.creators ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, platform, country, category, minFollowers, minEngagement, page]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void fetchCreators(), 200);
    return () => clearTimeout(timer);
  }, [open, fetchCreators]);

  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open, search, platform, country, category, minFollowers, minEngagement]);

  function pick(creator: InfluencerSearchResult) {
    onSelect(creator);
    onOpenChange(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Browse creators</DialogTitle>
          <DialogDescription>
            Search by name, handle, or profile URL. Filter by platform, country,
            category, and audience metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative sm:col-span-2 lg:col-span-3">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, handle, or URL…"
                className="pl-9"
              />
            </div>
            <FilterSelect
              label="Platform"
              value={platform}
              onChange={setPlatform}
              options={[{ value: "", label: "All platforms" }, ...PLATFORM_OPTIONS.filter((p) => p.value !== "multi")]}
            />
            <div className="grid gap-2">
              <Label>Country</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="EG, AE, SA…"
                maxLength={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Category / niche</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Beauty, gaming…"
              />
            </div>
            <div className="grid gap-2">
              <Label>Min followers</Label>
              <Input
                type="number"
                min={0}
                value={minFollowers}
                onChange={(e) => setMinFollowers(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="grid gap-2">
              <Label>Min engagement %</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={minEngagement}
                onChange={(e) => setMinEngagement(e.target.value)}
                placeholder="2.5"
              />
            </div>
          </div>

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
            <ul className="divide-y rounded-2xl border">
              {creators.map((creator) => {
                const primary = creator.platforms[0];
                const maxFollowers = Math.max(
                  ...creator.platforms.map((p) => p.follower_count ?? 0),
                  0
                );
                const verified = creator.platforms.some((p) => p.is_verified);
                return (
                  <li key={creator.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                      onClick={() => pick(creator)}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{creator.display_name}</span>
                          {verified ? (
                            <BadgeCheckIcon className="size-4 text-sky-500" aria-label="Verified" />
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            <DocumentNumber value={creator.document_number} />
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {creator.platforms.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-[10px]">
                              {platformLabel(p.platform)} · @{p.handle}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {creator.country_code ?? "—"}
                          {creator.categories?.length
                            ? ` · ${creator.categories.join(", ")}`
                            : ""}
                          {maxFollowers > 0
                            ? ` · ${formatFollowers(maxFollowers)} followers`
                            : ""}
                          {primary?.engagement_rate != null
                            ? ` · ${primary.engagement_rate}% ER`
                            : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {total} creator{total === 1 ? "" : "s"}
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
        <SelectTrigger className="w-full">
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
