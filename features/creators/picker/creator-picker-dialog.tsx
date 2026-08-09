"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2Icon, UsersIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

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
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CREATOR_PICKER_SHEET_CLASS,
  CREATOR_PICKER_SHEET_STYLE,
} from "@/features/discovery/components/design-system/discovery-sheet-chrome";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  normalizeDiscoverySearchQuery,
  resolveCreatorSearchQueryFromCreator,
} from "@/lib/discovery/creator-search-query";

import { CreatorSelectionPreview } from "./creator-selection-preview";
import { CreatorPickerPanelRow } from "./creator-picker-panel-row";
import { CreatorSearchPanel } from "./creator-search-panel";
import {
  buildExistingCreatorKeys,
  existingKeysFromStandaloneShortlistItems,
  isCreatorOnExistingList,
  useCreatorBrowse,
  useCreatorSelection,
  useDebouncedValue,
} from "./creator-selection-hooks";
import { resolveCreatorPickerSearchDisplay } from "./creator-picker-search-display";
import { CreatorSelectionProvider } from "./creator-selection-provider";
import { CreatorSelectionTable } from "./creator-selection-table";
import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import type {
  CreatorPickerDialogProps,
  ExistingCreatorKey,
} from "./creator-selection-types";
import type { ShortlistExistingItemKey } from "./creator-selection-utils";
import {
  CREATOR_PICKER_DEBOUNCE_MS,
  CREATOR_PICKER_DEFAULT_PAGE_SIZE,
} from "./creator-selection-types";

type ContainerVariant = "dialog" | "sheet";

type ExtendedProps = CreatorPickerDialogProps & {
  container?: ContainerVariant;
  footer?: ReactNode;
  onConfirmPending?: boolean;
  formatConfirmLabel?: (selectedCount: number) => string;
  /** Sheet side when container=sheet */
  sheetSide?: "right" | "left";
  /** Right sidebar layout matching add-creators HTML mockup. */
  panelLayout?: boolean;
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
  showAddMissingCreator = true,
  container = "dialog",
  footer,
  onConfirmPending,
  sheetSide = "right",
  panelLayout = false,
  children,
}: ExtendedProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");

  function handleSearchChange(value: string) {
    setSearch(normalizeDiscoverySearchQuery(value) || value);
  }
  const [selectedCreatorMap, setSelectedCreatorMap] = useState<
    Map<string, UnifiedCreatorResult>
  >(() => new Map());

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

  const debouncedSearch = useDebouncedValue(search, CREATOR_PICKER_DEBOUNCE_MS);
  const searchDisplay = useMemo(
    () =>
      resolveCreatorPickerSearchDisplay(debouncedSearch, browse.creators, {
        loading: browse.loading,
        browseTotal: browse.total,
      }),
    [debouncedSearch, browse.creators, browse.loading, browse.total]
  );
  const displayCreators = searchDisplay.creators;

  const visibleIds = useMemo(
    () =>
      displayCreators
        .filter((c) => !isCreatorOnExistingList(c, existingKeysProp ?? new Set()))
        .filter((c) => !(isRowDisabled?.(c) ?? false))
        .map((c) => c.unified_id),
    [displayCreators, existingKeysProp, isRowDisabled]
  );

  useEffect(() => {
    if (!open) {
      selection.clearSelection();
      setSearch("");
      setPlatform("all");
      setSelectedCreatorMap(new Map());
      return;
    }
    if (initialSelectedIds?.length) {
      selection.setSelectedIds(new Set(initialSelectedIds));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || browse.creators.length === 0) return;
    setSelectedCreatorMap((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const creator of browse.creators) {
        if (selection.selectedIds.has(creator.unified_id) && next.get(creator.unified_id) !== creator) {
          next.set(creator.unified_id, creator);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [browse.creators, open, selection.selectedIds]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      selection.clearSelection();
      setSelectedCreatorMap(new Map());
    }
    onOpenChange(next);
  }

  function rememberSelectedCreators(creators: UnifiedCreatorResult[], selected: boolean) {
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      for (const creator of creators) {
        if (selected) next.set(creator.unified_id, creator);
        else next.delete(creator.unified_id);
      }
      return next;
    });
  }

  function handleToggle(creator: UnifiedCreatorResult) {
    if (isCreatorOnExistingList(creator, existingKeysProp ?? new Set())) return;
    if (isRowDisabled?.(creator)) return;
    if (selectionMode === "single") {
      onConfirm?.([creator]);
      handleOpenChange(false);
      return;
    }
    const willSelect = !selection.selectedIds.has(creator.unified_id);
    selection.toggle(creator.unified_id);
    rememberSelectedCreators([creator], willSelect);
  }

  function handleConfirm() {
    const chosen = [...selection.selectedIds]
      .map((id) => selectedCreatorMap.get(id))
      .filter((creator): creator is UnifiedCreatorResult => creator != null);
    onConfirm?.(chosen);
  }

  function handleMissingCreatorAdded(creator: UnifiedCreatorResult) {
    if (isCreatorOnExistingList(creator, existingKeysProp ?? new Set())) {
      toast.info("This creator is already on the shortlist.");
      return;
    }
    if (isRowDisabled?.(creator)) {
      toast.error("This creator cannot be added.");
      return;
    }

    const query = resolveCreatorSearchQueryFromCreator(creator);
    if (query) setSearch(normalizeDiscoverySearchQuery(query));

    browse.upsertCreator(creator);

    if (selectionMode === "single") {
      onConfirm?.([creator]);
      handleOpenChange(false);
      return;
    }

    if (!selection.selectedIds.has(creator.unified_id)) {
      selection.toggle(creator.unified_id);
      rememberSelectedCreators([creator], true);
    }
  }

  function handleMissingCreatorUpdated(creator: UnifiedCreatorResult) {
    browse.patchCreator(creator);

    if (selection.selectedIds.has(creator.unified_id)) {
      setSelectedCreatorMap((prev) => {
        const next = new Map(prev);
        next.set(creator.unified_id, creator);
        return next;
      });
    }
  }

  const selectedCount = selection.selectedCount;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.selectedIds.has(id));

  function handleSelectAllVisible() {
    const visibleCreators = displayCreators.filter(
      (creator) =>
        visibleIds.includes(creator.unified_id) &&
        !isCreatorOnExistingList(creator, existingKeysProp ?? new Set()) &&
        !(isRowDisabled?.(creator) ?? false)
    );
    if (allVisibleSelected) {
      selection.deselectAll(visibleIds);
      rememberSelectedCreators(visibleCreators, false);
    } else {
      selection.selectAll(visibleIds);
      rememberSelectedCreators(visibleCreators, true);
    }
  }

  const selectedCreators = useMemo(
    () =>
      [...selection.selectedIds]
        .map((id) => selectedCreatorMap.get(id))
        .filter((creator): creator is UnifiedCreatorResult => creator != null),
    [selection.selectedIds, selectedCreatorMap]
  );

  const defaultConfirmLabel =
    confirmLabel ??
    formatConfirmLabel?.(selectedCount) ??
    (selectionMode === "single"
      ? "Select creator"
      : panelLayout
        ? selectedCount > 0
          ? `Add ${selectedCount} creator${selectedCount === 1 ? "" : "s"} to shortlist`
          : "Add to shortlist"
        : `Add ${selectedCount > 0 ? selectedCount : ""} creator${selectedCount === 1 ? "" : "s"}`);

  const body = panelLayout ? (
    <>
      <CreatorSearchPanel
        search={search}
        onSearchChange={handleSearchChange}
        platform={platform}
        onPlatformChange={setPlatform}
        autoFocus
        variant="panel"
        searchPlaceholder="Search creators…"
      />

      {children}

      <div className="creator-picker-scroll flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]">
        <CreatorSelectionTable
          creators={displayCreators}
          selectedIds={selection.selectedIds}
          onToggle={handleToggle}
          loading={browse.loading}
          loadingMore={browse.loadingMore}
          error={browse.error}
          onRetry={browse.retry}
          existingKeys={existingKeysProp}
          isRowDisabled={isRowDisabled}
          disabledBadge={(creator) =>
            isRowDisabled?.(creator) ? "Not addable" : null
          }
          total={searchDisplay.total}
          hasMore={searchDisplay.isExactCreatorSearch ? false : browse.hasMore}
          variant="panel"
          onSelectAllVisible={
            selectionMode === "multi" ? handleSelectAllVisible : undefined
          }
          selectAllLabel={allVisibleSelected ? "Deselect all" : "Select all"}
          className="min-h-0 flex-1"
          showAddMissingCreator={showAddMissingCreator && search.trim().length > 0}
          onMissingCreatorAdded={handleMissingCreatorAdded}
          onMissingCreatorUpdated={handleMissingCreatorUpdated}
        />

        {selectionMode === "multi" && selectedCount > 0 ? (
          <CreatorSelectionPreview
            creators={selectedCreators}
            onRemove={(id) => {
              const creator = selectedCreatorMap.get(id);
              if (!creator || !selection.selectedIds.has(id)) return;
              selection.toggle(id);
              rememberSelectedCreators([creator], false);
            }}
          />
        ) : null}
      </div>
    </>
  ) : (
    <>
      <CreatorSearchPanel
        search={search}
        onSearchChange={handleSearchChange}
        platform={platform}
        onPlatformChange={setPlatform}
        autoFocus={container === "sheet"}
        className="border-b border-border p-4"
      />

      {children}

      <CreatorSelectionTable
        creators={displayCreators}
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
        total={searchDisplay.total}
        hasMore={searchDisplay.isExactCreatorSearch ? false : browse.hasMore}
        className="min-h-[240px] flex-1"
        showAddMissingCreator={showAddMissingCreator && search.trim().length > 0}
        onMissingCreatorAdded={handleMissingCreatorAdded}
        onMissingCreatorUpdated={handleMissingCreatorUpdated}
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
      panelLayout ? (
        <Button
          onClick={handleConfirm}
          disabled={onConfirmPending || selectedCount === 0}
          className="creator-picker-add-btn relative h-9 flex-1 overflow-hidden rounded-lg border-0 bg-gradient-to-br from-blue-600 to-indigo-600 text-[13px] font-bold tracking-tight text-white shadow-[0_2px_12px_rgba(37,99,235,0.3)] hover:brightness-110 hover:shadow-[0_4px_20px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          {onConfirmPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {defaultConfirmLabel}
        </Button>
      ) : (
        <Button
          onClick={handleConfirm}
          disabled={onConfirmPending || selectedCount === 0}
        >
          {onConfirmPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {defaultConfirmLabel}
        </Button>
      )
    ) : null);

  if (container === "sheet") {
    if (panelLayout) {
      return (
        <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
          <SheetContent
            side={sheetSide}
            showCloseButton={false}
            showOverlay={false}
            style={CREATOR_PICKER_SHEET_STYLE}
            className={CREATOR_PICKER_SHEET_CLASS}
          >
            <div className="creator-picker-head shrink-0 border-b border-[#e2e8f0] px-5 pb-4 pt-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <SheetTitle className="text-base font-bold tracking-[-0.3px] text-[#0f172a]">
                  {title}
                </SheetTitle>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="mt-px flex size-7 shrink-0 items-center justify-center rounded-md border border-[#e2e8f0] bg-transparent text-[#94a3b8] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
                    aria-label="Close"
                  >
                    <XIcon className="size-3.5" strokeWidth={2.5} />
                  </button>
                </SheetClose>
              </div>
              {description ? (
                <SheetDescription className="max-w-[340px] text-xs leading-relaxed text-[#94a3b8]">
                  {description}
                </SheetDescription>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">{body}</div>

            {actionFooter ? (
              <div className="creator-picker-footer shrink-0 border-t border-[#e2e8f0] bg-white">
                {selectionMode === "multi" ? (
                  <div className="flex items-center justify-between px-4 pb-2 pt-2.5">
                    <span className="text-xs text-[#94a3b8]">
                      <strong className="font-semibold text-[#0f172a]">
                        {selectedCount} selected
                      </strong>
                      {" · "}
                      {visibleIds.length} visible
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      disabled={visibleIds.length === 0}
                      className="border-0 bg-transparent p-0 text-[11px] font-semibold text-[#2563eb] transition-colors hover:text-[#1d4ed8] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {allVisibleSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 px-4 pb-3.5">
                  <div className="creator-picker-sel-count flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 text-xs font-medium text-[#475569]">
                    <UsersIcon className="size-3 text-[#94a3b8]" aria-hidden />
                    {selectedCount} selected
                  </div>
                  {actionFooter}
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      );
    }

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

/** Build existing keys from standalone shortlist rows for dedup in picker rows. */
export function existingKeysFromShortlistItems(
  items: ShortlistExistingItemKey[]
): Set<string> {
  return existingKeysFromStandaloneShortlistItems(items);
}

export { CreatorSelectionProvider };
