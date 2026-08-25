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
import { csvEscapeRow } from "@/lib/security/csv-formula";
import { cn } from "@/lib/utils";
import {
  CALCULATION_MODE_LABELS,
  QUOTATION_CLIENT_LABELS,
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
  QUOTATION_CLIENT_SELECTION_LABEL,
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
  resolveCommercialRateToEgp,
  updateQuotationHeader,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import { draftToLinePending } from "@/lib/quotations/commercial-workspace/stage-pending";
import {
  calcModeToCommercialMode,
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
import { applyCommercialWorkspaceBulkOp } from "@/lib/quotations/commercial-workspace/bulk-transforms";
import { resolveLiveTotalsDraft } from "@/features/quotations/quotation-pending-live-totals";
import { formatEgpTotalInDisplayCurrency } from "@/lib/quotations/quotation-line-creator-commercial-sync";
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
import { QuotationCommercialEntry } from "@/features/quotations/components/quotation-commercial-entry";
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
  const csv = [headers, ...rows].map((row) => csvEscapeRow(row)).join("\n");
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
  const [focusNewItemId, setFocusNewItemId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<QuotationWorkspaceSortState | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
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

  const optionContextByItemId = useMemo(
    () => buildQuotationItemOptionContext(visibleItems),
    [visibleItems]
  );

  const displayGroups = useMemo(
    () => buildQuotationWorkspaceDisplayGroups(sortedFilteredItems),
    [sortedFilteredItems]
  );

  const displayGroupSections = useMemo(() => {
    if (!clientReview) return [{ key: "all" as const, label: null as string | null, groups: displayGroups }];
    if (clientSelectionFilter !== "all") {
      return [
        {
          key: clientSelectionFilter,
          label: QUOTATION_CLIENT_SELECTION_LABEL[clientSelectionFilter],
          groups: displayGroups,
        },
      ];
    }
    const buckets = {
      accepted: [] as typeof displayGroups,
      in_review: [] as typeof displayGroups,
      rejected: [] as typeof displayGroups,
    };
    for (const group of displayGroups) {
      const items = group.kind === "creator" ? group.items : group.creatorGroups.flatMap((row) => row.items);
      buckets[clientSelectionForItems(items, clientReview.selectionState)].push(group);
    }
    return (["accepted", "in_review", "rejected"] as const)
      .filter((key) => buckets[key].length > 0)
      .map((key) => ({
        key,
        label: QUOTATION_CLIENT_SELECTION_LABEL[key],
        groups: buckets[key],
      }));
  }, [clientReview, clientSelectionFilter, displayGroups]);

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
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

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
          const next = applyCommercialWorkspaceBulkOp(
            draft,
            mode === "cost_markup_pct"
              ? { kind: "apply_markup_pct", pct }
              : { kind: "set_gp_pct", pct }
          );
          updateDraft(id, next);
          const res = await updateQuotationItemCommercials({
            item_id: id,
            quotation_id: detail.id,
            mode: next.mode,
            cost: next.cost,
            cost_currency: next.costCurrency,
            gp_pct: next.gpPct,
            revenue: next.revenue,
            gp_value: next.gpValue,
            af_pct: next.afPct,
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
        const rateRes = await resolveCommercialRateToEgp(currency, detail.issue_date);
        if (!rateRes.ok || !rateRes.data) {
          toast.error(rateRes.ok ? "Could not resolve FX rate." : rateRes.message);
          return;
        }
        const fxRateToEgp = rateRes.data.rate;
        for (const id of selectedIds) {
          const draft = drafts[id];
          if (!draft) continue;
          const next = applyCommercialWorkspaceBulkOp(draft, {
            kind: "set_currency",
            currency,
            fxRateToEgp,
          });
          updateDraft(id, next);
          const res = await updateQuotationItemCommercials({
            item_id: id,
            quotation_id: detail.id,
            mode: next.mode,
            cost: next.cost,
            cost_currency: next.costCurrency,
            gp_pct: next.gpPct,
            revenue: next.revenue,
            gp_value: next.gpValue,
            af_pct: next.afPct,
          });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          if (res.ok && res.data?.fx_rate_to_egp != null) {
            updateDraft(id, { fxRateToEgp: res.data.fx_rate_to_egp });
          }
        }
        toast.success(`Currency updated for ${selectedIds.size} creator(s).`);
        router.refresh();
      });
    },
    [selectedIds, drafts, detail.id, detail.issue_date, updateDraft, router]
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
        selectedItemIds={[...selectedIds]}
        onSelectedItemIdsChange={(itemIds) => setSelectedIds(new Set(itemIds))}
        clientReview={clientReview}
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
          displayCurrency={displayCurrency}
          displayFxRateToEgp={displayFxRateToEgp}
          originalTotals={originalTotals}
          onDisplayCurrencyChange={
            detail.canManage ? handleDisplayCurrencyChange : undefined
          }
          currencyDisabled={currencyPending || !detail.canManage}
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

              {displayGroupSections.map((section) => (
                <div key={section.key}>
                  {section.label ? (
                    <div className="px-1 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted,#6B7280)]">
                      {section.label}
                    </div>
                  ) : null}
                  {section.groups.map((group, groupIndex) => {
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
                      displayCurrency={displayCurrency}
                      displayFxRateToEgp={displayFxRateToEgp}
                      selectionState={clientReview?.selectionState}
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
                      displayCurrency={displayCurrency}
                      displayFxRateToEgp={displayFxRateToEgp}
                      clientSelection={clientSelectionForItems(
                        group.items,
                        clientReview?.selectionState
                      )}
                    />
                  )}
                </div>
                );
                  })}
                </div>
              ))}

              <div className="totals sticky bottom-0 z-10">
                <span className="lbl">
                  Totals · {uniqueCreatorCount} creators · {totalsDraftList.length} option lines
                </span>
                <span className="amt">
                  {formatEgpTotalInDisplayCurrency(
                    totals.totalClientCostEgp,
                    displayCurrency,
                    displayFxRateToEgp
                  )}
                </span>
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
