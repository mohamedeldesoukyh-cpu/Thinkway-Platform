"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { platformLabel } from "@/features/campaigns/line-assignment";
import {
  type DocumentExportSelection,
} from "@/features/discovery/document-preview/document-export-selection";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";
import type { DocumentSelectionSummary } from "./document-selection-summary";

export type DocumentCreatorOption = {
  /** Stable creator key used for UI selection. */
  creatorKey: string;
  /** All document item IDs belonging to this creator. */
  itemIds: string[];
  name: string;
  handle: string;
  avatarUrl?: string | null;
  meta?: string | null;
  /** Linked / deliverable platforms for this creator (export filter chips). */
  platforms?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: DocumentCreatorOption[];
  /**
   * Workspace table selection (item IDs) — single source of truth.
   * Empty means “all creators” for the initial seed.
   */
  workspaceItemIds?: string[];
  /** Sync dialog selection back into workspace state on confirm. */
  onWorkspaceSelectionChange?: (itemIds: string[]) => void;
  /** Live summary derived from the current dialog selection. */
  summarizeSelection: (itemIds: string[]) => DocumentSelectionSummary;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** When true, confirm stays disabled (e.g. linked platforms still loading). */
  confirmDisabled?: boolean;
  onConfirm: (selection: DocumentExportSelection) => void;
};

function itemIdsForCreators(
  creators: DocumentCreatorOption[],
  selectedCreatorKeys: Set<string>
): string[] {
  const ids: string[] = [];
  for (const creator of creators) {
    if (!selectedCreatorKeys.has(creator.creatorKey)) continue;
    for (const id of creator.itemIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function creatorKeysFromItemIds(
  creators: DocumentCreatorOption[],
  itemIds: string[] | null | undefined
): Set<string> {
  if (!itemIds?.length) {
    return new Set(creators.map((creator) => creator.creatorKey));
  }
  const wanted = new Set(itemIds);
  const keys = new Set<string>();
  for (const creator of creators) {
    if (creator.itemIds.some((id) => wanted.has(id))) {
      keys.add(creator.creatorKey);
    }
  }
  return keys.size > 0 ? keys : new Set(creators.map((c) => c.creatorKey));
}

function platformsForCreators(
  creators: DocumentCreatorOption[],
  selectedCreatorKeys: Set<string>
): string[] {
  const keys = new Set<string>();
  for (const creator of creators) {
    if (!selectedCreatorKeys.has(creator.creatorKey)) continue;
    for (const platform of creator.platforms ?? []) {
      const key = canonicalPlatformKey(platform);
      if (key) keys.add(key);
    }
  }
  return sortPlatformsStable([...keys].map((platform) => ({ platform }))).map(
    (entry) => entry.platform
  );
}

function initials(name: string, handle: string): string {
  const source = name.trim() || handle.replace(/^@/, "").trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function DocumentCreatorSelectionDialog({
  open,
  onOpenChange,
  creators,
  workspaceItemIds,
  onWorkspaceSelectionChange,
  summarizeSelection,
  title = "Select creators for preview",
  description = "Preview and exports include only the creators and platforms you select. Totals and numbering update automatically.",
  confirmLabel = "Open preview",
  confirmDisabled = false,
  onConfirm,
}: Props) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    () => new Set()
  );
  const platformsTouchedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      platformsTouchedRef.current = false;
      return;
    }
    // Workspace selection is the only seed — never sessionStorage.
    const nextKeys = creatorKeysFromItemIds(creators, workspaceItemIds);
    setSelectedKeys(nextKeys);
    setSelectedPlatforms(new Set(platformsForCreators(creators, nextKeys)));
    platformsTouchedRef.current = false;
  }, [open, workspaceItemIds]);

  const selectedCount = selectedKeys.size;
  const allSelected = creators.length > 0 && selectedCount === creators.length;
  const noneSelected = selectedCount === 0;

  const selectedItemIds = useMemo(
    () => itemIdsForCreators(creators, selectedKeys),
    [creators, selectedKeys]
  );

  const availablePlatforms = useMemo(
    () => platformsForCreators(creators, selectedKeys),
    [creators, selectedKeys]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedPlatforms((prev) => {
      if (!platformsTouchedRef.current) {
        // Default: keep every available platform selected (incl. late-loaded links).
        return new Set(availablePlatforms);
      }
      const next = new Set(
        availablePlatforms.filter((platform) => prev.has(platform))
      );
      if (next.size === 0 && availablePlatforms.length > 0) {
        return new Set(availablePlatforms);
      }
      return next;
    });
  }, [availablePlatforms, open]);

  const summary = useMemo(
    () => summarizeSelection(selectedItemIds),
    [summarizeSelection, selectedItemIds]
  );

  const allPlatformsSelected =
    availablePlatforms.length > 0 &&
    selectedPlatforms.size === availablePlatforms.length;
  const noPlatformsSelected =
    availablePlatforms.length > 0 && selectedPlatforms.size === 0;

  function toggleCreator(creatorKey: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(creatorKey)) next.delete(creatorKey);
      else next.add(creatorKey);
      return next;
    });
  }

  function togglePlatform(platform: string) {
    platformsTouchedRef.current = true;
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  function selectAll() {
    setSelectedKeys(new Set(creators.map((creator) => creator.creatorKey)));
  }

  function selectNone() {
    setSelectedKeys(new Set());
  }

  function selectAllPlatforms() {
    platformsTouchedRef.current = true;
    setSelectedPlatforms(new Set(availablePlatforms));
  }

  function handleConfirm() {
    if (noneSelected || noPlatformsSelected) return;
    onWorkspaceSelectionChange?.(selectedItemIds);
    const platforms =
      allPlatformsSelected || availablePlatforms.length === 0
        ? null
        : [...selectedPlatforms];
    onConfirm({ itemIds: selectedItemIds, platforms });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(820px,92vh)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <UsersIcon className="size-4 text-muted-foreground" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border/70 bg-muted/25 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-foreground">
              {summary.selectedCreatorCount} of {summary.totalCreatorCount} creator
              {summary.totalCreatorCount === 1 ? "" : "s"} selected
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[12px]"
                onClick={selectAll}
                disabled={allSelected || creators.length === 0}
              >
                Select all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[12px]"
                onClick={selectNone}
                disabled={noneSelected}
              >
                Select none
              </Button>
            </div>
          </div>
          {summary.metrics.length > 0 ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {summary.metrics.map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    {metric.label}
                  </dt>
                  <dd className="truncate text-[12.5px] font-semibold tabular-nums text-foreground">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {availablePlatforms.length > 0 ? (
          <div className="shrink-0 border-b border-border/70 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-foreground">
                Platforms to include
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[12px]"
                onClick={selectAllPlatforms}
                disabled={allPlatformsSelected}
              >
                All platforms
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {availablePlatforms.map((platform) => {
                const checked = selectedPlatforms.has(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors",
                      checked
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                    )}
                    aria-pressed={checked}
                  >
                    <PlatformIcon
                      platform={platform}
                      size="xs"
                      variant="logo"
                      className="size-4 shrink-0"
                    />
                    {platformLabel(platform)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Default includes every linked platform on the selected creators.
            </p>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {creators.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No creators available for this document.
            </p>
          ) : (
            <ul className="space-y-0.5" role="listbox" aria-multiselectable="true">
              {creators.map((creator) => {
                const checked = selectedKeys.has(creator.creatorKey);
                return (
                  <li key={creator.creatorKey}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleCreator(creator.creatorKey)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        checked ? "bg-primary/8" : "hover:bg-muted/40"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCreator(creator.creatorKey)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${creator.name}`}
                      />
                      {creator.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={creator.avatarUrl}
                          alt=""
                          className="size-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                          {initials(creator.name, creator.handle)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {creator.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {creator.handle}
                          {creator.meta ? ` · ${creator.meta}` : ""}
                        </span>
                      </span>
                      {checked ? (
                        <CheckIcon className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:justify-between">
          <p className="hidden text-[11.5px] text-muted-foreground sm:block">
            Same selection for Preview, PDF, PPTX, Excel, and Word
          </p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDisabled || noneSelected || noPlatformsSelected}
            >
              {confirmDisabled ? "Loading platforms…" : confirmLabel}
              {!confirmDisabled && selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
