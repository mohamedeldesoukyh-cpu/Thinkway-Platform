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
  SearchIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import {
  discoverySelectionFlyoutContentClass,
} from "@/features/discovery/components/design-system/discovery-selection-flyout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { cn } from "@/lib/utils";
import {
  CALCULATION_MODE_LABELS,
  quotationPreviewPath,
} from "@/features/quotations/constants";
import { DocumentCreatorSelectionDialog } from "@/features/discovery/document-preview/document-creator-selection-dialog";
import {
  buildQuotationCreatorOptions,
  enrichQuotationCreatorOptionsWithLinkedPlatforms,
} from "@/features/discovery/document-preview/build-creator-options";
import { summarizeQuotationSelection } from "@/features/discovery/document-preview/document-selection-summary";
import { AddCreatorsToQuotationButton } from "@/features/quotations/components/add-creators-to-quotation-modal";
import type { QuotationCreatorsAddedResult } from "@/features/quotations/components/add-creators-to-quotation-modal";
import { useQuotationWorkspaceShortcuts } from "@/features/quotations/components/use-quotation-workspace-shortcuts";
import { QuotationTermsAccordion } from "@/features/quotations/components/quotation-terms-accordion";
import { QuotationCommercialMetricsBand } from "@/features/quotations/components/quotation-commercial-metrics-band";
import { QuotationLifecyclePills } from "@/features/quotations/components/quotation-lifecycle-pills";
import { QuotationValidityBar } from "@/features/quotations/components/quotation-validity-bar";
import { QuotationWorkspaceHeader } from "@/features/quotations/components/quotation-workspace-header";
import { ConvertQuotationDialog } from "@/features/quotations/components/convert-quotation-dialog";
import { QuotationClientReviewPanel } from "@/features/quotations/components/quotation-client-review-panel";
import {
  clientSelectionForItems,
  filterItemsByClientSelection,
  itemIdsForClientSelection,
  type QuotationClientReviewView,
  type QuotationClientSelectionFilter,
} from "@/features/quotations/quotation-client-review";
import { quotationItemClientCreatorId } from "@/features/client-workspace/quotation-item-creator-id";
import { quotationIsMovedToCampaign } from "@/features/client-workspace/client-review-selection";
import { setQuotationReviewCreatorsOnBehalfAction } from "@/features/client-workspace/actions/internal-quotation-review-selection-action";
import { QuotationClientBrandPanel } from "@/features/quotations/components/quotation-client-brand-panel";
import { QuotationDocumentMetaPanel } from "@/features/quotations/components/quotation-document-meta-panel";
import { QuotationSetupWizard } from "@/features/quotations/components/quotation-setup-wizard";
import { QuotationLinesGrid } from "@/features/quotations/components/quotation-lines-grid";
import { QuotationSelectionBar } from "@/features/quotations/components/quotation-selection-bar";
import { QuotationPricingCalculatorPanel } from "@/features/quotations/components/quotation-pricing-calculator-panel";
import { useQuotationCreatorDetailSheet } from "@/features/quotations/hooks/use-quotation-creator-detail-sheet";
import type { QuotationCalcLineInput } from "@/lib/quotations/quotation-pricing-calculator";
import {
  QuotationManualSaveProvider,
  useQuotationManualSave,
} from "@/features/quotations/components/quotation-manual-save";
import {
  duplicateQuotationItems,
  removeQuotationItem,
  resolveCommercialRateToEgp,
  updateQuotationHeader,
} from "@/features/quotations/actions";
import { draftToLinePending } from "@/lib/quotations/commercial-workspace/stage-pending";
import {
  computeLiveQuotationTotals,
  computeQuotationRowComputed,
  draftFromQuotationItem,
  draftsFromItems,
  resolveQuotationHeaderCommercialTotals,
  originalCurrencyTotalsForDisplay,
  resolveQuotationRowDraft,
  type CalculationModePreference,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import { resolveLiveTotalsDraft } from "@/features/quotations/quotation-pending-live-totals";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { countUniqueQuotationCreators } from "@/lib/quotations/quotation-creator-options";
import {
  sortQuotationWorkspaceItems,
  type QuotationWorkspaceSortState,
} from "@/lib/quotations/quotation-workspace-sort";
import { shouldIncludeItemInLiveTotals } from "@/lib/quotations/quotation-collapse-package";
import { QuotationCommercialEntry } from "@/features/quotations/components/quotation-commercial-entry";
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

export function QuotationWorkspace({
  detail,
  formOptions,
  promoteOptions,
  clientReview = null,
}: {
  detail: QuotationDetail;
  formOptions: QuotationFormOptions;
  promoteOptions: PromoteWizardOptions;
  clientReview?: QuotationClientReviewView | null;
}) {
  return (
    <QuotationManualSaveProvider quotationId={detail.id} items={detail.items}>
      <QuotationWorkspaceContent
        detail={detail}
        formOptions={formOptions}
        promoteOptions={promoteOptions}
        clientReview={clientReview}
      />
    </QuotationManualSaveProvider>
  );
}

function QuotationWorkspaceContent({
  detail,
  formOptions,
  promoteOptions,
  clientReview,
}: {
  detail: QuotationDetail;
  formOptions: QuotationFormOptions;
  promoteOptions: PromoteWizardOptions;
  clientReview: QuotationClientReviewView | null;
}) {
  const router = useRouter();
  const manualSave = useQuotationManualSave();
  const [drafts, setDrafts] = useState(() => draftsFromItems(detail.items));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [optimisticRemovedIds, setOptimisticRemovedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [displayCurrency, setDisplayCurrency] = useState(
    () => (detail.currency || "EGP").toUpperCase()
  );
  const [displayFxRateToEgp, setDisplayFxRateToEgp] = useState(1);
  const [currencyPending, startCurrencyTransition] = useTransition();
  const [globalCalcMode, setGlobalCalcMode] = useState<CalculationModePreference>("markup");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [clientSelectionFilter, setClientSelectionFilter] =
    useState<QuotationClientSelectionFilter>("all");
  const [convertApprovedOpen, setConvertApprovedOpen] = useState(false);
  const [exportTemplate, setExportTemplate] = useState<QuotationTemplateVariant>("detailed");
  const [addCreatorsOpen, setAddCreatorsOpen] = useState(false);
  const [commercialWorkspaceOpen, setCommercialWorkspaceOpen] = useState(false);
  const [focusNewItemId, setFocusNewItemId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<QuotationWorkspaceSortState | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const creatorSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayCurrency((detail.currency || "EGP").toUpperCase());
  }, [detail.currency]);

  useEffect(() => {
    let cancelled = false;
    void resolveCommercialRateToEgp(displayCurrency, detail.issue_date).then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      setDisplayFxRateToEgp(res.data.rate);
    });
    return () => {
      cancelled = true;
    };
  }, [displayCurrency, detail.issue_date]);

  useEffect(() => {
    setDrafts((prev) => {
      // After Save (no pending), rebuild from line Master so remount/refresh
      // cannot keep stale in-memory drafts that disagree with persisted SSOT.
      if (!manualSave.hasUnsavedChanges) {
        return draftsFromItems(detail.items);
      }
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
    setOptimisticRemovedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(
        [...prev].filter((id) => detail.items.some((item) => item.id === id))
      );
      return next.size === prev.size ? prev : next;
    });
  }, [detail.items, manualSave.hasUnsavedChanges]);

  const visibleItems = useMemo(
    () => detail.items.filter((item) => !optimisticRemovedIds.has(item.id)),
    [detail.items, optimisticRemovedIds]
  );

  const draftList = useMemo(
    () =>
      visibleItems
        .map((item) => resolveQuotationRowDraft(item, drafts[item.id]))
        .filter(Boolean),
    [visibleItems, drafts]
  );

  const platformOptions = useMemo(() => {
    const set = new Set(visibleItems.map((i) => i.platform).filter(Boolean) as string[]);
    return [...set].sort();
  }, [visibleItems]);

  const filteredItems = useMemo(() => {
    const q = creatorSearch.trim().toLowerCase();
    return filterItemsByClientSelection(
      visibleItems,
      clientReview?.selectionState,
      clientReview ? clientSelectionFilter : "all"
    ).filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (!q) return true;
      const hay = [item.creator_name, item.handle, item.platform]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [visibleItems, creatorSearch, platformFilter, clientReview, clientSelectionFilter]);

  const pendingItemIds = useMemo(() => {
    const pending = new Set<string>();
    for (const item of visibleItems) {
      if (manualSave.isLinePending(item.id)) pending.add(item.id);
    }
    return pending;
  }, [visibleItems, manualSave]);

  const totalsDraftList = useMemo(
    () =>
      visibleItems
        .filter((item) => shouldIncludeItemInLiveTotals(item, visibleItems))
        .map((item) =>
          resolveLiveTotalsDraft(
            item,
            drafts[item.id],
            manualSave.getLinePendingPayload(item.id)
          )
        ),
    [visibleItems, drafts, pendingItemIds, manualSave]
  );

  const totals = useMemo(
    () => resolveQuotationHeaderCommercialTotals(computeLiveQuotationTotals(totalsDraftList)),
    [totalsDraftList]
  );

  const savedTotals = useMemo(() => {
    const savedDraftList = visibleItems
      .filter((item) => shouldIncludeItemInLiveTotals(item, visibleItems))
      .map((item) => draftFromQuotationItem(item));
    return resolveQuotationHeaderCommercialTotals(computeLiveQuotationTotals(savedDraftList));
  }, [visibleItems]);

  const originalTotals = useMemo(
    () => originalCurrencyTotalsForDisplay(totalsDraftList, displayCurrency),
    [totalsDraftList, displayCurrency]
  );

  const sortedFilteredItems = useMemo(
    () =>
      sortQuotationWorkspaceItems(filteredItems, tableSort, {
        drafts,
        pendingItemIds,
      }),
    [filteredItems, tableSort, drafts, pendingItemIds]
  );

  const uniqueCreatorCount = useMemo(
    () => countUniqueQuotationCreators(visibleItems),
    [visibleItems]
  );

  const approvedItemIds = useMemo(
    () =>
      clientReview
        ? itemIdsForClientSelection(visibleItems, clientReview.selectionState, "accepted")
        : [],
    [clientReview, visibleItems]
  );

  function selectByClientState(state: "accepted" | "in_review") {
    if (!clientReview) return;
    setSelectedIds(new Set(itemIdsForClientSelection(visibleItems, clientReview.selectionState, state)));
  }

  function acceptUnderReviewOnBehalf() {
    if (!clientReview) return;
    const selectedUnderReview = visibleItems.filter(
      (item) =>
        selectedIds.has(item.id) &&
        clientSelectionForItems([item], clientReview.selectionState) === "in_review"
    );
    const source =
      selectedUnderReview.length > 0
        ? selectedUnderReview
        : visibleItems.filter(
            (item) => clientSelectionForItems([item], clientReview.selectionState) === "in_review"
          );
    const creatorIds = [...new Set(source.map((item) => quotationItemClientCreatorId(item)))];
    if (creatorIds.length === 0) {
      toast.error("No under-review creators to approve.");
      return;
    }
    startBulkTransition(async () => {
      const result = await setQuotationReviewCreatorsOnBehalfAction({
        quotationId: detail.id,
        creatorIds,
        state: "accepted",
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  const handleDisplayCurrencyChange = useCallback(
    (currency: string) => {
      const next = currency.toUpperCase();
      setDisplayCurrency(next);
      startCurrencyTransition(async () => {
        const [rateRes, saveRes] = await Promise.all([
          resolveCommercialRateToEgp(next),
          updateQuotationHeader({ id: detail.id, currency: next }),
        ]);
        if (rateRes.ok && rateRes.data) {
          setDisplayFxRateToEgp(rateRes.data.rate);
        }
        if (!saveRes.ok) {
          toast.error(saveRes.message ?? "Failed to update currency.");
          setDisplayCurrency((detail.currency || "EGP").toUpperCase());
          return;
        }
        router.refresh();
      });
    },
    [detail.id, detail.currency, router]
  );

  const allVisibleSelected =
    sortedFilteredItems.length > 0 &&
    sortedFilteredItems.every((item) => selectedIds.has(item.id));
  const selectionIndeterminate =
    sortedFilteredItems.some((item) => selectedIds.has(item.id)) &&
    !allVisibleSelected;

  const updateDraft = useCallback((id: string, patch: Partial<QuotationRowDraft>) => {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }, []);

  // Non-EGP lines stuck at identity FX (1) never resolved — refresh from md_exchange_rates.
  useEffect(() => {
    if (manualSave.hasUnsavedChanges) return;
    let cancelled = false;
    const stale = detail.items.filter((item) => {
      const currency = (item.cost_currency || "EGP").toUpperCase();
      const fx = item.fx_rate_to_egp ?? 1;
      return currency !== "EGP" && !(fx > 1);
    });
    if (stale.length === 0) return;

    void (async () => {
      const rateByCurrency = new Map<string, number>();
      let refreshed = 0;
      for (const item of stale) {
        if (cancelled) return;
        const currency = (item.cost_currency || "EGP").toUpperCase();
        let rate = rateByCurrency.get(currency);
        if (rate == null) {
          const res = await resolveCommercialRateToEgp(currency, detail.issue_date);
          if (!res.ok || !res.data || !(res.data.rate > 1)) continue;
          rate = res.data.rate;
          rateByCurrency.set(currency, rate);
        }
        const draft = draftFromQuotationItem(item);
        const next = { ...draft, costCurrency: currency, fxRateToEgp: rate };
        updateDraft(item.id, next);
        manualSave.registerLinePending(
          item.id,
          draftToLinePending(next, item.deliverables)
        );
        refreshed += 1;
      }
      if (!cancelled && refreshed > 0) {
        toast.message("FX rates refreshed from master data — Save to apply.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run when the quotation document / line FX snapshots change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid loops on draft edits
  }, [detail.id, detail.issue_date, detail.items, manualSave.hasUnsavedChanges, updateDraft]);

  const mergeDrafts = useCallback((next: Record<string, QuotationRowDraft>) => {
    setDrafts((prev) => {
      const merged = { ...prev };
      for (const [id, draft] of Object.entries(next)) {
        merged[id] = draft;
      }
      return merged;
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

  useEffect(() => {
    if (selectedIds.size === 0) setCalculatorOpen(false);
  }, [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setCalculatorOpen(false);
  }, []);

  const selectedLinesForCalc = useMemo((): QuotationCalcLineInput[] => {
    return sortedFilteredItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => {
        const draft = resolveQuotationRowDraft(item, drafts[item.id]);
        const computed = computeQuotationRowComputed(draft);
        return {
          id: item.id,
          name: item.creator_name?.trim() || "Unknown",
          handle: item.handle,
          optionNumber: item.option_number ?? 1,
          baseCost: computed.costEgp,
          clientNow: computed.revenueEgp,
        };
      });
  }, [sortedFilteredItems, selectedIds, drafts]);

  const selectionMoney = useMemo(() => {
    return selectedLinesForCalc.reduce(
      (acc, line) => {
        acc.baseCost += line.baseCost;
        acc.clientCost += line.clientNow;
        return acc;
      },
      { baseCost: 0, clientCost: 0 }
    );
  }, [selectedLinesForCalc]);

  const applyCalculator = useCallback(
    (updates: Array<{ id: string; newClient: number }>) => {
      startBulkTransition(() => {
        for (const update of updates) {
          const item = detail.items.find((row) => row.id === update.id);
          if (!item) continue;
          const draft = resolveQuotationRowDraft(item, drafts[update.id]);
          const fx = draft.fxRateToEgp > 0 ? draft.fxRateToEgp : 1;
          const revenueInEntry = update.newClient / fx;
          updateDraft(update.id, {
            mode: "cost_revenue",
            revenue: revenueInEntry,
          });
        }
        setCalculatorOpen(false);
        toast.success(
          `Applied pricing to ${updates.length} line${updates.length === 1 ? "" : "s"}. Save to persist.`
        );
      });
    },
    [detail.items, drafts, updateDraft]
  );

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        sortedFilteredItems.forEach((item) => next.delete(item.id));
      } else {
        sortedFilteredItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }, [allVisibleSelected, sortedFilteredItems]);

  const setSelectAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) sortedFilteredItems.forEach((item) => next.add(item.id));
        else sortedFilteredItems.forEach((item) => next.delete(item.id));
        return next;
      });
    },
    [sortedFilteredItems]
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

    const removingIds = [...selectedIds];
    setOptimisticRemovedIds((prev) => {
      const next = new Set(prev);
      removingIds.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds(new Set());

    startBulkTransition(async () => {
      for (const id of removingIds) {
        const res = await removeQuotationItem({
          item_id: id,
          quotation_id: detail.id,
        });
        if (!res.ok) {
          toast.error(res.message);
          setOptimisticRemovedIds((prev) => {
            const next = new Set(prev);
            removingIds.forEach((removedId) => next.delete(removedId));
            return next;
          });
          return;
        }
      }
      toast.success("Selected creators removed.");
      router.refresh();
    });
  }, [confirmDelete, detail.id, selectedIds, router]);

  const [previewSelectionOpen, setPreviewSelectionOpen] = useState(false);

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
    setPreviewSelectionOpen(true);
  }, []);

  const basePreviewCreatorOptions = useMemo(
    () => buildQuotationCreatorOptions(detail.items),
    [detail.items]
  );
  const [previewCreatorOptions, setPreviewCreatorOptions] = useState(
    basePreviewCreatorOptions
  );
  const [previewPlatformsLoading, setPreviewPlatformsLoading] = useState(false);

  useEffect(() => {
    setPreviewCreatorOptions(basePreviewCreatorOptions);
  }, [basePreviewCreatorOptions]);

  useEffect(() => {
    if (!previewSelectionOpen) {
      setPreviewPlatformsLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewPlatformsLoading(true);
    void enrichQuotationCreatorOptionsWithLinkedPlatforms(
      detail.items,
      basePreviewCreatorOptions
    ).then((enriched) => {
      if (cancelled) return;
      setPreviewCreatorOptions(enriched);
      setPreviewPlatformsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [previewSelectionOpen, detail.items, basePreviewCreatorOptions]);

  const summarizePreviewSelection = useCallback(
    (itemIds: string[]) =>
      summarizeQuotationSelection(detail.items, itemIds, detail.currency ?? "EGP"),
    [detail.items, detail.currency]
  );

  const handlePreviewSelectionConfirm = useCallback(
    (selection: { itemIds: string[]; platforms?: string[] | null }) => {
      setSelectedIds(new Set(selection.itemIds));
      const params = new URLSearchParams();
      appendQuotationTemplateParam(params, exportTemplate);
      appendQuotationExportRevision(params, detail.updated_at);
      if (selection.itemIds.length) params.set("items", selection.itemIds.join(","));
      if (selection.platforms?.length) {
        params.set("platforms", selection.platforms.join(","));
      }
      const query = params.toString();
      const href = quotationPreviewPath(
        detail.id,
        detail.serial_number,
        query || undefined
      );
      window.open(href, "_blank", "noopener,noreferrer");
    },
    [detail.id, detail.serial_number, detail.updated_at, exportTemplate]
  );

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
    <div className="quotation-editor-rd4 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-24">
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
        selectedItemIds={[...selectedIds]}
        onSelectedItemIdsChange={(itemIds) => setSelectedIds(new Set(itemIds))}
        clientReview={clientReview}
      >
        <QuotationCommercialMetricsBand
          totalCostEgp={totals.totalCostEgp}
          totalRevenueEgp={totals.totalClientCostEgp}
          totalCommercialGpEgp={totals.totalGpValueEgp}
          totalAgencyFeeEgp={totals.totalAfValueEgp}
          totalGpValueEgp={totals.headerGpValueEgp}
          totalGpPct={totals.headerGpPct}
          totalPmPct={totals.headerPmPct}
          gpTargetPct={detail.gp_target_pct}
          creatorCount={uniqueCreatorCount}
          version={detail.version}
          validDaysRemaining={detail.valid_days_remaining}
          displayCurrency={displayCurrency}
          displayFxRateToEgp={displayFxRateToEgp}
          originalTotals={originalTotals}
          onDisplayCurrencyChange={
            detail.canManage ? handleDisplayCurrencyChange : undefined
          }
          currencyDisabled={currencyPending || !detail.canManage}
          hasDraftEdits={pendingItemIds.size > 0}
          savedClientCostEgp={savedTotals.totalClientCostEgp}
          onOpenCommercialWorkspace={
            detail.canManage ? () => setCommercialWorkspaceOpen(true) : undefined
          }
        />

        <QuotationLifecyclePills
          detail={detail}
          trailing={
            quotationIsMovedToCampaign(detail) ? null : (
              <QuotationValidityBar
                inline
                validityDate={detail.validity_date}
                validDaysRemaining={detail.valid_days_remaining}
                isExpired={detail.is_expired}
              />
            )
          }
        />

        <p
          className="px-8 py-2 text-[12px] font-semibold text-foreground"
          data-quotation-body-sentinel
        >
          Workspace · {uniqueCreatorCount} creators · {visibleItems.length} lines
        </p>

          {clientReview ? (
            <QuotationClientReviewPanel
              review={clientReview}
              items={visibleItems}
              filter={clientSelectionFilter}
              onFilter={setClientSelectionFilter}
              canManage={detail.canManage}
              quotationApproved={detail.status === "approved"}
              onSelectApproved={() => selectByClientState("accepted")}
              onSelectUnderReview={() => selectByClientState("in_review")}
              onAcceptOnBehalf={acceptUnderReviewOnBehalf}
              onMoveApprovedToCampaign={() => {
                if (approvedItemIds.length === 0) {
                  toast.error("No approved creators to move.");
                  return;
                }
                if (detail.status !== "approved") {
                  toast.error("Approve this quotation first, then move the approved creators to the campaign.");
                  return;
                }
                setConvertApprovedOpen(true);
              }}
              pending={bulkPending}
            />
          ) : null}

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
          {visibleItems.length === 0 ? (
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
                      · {uniqueCreatorCount} · {visibleItems.length} lines
                    </span>
                  </h2>
                  <p>
                    Grouped by influencer — duplicated creators are labeled Option 1, 2, 3… on each line.
                  </p>
                </div>
                <div className="sec-tools">
                  <QuotationCommercialEntry
                    quotationId={detail.id}
                    items={detail.items}
                    drafts={drafts}
                    onDraftChange={updateDraft}
                    onDraftsMerge={mergeDrafts}
                    canManage={detail.canManage}
                    triggerClassName="btn sm"
                    displayCurrency={displayCurrency}
                    displayFxRateToEgp={displayFxRateToEgp}
                    issueDate={detail.issue_date}
                    open={commercialWorkspaceOpen}
                    onOpenChange={setCommercialWorkspaceOpen}
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

              <div className="creators-list discovery-suite">
                <PlatformErrorBoundary
                  surface="generic"
                  title="Creators grid failed to render"
                  description="Metrics above are still valid. Retry or reload."
                >
                <QuotationLinesGrid
                  quotationId={detail.id}
                  items={sortedFilteredItems}
                  drafts={drafts}
                  selectedIds={selectedIds}
                  allSelected={allVisibleSelected}
                  indeterminate={selectionIndeterminate}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={setSelectAllVisible}
                  onDraftChange={updateDraft}
                  onRemoved={() => router.refresh()}
                  onLineChanged={refreshQuotationLines}
                  onOpenCreator={openCreatorFromItem}
                  uniqueCreatorCount={uniqueCreatorCount}
                  totalClientCostEgp={totals.totalClientCostEgp}
                  canManage={detail.canManage}
                />
                </PlatformErrorBoundary>
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
      </QuotationWorkspaceHeader>

      <QuotationSelectionBar
        selectedCount={selectedIds.size}
        totalCount={sortedFilteredItems.length}
        baseCost={selectionMoney.baseCost}
        clientCost={selectionMoney.clientCost}
        calculatorOpen={calculatorOpen}
        busy={bulkPending}
        onClear={clearSelection}
        onToggleCalculator={() => setCalculatorOpen((open) => !open)}
        onDuplicate={handleDuplicateSelected}
        onDelete={() => void handleRemoveSelected()}
      />
      <QuotationPricingCalculatorPanel
        open={calculatorOpen && selectedIds.size > 0}
        lines={selectedLinesForCalc}
        busy={bulkPending}
        onClose={() => setCalculatorOpen(false)}
        onApply={applyCalculator}
      />
      {detailSheet}
      <DocumentCreatorSelectionDialog
        open={previewSelectionOpen}
        onOpenChange={setPreviewSelectionOpen}
        creators={previewCreatorOptions}
        workspaceItemIds={[...selectedIds]}
        onWorkspaceSelectionChange={(itemIds) => setSelectedIds(new Set(itemIds))}
        summarizeSelection={summarizePreviewSelection}
        title="Select creators for quotation"
        confirmLabel="Open preview"
        confirmDisabled={previewPlatformsLoading}
        onConfirm={handlePreviewSelectionConfirm}
      />
      <ConvertQuotationDialog
        detail={detail}
        open={convertApprovedOpen}
        onOpenChange={setConvertApprovedOpen}
        itemIds={approvedItemIds}
      />
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
