"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorSearchPanel } from "./creator-search-panel";
import {
  buildExistingCreatorKeys,
  filterSelectedCreators,
  isCreatorOnExistingList,
  useCreatorBrowse,
  useCreatorSelection,
} from "./creator-selection-hooks";
import { CreatorSelectionProvider } from "./creator-selection-provider";
import { CreatorSelectionTable } from "./creator-selection-table";
import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import type {
  CreatorPickerDialogProps,
  ExistingCreatorKey,
} from "./creator-selection-types";
import { CREATOR_PICKER_DEFAULT_PAGE_SIZE } from "./creator-selection-types";

type ContainerVariant = "dialog" | "sheet";

type ExtendedProps = CreatorPickerDialogProps & {
  container?: ContainerVariant;
  footer?: ReactNode;
  onConfirmPending?: boolean;
  formatConfirmLabel?: (selectedCount: number) => string;
  /** Sheet side when container=sheet */
  sheetSide?: "right" | "left";
};

export function CreatorPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  selectionMode = "multi",
  maxSelection,
  initialSelectedIds,
  onConfirm,
  browseFilters,
  existingKeys: existingKeysProp,
  productionOnly = false,
  pageSize = CREATOR_PICKER_DEFAULT_PAGE_SIZE,
  paginationMode = "page",
  confirmLabel,
  formatConfirmLabel,
  isRowDisabled,
  container = "dialog",
  footer,
  onConfirmPending,
  sheetSide = "right",
  children,
}: ExtendedProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");

  const selection = useCreatorSelection({ mode: selectionMode, maxSelection });

  const mergedFilters = useMemo(
    () => ({
      ...browseFilters,
      search: search.trim() || undefined,
      platform: platform === "all" ? undefined : platform,
      productionOnly,
    }),
    [browseFilters, search, platform, productionOnly]
  );

  const browse = useCreatorBrowse({
    enabled: open,
    filters: mergedFilters,
    pageSize,
    paginationMode,
  });

  const visibleIds = useMemo(
    () =>
      browse.creators
        .filter((c) => !isCreatorOnExistingList(c, existingKeysProp ?? new Set()))
        .filter((c) => !(isRowDisabled?.(c) ?? false))
        .map((c) => c.unified_id),
    [browse.creators, existingKeysProp, isRowDisabled]
  );

  useEffect(() => {
    if (!open) {
      selection.clearSelection();
      setSearch("");
      setPlatform("all");
      return;
    }
    if (initialSelectedIds?.length) {
      selection.setSelectedIds(new Set(initialSelectedIds));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenChange(next: boolean) {
    if (!next) selection.clearSelection();
    onOpenChange(next);
  }

  function handleToggle(creator: UnifiedCreatorResult) {
    if (isCreatorOnExistingList(creator, existingKeysProp ?? new Set())) return;
    if (isRowDisabled?.(creator)) return;
    if (selectionMode === "single") {
      onConfirm?.([creator]);
      handleOpenChange(false);
      return;
    }
    selection.toggle(creator.unified_id);
  }

  function handleConfirm() {
    const chosen = filterSelectedCreators(browse.creators, selection.selectedIds);
    onConfirm?.(chosen);
  }

  const selectedCount = selection.selectedCount;
  const defaultConfirmLabel =
    confirmLabel ??
    formatConfirmLabel?.(selectedCount) ??
    (selectionMode === "single"
      ? "Select creator"
      : `Add ${selectedCount > 0 ? selectedCount : ""} creator${selectedCount === 1 ? "" : "s"}`);

  const body = (
    <>
      <CreatorSearchPanel
        search={search}
        onSearchChange={setSearch}
        platform={platform}
        onPlatformChange={setPlatform}
        autoFocus={container === "sheet"}
        className="border-b border-border p-4"
      />

      {children}

      <CreatorSelectionTable
        creators={browse.creators}
        selectedIds={selection.selectedIds}
        onToggle={handleToggle}
        onToggleSelectAll={
          selectionMode === "multi"
            ? () => selection.toggleAllVisible(visibleIds)
            : undefined
        }
        selectAllState={selection.checkboxState(visibleIds)}
        loading={browse.loading}
        loadingMore={browse.loadingMore}
        error={browse.error}
        onRetry={browse.retry}
        existingKeys={existingKeysProp}
        isRowDisabled={isRowDisabled}
        disabledBadge={(creator) =>
          isRowDisabled?.(creator) ? "Not addable" : null
        }
        total={browse.total}
        hasMore={browse.hasMore}
        className="min-h-[240px] flex-1"
      />

      {selectionMode === "multi" ? (
        <CreatorSelectionToolbar
          selectedCount={selectedCount}
          totalVisible={visibleIds.length}
          onSelectAll={() => selection.selectAll(visibleIds)}
          onDeselectAll={() => selection.deselectAll(visibleIds)}
          onClear={selection.clearSelection}
          className="border-t border-border"
        />
      ) : null}
    </>
  );

  const actionFooter =
    footer ??
    (selectionMode === "multi" && onConfirm ? (
      <Button
        onClick={handleConfirm}
        disabled={onConfirmPending || selectedCount === 0}
      >
        {onConfirmPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {defaultConfirmLabel}
      </Button>
    ) : null);

  if (container === "sheet") {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side={sheetSide}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
          {actionFooter ? (
            <SheetFooter className="flex-row items-center justify-between border-t border-border p-4">
              {selectionMode === "multi" ? (
                <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
              ) : (
                <span />
              )}
              {actionFooter}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
        {actionFooter ? (
          <DialogFooter className="border-t px-6 py-4">{actionFooter}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Build existing keys from shortlist items for dedup in picker rows. */
export function existingKeysFromShortlistItems(
  items: ExistingCreatorKey[]
): Set<string> {
  return buildExistingCreatorKeys(items);
}

export { CreatorSelectionProvider };
