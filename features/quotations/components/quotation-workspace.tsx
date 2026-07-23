"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  CopyIcon,
  DownloadIcon,
  PercentIcon,
  SearchIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import {
  GlassSelectionFlyout,
  GLASS_FLYOUT_PRIMARY_ACTION_CLASS,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";
import { discoverySelectionFlyoutContentClass } from "@/features/discovery/components/design-system/discovery-selection-flyout";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { cn } from "@/lib/utils";
import {
  CALCULATION_MODE_LABELS,
  QUOTATION_CLIENT_LABELS,
  quotationPreviewPath,
} from "@/features/quotations/constants";
import { AddCreatorsToQuotationButton } from "@/features/quotations/components/add-creators-to-quotation-modal";
import type { QuotationCreatorsAddedResult } from "@/features/quotations/components/add-creators-to-quotation-modal";
import { useQuotationWorkspaceShortcuts } from "@/features/quotations/components/use-quotation-workspace-shortcuts";
import { QuotationTermsAccordion } from "@/features/quotations/components/quotation-terms-accordion";
import { QuotationCommercialMetricsBand } from "@/features/quotations/components/quotation-commercial-metrics-band";
import { QuotationLifecyclePills } from "@/features/quotations/components/quotation-lifecycle-pills";
import { QuotationValidityBar } from "@/features/quotations/components/quotation-validity-bar";
import { QuotationWorkspaceHeader } from "@/features/quotations/components/quotation-workspace-header";
import { QuotationClientBrandPanel } from "@/features/quotations/components/quotation-client-brand-panel";
import { QuotationDocumentMetaPanel } from "@/features/quotations/components/quotation-document-meta-panel";
import { QuotationSetupWizard } from "@/features/quotations/components/quotation-setup-wizard";
import { QuotationCollapseContentGroupRows } from "@/features/quotations/components/quotation-collapse-content-group-rows";
import { QuotationCreatorGroupRows } from "@/features/quotations/components/quotation-creator-group-rows";
import { useQuotationCreatorDetailSheet } from "@/features/quotations/hooks/use-quotation-creator-detail-sheet";
import {
  QuotationManualSaveProvider,
  useQuotationManualSave,
} from "@/features/quotations/components/quotation-manual-save";
import {
  duplicateQuotationItems,
  removeQuotationItem,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import {
  calcModeToCommercialMode,
  computeLiveQuotationTotals,
  computeQuotationRowComputed,
  draftFromQuotationItem,
  draftsFromItems,
  resolveQuotationHeaderCommercialTotals,
  resolveQuotationRowDraft,
  type CalculationModePreference,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import {
  buildQuotationItemOptionContext,
  countUniqueQuotationCreators,
} from "@/lib/quotations/quotation-creator-options";
import {
  sortQuotationWorkspaceItems,
  type QuotationWorkspaceSortState,
} from "@/lib/quotations/quotation-workspace-sort";
import { buildQuotationWorkspaceDisplayGroups } from "@/lib/quotations/quotation-collapse-groups";
import {
  quotationCreatorCardPricingClass,
  quotationDisplayGroupPricingCompleteness,
} from "@/lib/quotations/quotation-creator-group-pricing";
import { shouldIncludeItemInLiveTotals } from "@/lib/quotations/quotation-collapse-package";
import { QuotationCommercialSummaryDialog } from "@/features/quotations/components/quotation-commercial-summary-dialog";
import { QuotationWorkspaceSortableHead } from "@/features/quotations/components/quotation-workspace-sort-header";
import {
  deliverableTypeLines,
  formatTypeLinesSummary,
  optionNumberLabel,
} from "@/lib/quotations/quotation-deliverable-types";
import {
  appendQuotationExportRevision,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import type {
  PromoteWizardOptions,
  QuotationDetail,
  QuotationFormOptions,
  QuotationItemRow,
} from "@/features/quotations/types";

function egp(n: number, decimals = 0): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

function parseNum(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function exportSelectedCsv(
  items: QuotationItemRow[],
  drafts: Record<string, QuotationRowDraft>,
  selectedIds: Set<string>,
  quotationName: string
) {
  const headers = [
    "Creator",
    "Option",
    "Handle",
    "Tier",
    "Platform",
    "Type",
    "Service",
    "Followers",
    "Country",
    "Cost",
    "Currency",
    "Cost EGP",
    QUOTATION_CLIENT_LABELS.clientCostEgp,
    "GP EGP",
    "GP%",
    "AF%",
    "AF EGP",
    "Agency Margin EGP",
  ];
  const rows = items
    .filter((item) => selectedIds.has(item.id))
    .map((item) => {
      const draft = drafts[item.id];
      const computed = draft ? computeQuotationRowComputed(draft) : null;
      return [
        item.creator_name ?? "",
        optionNumberLabel(item.option_number) ?? "",
        item.handle ?? "",
        resolveCreatorTierLabel({ followers: item.followers }),
        item.platform ?? "",
        item.deliverables.length
          ? item.deliverables
              .map((d) => formatTypeLinesSummary(deliverableTypeLines(d)))
              .join(", ")
          : "",
        item.service_description ?? "",
        item.followers ?? "",
        item.country_code ?? "",
        draft?.cost ?? item.cost,
        draft?.costCurrency ?? item.cost_currency,
        computed?.costEgp ?? item.cost_egp,
        computed?.revenueEgp ?? item.revenue_egp,
        computed?.gpValueEgp ?? item.gp_value_egp,
        computed?.gpPct ?? item.gp_pct,
        computed?.afPct ?? item.af_pct,
        computed?.afValueEgp ?? item.af_value_egp,
        computed?.agencyMarginEgp ?? item.gp_value_egp + item.af_value_egp,
      ];
    });
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${quotationName.replace(/\s+/g, "-").toLowerCase()}-selected.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function QuotationWorkspace({
  detail,
  formOptions,
  promoteOptions,
}: {
  detail: QuotationDetail;
  formOptions: QuotationFormOptions;
  promoteOptions: PromoteWizardOptions;
}) {
  return (
    <QuotationManualSaveProvider quotationId={detail.id} items={detail.items}>
      <QuotationWorkspaceContent
        detail={detail}
        formOptions={formOptions}
        promoteOptions={promoteOptions}
      />
    </QuotationManualSaveProvider>
  );
}

function QuotationWorkspaceContent({
  detail,
  formOptions,
  promoteOptions,
}: {
  detail: QuotationDetail;
  formOptions: QuotationFormOptions;
  promoteOptions: PromoteWizardOptions;
}) {
  const router = useRouter();
  const manualSave = useQuotationManualSave();
  const [drafts, setDrafts] = useState(() => draftsFromItems(detail.items));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [globalCalcMode, setGlobalCalcMode] = useState<CalculationModePreference>("markup");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [exportTemplate, setExportTemplate] = useState<QuotationTemplateVariant>("detailed");
  const [addCreatorsOpen, setAddCreatorsOpen] = useState(false);
  const [focusNewItemId, setFocusNewItemId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<QuotationWorkspaceSortState | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const confirmDelete = useConfirmDelete();
  const creatorSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const item of detail.items) {
        if (!next[item.id]) next[item.id] = draftFromQuotationItem(item);
      }
      for (const id of Object.keys(next)) {
        if (!detail.items.some((item) => item.id === id)) delete next[id];
      }
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => detail.items.some((i) => i.id === id)));
      return next;
    });
  }, [detail.items]);

  const draftList = useMemo(
    () =>
      detail.items
        .map((item) => resolveQuotationRowDraft(item, drafts[item.id]))
        .filter(Boolean),
    [detail.items, drafts]
  );

  const totalsDraftList = useMemo(
    () =>
      detail.items
        .filter((item) => shouldIncludeItemInLiveTotals(item, detail.items))
        .map((item) => resolveQuotationRowDraft(item, drafts[item.id]))
        .filter(Boolean),
    [detail.items, drafts]
  );

  const totals = useMemo(
    () => resolveQuotationHeaderCommercialTotals(computeLiveQuotationTotals(totalsDraftList)),
    [totalsDraftList]
  );

  const platformOptions = useMemo(() => {
    const set = new Set(detail.items.map((i) => i.platform).filter(Boolean) as string[]);
    return [...set].sort();
  }, [detail.items]);

  const filteredItems = useMemo(() => {
    const q = creatorSearch.trim().toLowerCase();
    return detail.items.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (!q) return true;
      const hay = [item.creator_name, item.handle, item.platform]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [detail.items, creatorSearch, platformFilter]);

  const pendingItemIds = useMemo(() => {
    const pending = new Set<string>();
    for (const item of detail.items) {
      if (manualSave.isLinePending(item.id)) pending.add(item.id);
    }
    return pending;
  }, [detail.items, manualSave]);

  const sortedFilteredItems = useMemo(
    () =>
      sortQuotationWorkspaceItems(filteredItems, tableSort, {
        drafts,
        pendingItemIds,
      }),
    [filteredItems, tableSort, drafts, pendingItemIds]
  );

  const optionContextByItemId = useMemo(
    () => buildQuotationItemOptionContext(detail.items),
    [detail.items]
  );

  const displayGroups = useMemo(
    () => buildQuotationWorkspaceDisplayGroups(sortedFilteredItems),
    [sortedFilteredItems]
  );

  const uniqueCreatorCount = useMemo(
    () => countUniqueQuotationCreators(detail.items),
    [detail.items]
  );

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const updateDraft = useCallback((id: string, patch: Partial<QuotationRowDraft>) => {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }, []);

  const refreshQuotationLines = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleCreatorsAdded = useCallback(
    (result?: QuotationCreatorsAddedResult) => {
      const nextId = result?.itemIds?.[0];
      if (nextId) setFocusNewItemId(nextId);
      router.refresh();
    },
    [router]
  );

  useEffect(() => {
    if (!focusNewItemId) return;
    if (!detail.items.some((item) => item.id === focusNewItemId)) return;

    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-quotation-item-id="${focusNewItemId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setFocusNewItemId(null), 8000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [focusNewItemId, detail.items]);

  const { openCreatorFromItem, detailSheet } = useQuotationCreatorDetailSheet({
    onCreatorPlatformsChanged: refreshQuotationLines,
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredItems.forEach((item) => next.delete(item.id));
      } else {
        filteredItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }, [allVisibleSelected, filteredItems]);

  const applyBulkGpPct = useCallback(
    (pct: number) => {
      const mode = calcModeToCommercialMode(globalCalcMode);
      startBulkTransition(async () => {
        for (const id of selectedIds) {
          const draft = drafts[id];
          if (!draft) continue;
          updateDraft(id, { mode, gpPct: pct });
          const res = await updateQuotationItemCommercials({
            item_id: id,
            quotation_id: detail.id,
            mode,
            cost: draft.cost,
            cost_currency: draft.costCurrency,
            gp_pct: pct,
            revenue: draft.revenue,
            gp_value: draft.gpValue,
          });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
        }
        toast.success(`Applied ${pct}% to ${selectedIds.size} creator(s).`);
        router.refresh();
      });
    },
    [globalCalcMode, selectedIds, drafts, detail.id, updateDraft, router]
  );

  const applyBulkCurrency = useCallback(
    (currency: string) => {
      startBulkTransition(async () => {
        for (const id of selectedIds) {
          const draft = drafts[id];
          if (!draft) continue;
          updateDraft(id, { costCurrency: currency, fxRateToEgp: 1 });
          const res = await updateQuotationItemCommercials({
            item_id: id,
            quotation_id: detail.id,
            mode: draft.mode,
            cost: draft.cost,
            cost_currency: currency,
            gp_pct: draft.gpPct,
            revenue: draft.revenue,
            gp_value: draft.gpValue,
          });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
        }
        toast.success(`Currency updated for ${selectedIds.size} creator(s).`);
        router.refresh();
      });
    },
    [selectedIds, drafts, detail.id, updateDraft, router]
  );

  const handleDuplicateSelected = useCallback(() => {
    startBulkTransition(async () => {
      const res = await duplicateQuotationItems({
        quotation_id: detail.id,
        item_ids: [...selectedIds],
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Duplicated.");
      router.refresh();
    });
  }, [detail.id, selectedIds, router]);

  const handleRemoveSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ok = await confirmDelete(
      `Remove ${count} selected creator${count === 1 ? "" : "s"} from this quotation? This cannot be undone.`,
      "Remove selected creators?"
    );
    if (!ok) return;

    startBulkTransition(async () => {
      for (const id of selectedIds) {
        const res = await removeQuotationItem({
          item_id: id,
          quotation_id: detail.id,
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
      }
      toast.success("Selected creators removed.");
      setSelectedIds(new Set());
      router.refresh();
    });
  }, [confirmDelete, detail.id, selectedIds, router]);

  const previewHref = useMemo(() => {
    const params = new URLSearchParams();
    appendQuotationTemplateParam(params, exportTemplate);
    appendQuotationExportRevision(params, detail.updated_at);
    const query = params.toString();
    return quotationPreviewPath(
      detail.id,
      detail.serial_number,
      query || undefined
    );
  }, [detail.id, detail.serial_number, detail.updated_at, exportTemplate]);

  const focusCreatorSearch = useCallback(() => {
    const el =
      creatorSearchRef.current ??
      document.querySelector<HTMLInputElement>("[data-quotation-search]");
    el?.focus();
    el?.select();
  }, []);

  const toggleCalcMode = useCallback(() => {
    setGlobalCalcMode((mode) => (mode === "markup" ? "margin" : "markup"));
  }, []);

  const openPreview = useCallback(() => {
    window.open(previewHref, "_blank", "noopener,noreferrer");
  }, [previewHref]);

  useQuotationWorkspaceShortcuts({
    canManage: detail.canManage,
    hasSelection: selectedIds.size > 0,
    hasVisibleItems: filteredItems.length > 0,
    onAddCreator: () => setAddCreatorsOpen(true),
    onFocusSearch: focusCreatorSearch,
    onToggleCalcMode: toggleCalcMode,
    onSelectAllVisible: toggleSelectAllVisible,
    onClearSelection: () => setSelectedIds(new Set()),
    onDuplicateSelected: handleDuplicateSelected,
    onRemoveSelected: handleRemoveSelected,
    onPreview: openPreview,
  });

  return (
    <div className="quotation-editor-rd4 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <QuotationSetupWizard detail={detail} options={formOptions} />
      <QuotationWorkspaceHeader
        detail={detail}
        promoteOptions={promoteOptions}
        hasUnsavedChanges={manualSave.hasUnsavedChanges}
        savePending={manualSave.savePending}
        onSave={() => {
          void manualSave.saveAll().then((ok) => {
            if (ok) toast.success("Quotation saved.");
          });
        }}
        exportTemplate={exportTemplate}
        onExportTemplateChange={setExportTemplate}
      />

      <div className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <QuotationCommercialMetricsBand
          totalCostEgp={totals.totalCostEgp}
          totalRevenueEgp={totals.totalClientCostEgp}
          totalGpValueEgp={totals.headerGpValueEgp}
          totalGpPct={totals.headerGpPct}
          totalPmPct={totals.headerPmPct}
          gpTargetPct={detail.gp_target_pct}
          creatorCount={uniqueCreatorCount}
          version={detail.version}
          validDaysRemaining={detail.valid_days_remaining}
        />
        <QuotationLifecyclePills
          detail={detail}
          trailing={
            <QuotationValidityBar
              inline
              validityDate={detail.validity_date}
              validDaysRemaining={detail.valid_days_remaining}
              isExpired={detail.is_expired}
            />
          }
        />

        <section
          className={cn(discoverySelectionFlyoutContentClass(selectedIds.size > 0))}
        >
        <div className="sec compact">
          <QuotationClientBrandPanel
            detail={detail}
            options={formOptions}
            disabled={!detail.canManage}
          />
        </div>
        {detail.items.length === 0 ? (
          <EmptyState
            quotationId={detail.id}
            canManage={detail.canManage}
            onAdded={handleCreatorsAdded}
            addCreatorsOpen={addCreatorsOpen}
            onAddCreatorsOpenChange={setAddCreatorsOpen}
          />
        ) : (
          <>
            <div className="sec flush">
            <div className="sec-head">
              <div className="min-w-0">
                <h2>
                  Creators{" "}
                  <span>
                    · {uniqueCreatorCount} · {detail.items.length} lines
                  </span>
                </h2>
                <p>
                  Grouped by influencer — duplicated creators are labeled Option 1, 2, 3… on each line.
                </p>
              </div>
              <div className="sec-tools">
                <QuotationCommercialSummaryDialog
                  items={detail.items}
                  drafts={drafts}
                  triggerClassName="btn sm"
                />
                {detail.canManage ? (
                  <AddCreatorsToQuotationButton
                    quotationId={detail.id}
                    onAdded={handleCreatorsAdded}
                    label="Add creator"
                    open={addCreatorsOpen}
                    onOpenChange={setAddCreatorsOpen}
                    triggerClassName="btn btn-primary sm"
                  />
                ) : null}
              </div>
            </div>
            <Toolbar
              creatorSearch={creatorSearch}
              onCreatorSearch={setCreatorSearch}
              creatorSearchRef={creatorSearchRef}
              platformFilter={platformFilter}
              onPlatformFilter={setPlatformFilter}
              platformOptions={platformOptions}
              globalCalcMode={globalCalcMode}
              onGlobalCalcMode={setGlobalCalcMode}
            />

            <BulkToolbar
              open={selectedIds.size > 0}
              selectedCount={selectedIds.size}
              globalCalcMode={globalCalcMode}
              pending={bulkPending}
              onClear={() => setSelectedIds(new Set())}
              onApplyGpPct={applyBulkGpPct}
              onApplyMarkupPct={applyBulkGpPct}
              onChangeCurrency={applyBulkCurrency}
              onRemove={handleRemoveSelected}
              onDuplicate={handleDuplicateSelected}
              onExport={() =>
                exportSelectedCsv(detail.items, drafts, selectedIds, detail.name)
              }
            />

            <div className="creators-list">
              <div className="clist-head sticky top-0 z-10">
                <span className="co-chk">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAllVisible}
                    aria-label="Select all visible creators"
                  />
                </span>
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-opt"
                  label="Option"
                  field="option"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-tier"
                  label="Tier"
                  field="tier"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-svc"
                  label="Service description"
                  field="service"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-plat"
                  label="Platform"
                  field="platform"
                  align="center"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-type"
                  label="Type"
                  field="type"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-price"
                  label="Price"
                  field="price"
                  align="right"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <QuotationWorkspaceSortableHead
                  variant="flex"
                  columnClassName="co-status"
                  label="Status"
                  field="status"
                  align="center"
                  sort={tableSort}
                  onSortChange={setTableSort}
                />
                <span className="co-act" aria-hidden />
              </div>

              {displayGroups.map((group, groupIndex) => {
                const pricingCompleteness = quotationDisplayGroupPricingCompleteness(
                  group,
                  manualSave.getLinePendingPayload,
                  drafts
                );

                return (
                <div
                  key={
                    group.kind === "collapse"
                      ? `collapse-${group.collapseGroupId}`
                      : group.creatorKey
                  }
                  className={cn(
                    "cgroup quotation-creator-card",
                    quotationCreatorCardPricingClass(pricingCompleteness),
                    group.kind === "collapse" &&
                      "collapse-content-frame quotation-collapse-content-block"
                  )}
                >
                  {group.kind === "collapse" ? (
                    <QuotationCollapseContentGroupRows
                      quotationId={detail.id}
                      shortlistId={detail.shortlist_id}
                      label={group.label}
                      allItems={detail.items}
                      creatorGroups={group.creatorGroups}
                      drafts={drafts}
                      groupIndex={groupIndex}
                      optionContextByItemId={optionContextByItemId}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onDraftChange={updateDraft}
                      onRemoved={() => router.refresh()}
                      onLineChanged={refreshQuotationLines}
                      onOpenCreator={openCreatorFromItem}
                      focusItemId={focusNewItemId}
                    />
                  ) : (
                    <QuotationCreatorGroupRows
                      quotationId={detail.id}
                      shortlistId={detail.shortlist_id}
                      items={group.items}
                      drafts={drafts}
                      groupIndex={groupIndex}
                      optionContextByItemId={optionContextByItemId}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onDraftChange={updateDraft}
                      onRemoved={() => router.refresh()}
                      onLineChanged={refreshQuotationLines}
                      onOpenCreator={openCreatorFromItem}
                      focusItemId={focusNewItemId}
                    />
                  )}
                </div>
                );
              })}

              <div className="totals sticky bottom-0 z-10">
                <span className="lbl">
                  Totals · {uniqueCreatorCount} creators · {totalsDraftList.length} option lines
                </span>
                <span className="amt">{egp(totals.totalClientCostEgp)}</span>
              </div>
            </div>
            {detail.canManage ? (
              <div className="px-[var(--gut,32px)] py-3">
                <AddCreatorsToQuotationButton
                  quotationId={detail.id}
                  onAdded={handleCreatorsAdded}
                  label="Add creator"
                  open={addCreatorsOpen}
                  onOpenChange={setAddCreatorsOpen}
                  triggerClassName="btn sm"
                />
              </div>
            ) : null}
            </div>
          </>
        )}

        <section className="sec">
          <div className="cols2">
            <div>
              <div className="subh">Document details</div>
              <div className="subp">Version, ownership, and validity.</div>
              <QuotationDocumentMetaPanel detail={detail} layout="flush" />
            </div>
            <div className="vdiv" aria-hidden />
            <div>
              <div className="subh">Quotation notes</div>
              <div className="subp">Internal &amp; client-facing.</div>
              <HeaderNotes detail={detail} />
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-head">
            <div>
              <h2>Terms &amp; conditions</h2>
              <p>Applies to this quotation unless amended in writing.</p>
            </div>
          </div>
          <QuotationTermsAccordion termsText={detail.terms} />
        </section>
        </section>
      </div>
      {detailSheet}
    </div>
  );
}

function EmptyState({
  quotationId,
  canManage,
  onAdded,
  addCreatorsOpen,
  onAddCreatorsOpenChange,
}: {
  quotationId: string;
  canManage: boolean;
  onAdded: (result?: QuotationCreatorsAddedResult) => void;
  addCreatorsOpen: boolean;
  onAddCreatorsOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-muted/50">
        <UserPlusIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-foreground">No creators yet</p>
      <p className="max-w-[320px] text-[11px] leading-relaxed text-muted-foreground">
        {canManage
          ? "Add creators from a shortlist, Discovery selection, campaign, or manual entry."
          : "This quotation is locked in its current status."}
      </p>
      {canManage ? (
        <div className="mt-2">
          <AddCreatorsToQuotationButton
            quotationId={quotationId}
            onAdded={onAdded}
            open={addCreatorsOpen}
            onOpenChange={onAddCreatorsOpenChange}
            triggerClassName="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

function Toolbar({
  creatorSearch,
  onCreatorSearch,
  creatorSearchRef,
  platformFilter,
  onPlatformFilter,
  platformOptions,
  globalCalcMode,
  onGlobalCalcMode,
}: {
  creatorSearch: string;
  onCreatorSearch: (v: string) => void;
  creatorSearchRef?: RefObject<HTMLInputElement | null>;
  platformFilter: string;
  onPlatformFilter: (v: string) => void;
  platformOptions: string[];
  globalCalcMode: CalculationModePreference;
  onGlobalCalcMode: (v: CalculationModePreference) => void;
  commercialSummary?: ReactNode;
}) {
  return (
    <div className="ctools">
      <div className="searchbox">
        <SearchIcon className="pointer-events-none size-[15px] shrink-0" />
        <input
          ref={creatorSearchRef}
          type="text"
          data-quotation-search
          placeholder="Search creators…"
          value={creatorSearch}
          onChange={(e) => onCreatorSearch(e.target.value)}
        />
      </div>
      <Select value={platformFilter} onValueChange={onPlatformFilter}>
        <SelectTrigger className="selpill w-[140px]">
          <SelectValue placeholder="Platform · All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Platform · All</SelectItem>
          {platformOptions.map((p) => (
            <SelectItem key={p} value={p}>
              {platformLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={globalCalcMode}
        onValueChange={(v) => onGlobalCalcMode(v as CalculationModePreference)}
      >
        <SelectTrigger className="selpill w-[160px]">
          <SelectValue placeholder="Calc · Markup %" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CALCULATION_MODE_LABELS) as CalculationModePreference[]).map((m) => (
            <SelectItem key={m} value={m}>
              Calc · {CALCULATION_MODE_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BulkToolbar({
  open,
  selectedCount,
  globalCalcMode,
  pending,
  onClear,
  onApplyGpPct,
  onApplyMarkupPct,
  onChangeCurrency,
  onRemove,
  onDuplicate,
  onExport,
}: {
  open: boolean;
  selectedCount: number;
  globalCalcMode: CalculationModePreference;
  pending: boolean;
  onClear: () => void;
  onApplyGpPct: (pct: number) => void;
  onApplyMarkupPct: (pct: number) => void;
  onChangeCurrency: (currency: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}) {
  const [bulkPct, setBulkPct] = useState("25");

  const actions: GlassFlyoutAction[] = [
    {
      id: "duplicate",
      label: "Duplicate",
      icon: CopyIcon,
      variant: "outline",
      disabled: pending,
      onClick: onDuplicate,
    },
    {
      id: "export",
      label: "Export",
      icon: DownloadIcon,
      variant: "outline",
      onClick: onExport,
    },
    {
      id: "remove",
      label: "Remove",
      icon: Trash2Icon,
      variant: "outline",
      destructive: true,
      disabled: pending,
      onClick: onRemove,
    },
  ];

  return (
    <GlassSelectionFlyout
      open={open}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClear}
      busy={pending}
      maxVisibleActions={2}
    >
      <div className="flex shrink-0 items-center gap-1">
        <Input
          className="h-7 w-14 text-xs"
          inputMode="decimal"
          value={bulkPct}
          onChange={(e) => setBulkPct(e.target.value)}
        />
        <Button
          type="button"
          size="xs"
          variant="default"
          className={cn(
            "h-7 shrink-0 rounded-full text-xs",
            GLASS_FLYOUT_PRIMARY_ACTION_CLASS
          )}
          disabled={pending}
          onClick={() => {
            const pct = parseNum(bulkPct);
            if (globalCalcMode === "markup") onApplyMarkupPct(pct);
            else onApplyGpPct(pct);
          }}
        >
          <PercentIcon className="size-3" />
          Apply {globalCalcMode === "markup" ? "Markup" : "GP"}%
        </Button>
      </div>
      <Select onValueChange={onChangeCurrency}>
        <SelectTrigger className="h-7 w-[100px] text-xs">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          {COMMERCIAL_CURRENCIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </GlassSelectionFlyout>
  );
}

function HeaderNotes({ detail }: { detail: QuotationDetail }) {
  const { registerMetaPending, saveStatus, hasUnsavedChanges } = useQuotationManualSave();
  const [notes, setNotes] = useState(detail.notes ?? "");

  useEffect(() => {
    setNotes(detail.notes ?? "");
  }, [detail.id, detail.notes]);

  return (
    <div>
      {hasUnsavedChanges ? (
        <div className="mb-2 text-right text-[10px] font-semibold text-amber-600">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : "Unsaved"}
        </div>
      ) : null}
      <Textarea
        id="quotation-notes"
        rows={9}
        className="notes-ta"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          registerMetaPending({ notes: e.target.value || null });
        }}
        placeholder="Internal or client-facing notes for this quotation…"
      />
    </div>
  );
}
