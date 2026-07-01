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
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  normalizeDiscoverySearchQuery,
  resolveCreatorSearchQueryFromCreator,
} from "@/lib/discovery/creator-search-query";

import { CreatorSelectionPreview } from "./creator-selection-preview";
import { CreatorSearchPanel } from "./creator-search-panel";
import {
  buildExistingCreatorKeys,
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
    browse.upsertCreator(creator);

    const query = resolveCreatorSearchQueryFromCreator(creator);
    if (query) setSearch(normalizeDiscoverySearchQuery(query));
  }

  const selectedCount = selection.selectedCount;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.selectedIds.has(id));

  function handleSelectAllVisible() {
    const visibleCreators = browse.creators.filter(
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
        onSearchChange={setSearch}
        platform={platform}
        onPlatformChange={setPlatform}
        autoFocus
        variant="panel"
        searchPlaceholder="Search creators…"
      />

      {children}

      <CreatorSelectionTable
        creators={browse.creators}
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
        total={browse.total}
        hasMore={browse.hasMore}
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
    </>
  ) : (
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
          className="relative h-9 flex-1 overflow-hidden rounded-lg border-0 bg-gradient-to-br from-blue-600 to-indigo-600 text-[13px] font-bold tracking-tight text-white shadow-[0_2px_12px_rgba(37,99,235,0.3)] hover:brightness-110 hover:shadow-[0_4px_20px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
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
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side={sheetSide}
            showCloseButton={false}
            className="flex w-full max-w-[420px] flex-col gap-0 border-l border-border p-0 shadow-[-12px_0_48px_rgba(15,23,42,0.14)] sm:max-w-[420px]"
          >
            <div className="shrink-0 border-b border-border px-5 pb-4 pt-5">
              <div className="mb-2 flex items-start justify-between">
                <SheetTitle className="text-base font-bold tracking-tight text-foreground">
                  {title}
                </SheetTitle>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="mt-px flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-colors hover:border-slate-300 hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <XIcon className="size-3.5" strokeWidth={2.5} />
                  </button>
                </SheetClose>
              </div>
              {description ? (
                <SheetDescription className="max-w-[340px] text-xs leading-relaxed text-muted-foreground">
                  {description}
                </SheetDescription>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>

            {actionFooter ? (
              <div className="shrink-0 border-t border-border bg-white">
                {selectionMode === "multi" ? (
                  <div className="flex items-center justify-between px-4 pb-2 pt-2.5">
                    <span className="text-xs text-muted-foreground">
                      <strong className="font-semibold text-foreground">
                        {selectedCount} selected
                      </strong>
                      {" · "}
                      {visibleIds.length} visible
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      disabled={visibleIds.length === 0}
                      className="border-0 bg-transparent p-0 text-[11px] font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {allVisibleSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 px-4 pb-3.5">
                  <div className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-muted px-3.5 text-xs font-medium text-muted-foreground">
                    <UsersIcon className="size-3 text-muted-foreground/80" />
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

/** Build existing keys from shortlist items for dedup in picker rows. */
export function existingKeysFromShortlistItems(
  items: ExistingCreatorKey[]
): Set<string> {
  return buildExistingCreatorKeys(items);
}

export { CreatorSelectionProvider };
