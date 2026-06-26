"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { browseUnifiedCreatorsAction } from "@/features/campaigns/creator-discovery-actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  addUnifiedCreatorsToShortlist,
  describeAddOutcome,
  isAddableCreator,
} from "../add-to-shortlist-client";

const PAGE_SIZE = 30;

const PLATFORM_OPTIONS = [
  { value: "all", label: "All platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "snapchat", label: "Snapchat" },
  { value: "x", label: "X / Twitter" },
];

/** Builds the set of identifiers already on the shortlist for dedup display. */
function buildExistingKeys(
  items: Array<{
    unified_id: string | null;
    profile_id: string | null;
    influencer_id: string | null;
  }>
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.unified_id) keys.add(item.unified_id);
    if (item.influencer_id) keys.add(`inf:${item.influencer_id}`);
    if (item.profile_id) keys.add(`dis:${item.profile_id}`);
  }
  return keys;
}

function creatorKeys(creator: UnifiedCreatorResult): string[] {
  const keys = [creator.unified_id];
  if (creator.influencer_id) keys.push(`inf:${creator.influencer_id}`);
  if (creator.discovered_profile_id) keys.push(`dis:${creator.discovered_profile_id}`);
  return keys;
}

export function AddCreatorsDrawer({
  open,
  onOpenChange,
  shortlistId,
  existingItems,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  existingItems: Array<{
    unified_id: string | null;
    profile_id: string | null;
    influencer_id: string | null;
  }>;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const reqId = useRef(0);

  const existingKeys = useMemo(() => buildExistingKeys(existingItems), [existingItems]);

  const isOnList = useCallback(
    (creator: UnifiedCreatorResult) =>
      creatorKeys(creator).some((key) => existingKeys.has(key)),
    [existingKeys]
  );

  const fetchCreators = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await browseUnifiedCreatorsAction({
        search: search.trim() || undefined,
        platform: platform === "all" ? undefined : platform,
        productionOnly: true,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      if (id !== reqId.current) return;
      setCreators(result.creators);
    } catch (err) {
      if (id !== reqId.current) return;
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [search, platform]);

  // Debounced fetch while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void fetchCreators(), 300);
    return () => clearTimeout(timer);
  }, [open, fetchCreators]);

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(new Set());
    onOpenChange(next);
  }

  function toggle(creator: UnifiedCreatorResult) {
    if (isOnList(creator) || !isAddableCreator(creator)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(creator.unified_id)) next.delete(creator.unified_id);
      else next.add(creator.unified_id);
      return next;
    });
  }

  function handleAdd() {
    const targets = creators.filter((c) => selected.has(c.unified_id));
    if (targets.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlist(shortlistId, targets);
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add creators");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
        setSelected(new Set());
        onAdded();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add creators");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>Add creators</SheetTitle>
          <SheetDescription>
            Search internal, imported, and discovered creators, then add them to this
            shortlist. Keep adding without losing your place.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or handle"
              className="pl-9"
              autoFocus
            />
          </div>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Searching…
            </div>
          ) : error ? (
            <div className="space-y-3 py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void fetchCreators()}>
                Retry
              </Button>
            </div>
          ) : creators.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No creators found. Try a different search or platform.
            </p>
          ) : (
            <ul className="space-y-1">
              {creators.map((creator) => {
                const onList = isOnList(creator);
                const addable = isAddableCreator(creator);
                const disabled = onList || !addable;
                const checked = selected.has(creator.unified_id);
                const platformInfo = creator.platforms[0];
                return (
                  <li key={creator.unified_id}>
                    <div
                      className={`flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left transition ${
                        disabled
                          ? "cursor-not-allowed opacity-60"
                          : "hover:border-border hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggle(creator)}
                        aria-label={`Select ${creator.display_name}`}
                      />
                      <div
                        role={disabled ? undefined : "button"}
                        tabIndex={disabled ? undefined : 0}
                        aria-disabled={disabled || undefined}
                        className={`flex min-w-0 flex-1 items-center gap-3 text-left outline-none ${
                          disabled ? "" : "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/25 rounded-lg"
                        }`}
                        onClick={() => {
                          if (!disabled) toggle(creator);
                        }}
                        onKeyDown={(event) => {
                          if (disabled) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggle(creator);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {creator.display_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {platformInfo
                              ? `${platformInfo.platform} · @${platformInfo.handle}`
                              : creator.source_type}
                          </p>
                        </div>
                        {creator.metrics.followers.value != null ? (
                          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                            {Intl.NumberFormat().format(creator.metrics.followers.value)}
                          </span>
                        ) : null}
                        {onList ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckIcon className="size-3" /> On list
                          </Badge>
                        ) : !addable ? (
                          <Badge variant="outline">Not addable</Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SheetFooter className="flex-row items-center justify-between border-t border-border p-4">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button onClick={handleAdd} disabled={isPending || selected.size === 0}>
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Add {selected.size > 0 ? selected.size : ""} to shortlist
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
