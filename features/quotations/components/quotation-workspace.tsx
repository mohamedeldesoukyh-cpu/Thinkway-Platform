"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  CopyIcon,
  DownloadIcon,
  PercentIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  GlassSelectionFlyout,
  GLASS_FLYOUT_PRIMARY_ACTION_CLASS,
  glassFlyoutContentClass,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { cn } from "@/lib/utils";
import {
  CALCULATION_MODE_LABELS,
  QUOTATION_CLIENT_LABELS,
} from "@/features/quotations/constants";
import { AddCreatorsToQuotationButton } from "@/features/quotations/components/add-creators-to-quotation-modal";
import { useQuotationWorkspaceShortcuts } from "@/features/quotations/components/use-quotation-workspace-shortcuts";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { QuotationTermsAccordion } from "@/features/quotations/components/quotation-terms-accordion";
import { QuotationWorkspaceHeader } from "@/features/quotations/components/quotation-workspace-header";
import { QuotationClientBrandPanel } from "@/features/quotations/components/quotation-client-brand-panel";
import { QuotationDocumentMetaPanel } from "@/features/quotations/components/quotation-document-meta-panel";
import { QuotationSetupWizard } from "@/features/quotations/components/quotation-setup-wizard";
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
  resolveQuotationRowDraft,
  type CalculationModePreference,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import {
  buildFilteredQuotationCreatorGroups,
  buildQuotationItemOptionContext,
  countUniqueQuotationCreators,
} from "@/lib/quotations/quotation-creator-options";
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
  const [bulkPending, startBulkTransition] = useTransition();
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

  const totals = useMemo(() => computeLiveQuotationTotals(draftList), [draftList]);

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

  const sortedFilteredItems = useMemo(
    () => [...filteredItems].sort((a, b) => a.sort_order - b.sort_order),
    [filteredItems]
  );

  const optionContextByItemId = useMemo(
    () => buildQuotationItemOptionContext(detail.items),
    [detail.items]
  );

  const creatorGroups = useMemo(
    () => buildFilteredQuotationCreatorGroups(detail.items, sortedFilteredItems),
    [detail.items, sortedFilteredItems]
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

  const handleRemoveSelected = useCallback(() => {
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
  }, [detail.id, selectedIds, router]);

  const previewHref = useMemo(() => {
    const params = new URLSearchParams();
    appendQuotationTemplateParam(params, exportTemplate);
    appendQuotationExportRevision(params, detail.updated_at);
    const query = params.toString();
    return `/discovery/quotations/${detail.id}/preview${query ? `?${query}` : ""}`;
  }, [detail.id, detail.updated_at, exportTemplate]);

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
    <div className="thinkway-campaign-workspace flex min-h-0 flex-col">
      <QuotationSetupWizard detail={detail} options={formOptions} />
      <QuotationWorkspaceHeader
        detail={detail}
        promoteOptions={promoteOptions}
        totals={totals}
        saveStatus={manualSave.saveStatus}
        hasUnsavedChanges={manualSave.hasUnsavedChanges}
        savePending={manualSave.savePending}
        onSave={() => {
          void manualSave.saveAll().then((ok) => {
            if (ok) toast.success("Quotation saved.");
          });
        }}
        exportTemplate={exportTemplate}
        onExportTemplateChange={setExportTemplate}
        uniqueCreatorCount={uniqueCreatorCount}
      />

      <div
        className={cn(
          "thinkway-campaign-content-inner min-h-0",
          glassFlyoutContentClass(selectedIds.size > 0)
        )}
      >
        <QuotationClientBrandPanel
          detail={detail}
          options={formOptions}
          disabled={!detail.canManage}
        />
        {detail.items.length === 0 ? (
          <EmptyState
            quotationId={detail.id}
            onAdded={() => router.refresh()}
            addCreatorsOpen={addCreatorsOpen}
            onAddCreatorsOpenChange={setAddCreatorsOpen}
          />
        ) : (
          <CampaignFlatSection
            title="Creators"
            description="Grouped by influencer — duplicated creators are labeled Option 1, 2, 3… on each line."
            flushBody
            actions={
              <AddCreatorsToQuotationButton
                quotationId={detail.id}
                onAdded={() => router.refresh()}
                label="+ Add creator"
                open={addCreatorsOpen}
                onOpenChange={setAddCreatorsOpen}
              />
            }
          >
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

            <div className="thinkway-campaign-table-scroll w-full">
              <Table variant="flush" className="thinkway-campaign-data-table w-full">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-9 px-2">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all visible creators"
                      />
                    </TableHead>
                    <TableHead className="min-w-[92px]">Option</TableHead>
                    <TableHead className="w-[8%] text-right">Followers</TableHead>
                    <TableHead className="w-[8%]">Tier</TableHead>
                    <TableHead className="min-w-[140px]">Service description</TableHead>
                    <TableHead className="w-[4.5rem] text-center">Platform</TableHead>
                    <TableHead className="min-w-[200px]">Type</TableHead>
                    <TableHead className="min-w-[11rem] w-auto px-3 text-right whitespace-nowrap">
                      <span className="text-xs font-bold uppercase tracking-wide">Price</span>
                      <span className="mt-0.5 block text-[10px] font-normal normal-case text-muted-foreground">
                        Via +Cost detail
                      </span>
                    </TableHead>
                    <TableHead className="w-[72px]">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creatorGroups.map((group, groupIndex) => (
                    <QuotationCreatorGroupRows
                      key={group.creatorKey}
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
                    />
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 z-10 bg-muted/95 font-medium backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Totals · {uniqueCreatorCount} creators · {draftList.length} option lines
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-semibold">
                      {egp(totals.totalRevenueEgp)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <div className="thinkway-campaign-section-footer justify-start">
              <AddCreatorsToQuotationButton
                quotationId={detail.id}
                onAdded={() => router.refresh()}
                triggerClassName="thinkway-campaign-btn-add"
                label="+ Add creator"
                open={addCreatorsOpen}
                onOpenChange={setAddCreatorsOpen}
              />
            </div>
          </CampaignFlatSection>
        )}

        <div className="thinkway-campaign-two-col thinkway-campaign-two-col--wide">
          <QuotationDocumentMetaPanel detail={detail} />
          <HeaderNotes detail={detail} />
        </div>

        <CampaignFlatSection
          title="Terms & conditions"
          description="Applies to this quotation unless amended in writing."
        >
          <QuotationTermsAccordion termsText={detail.terms} />
        </CampaignFlatSection>
      </div>
      {detailSheet}
    </div>
  );
}

function EmptyState({
  quotationId,
  onAdded,
  addCreatorsOpen,
  onAddCreatorsOpenChange,
}: {
  quotationId: string;
  onAdded: () => void;
  addCreatorsOpen: boolean;
  onAddCreatorsOpenChange: (open: boolean) => void;
}) {
  return (
    <CampaignFlatSection title="Creators" description="Add creators to build this quotation.">
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-medium text-[var(--camp-text)]">No creators yet</p>
        <p className="mt-1 text-xs text-[var(--camp-text-3)]">
          Add creators from a shortlist, Discovery selection, campaign, or manual entry.
        </p>
        <div className="mt-4 flex justify-center">
          <AddCreatorsToQuotationButton
            quotationId={quotationId}
            onAdded={onAdded}
            open={addCreatorsOpen}
            onOpenChange={onAddCreatorsOpenChange}
          />
        </div>
      </div>
    </CampaignFlatSection>
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
}) {
  return (
    <div className="thinkway-campaign-grid-toolbar border-b px-4 py-3">
      <div className="thinkway-campaign-search-box">
        <SearchIcon className="thinkway-campaign-search-ico size-3" />
        <input
          ref={creatorSearchRef}
          type="text"
          data-quotation-search
          placeholder="Search creators..."
          value={creatorSearch}
          onChange={(e) => onCreatorSearch(e.target.value)}
        />
      </div>
      <Select value={platformFilter} onValueChange={onPlatformFilter}>
        <SelectTrigger className="thinkway-campaign-filter-select h-[30px] w-[130px] border-[var(--camp-border)] text-[11px] shadow-none">
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
        <SelectTrigger className="thinkway-campaign-filter-select h-[30px] w-[150px] border-[var(--camp-border)] text-[11px] shadow-none">
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
    <CampaignFlatSection
      title="Quotation notes"
      description="Internal & client-facing."
      actions={
        hasUnsavedChanges ? (
          <span className="text-[10px] text-[var(--camp-amber)]">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : "Unsaved"}
          </span>
        ) : null
      }
    >
      <Textarea
        id="quotation-notes"
        rows={9}
        className="min-h-[220px] text-xs"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          registerMetaPending({ notes: e.target.value || null });
        }}
        placeholder="Internal or client-facing notes for this quotation…"
      />
    </CampaignFlatSection>
  );
}
