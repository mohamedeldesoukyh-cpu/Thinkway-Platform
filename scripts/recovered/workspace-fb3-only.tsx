"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
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
import {
  type CommercialInputMode,
} from "@/lib/commercial/commercial-engine";
import {
  COMMERCIAL_CURRENCIES,
  formatDualCurrency,
} from "@/lib/commercial/fx-aggregation";
import { useDebouncedAutosave, type AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import {
  creatorProfileSourceFromPlatformAccount,
  CreatorIdentityCell,
} from "@/components/creator/creator-profile-link";
import { platformLabel } from "@/features/campaigns/line-assignment";
import {
  countryFlag,
  formatCreatorCount,
} from "@/features/discovery/components/creator-search/creator-search-utils";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";
import {
  CALCULATION_MODE_LABELS,
  COMMERCIAL_INPUT_MODE_LABELS,
  DEFAULT_GP_TARGET_PCT,
  QUOTATION_CLIENT_LABELS,
} from "@/features/quotations/constants";
import { AddCreatorsToQuotationButton } from "@/features/quotations/components/add-creators-to-quotation-modal";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { QuotationCreatorsTotalsStrip } from "@/features/quotations/components/quotation-creators-totals-strip";
import { QuotationTermsAccordion } from "@/features/quotations/components/quotation-terms-accordion";
import { QuotationWorkspaceHeader } from "@/features/quotations/components/quotation-workspace-header";
import { QuotationClientBrandPanel } from "@/features/quotations/components/quotation-client-brand-panel";
import { QuotationDocumentMetaPanel } from "@/features/quotations/components/quotation-document-meta-panel";
import { QuotationSetupWizard } from "@/features/quotations/components/quotation-setup-wizard";
import { gpHealthTextClass } from "@/features/quotations/quotation-gp-health";
import {
  duplicateQuotationItems,
  removeQuotationItem,
  updateQuotationHeader,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import {
  aggregateAutosaveStatus,
  calcModeToCommercialMode,
  computeLiveQuotationTotals,
  computeQuotationRowComputed,
  draftFromQuotationItem,
  draftsFromItems,
  type CalculationModePreference,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationTemplateVariant } from "@/features/quotations/export/quotation-template";
import type { PromoteWizardOptions, QuotationDetail, QuotationFormOptions, QuotationItemRow } from "@/features/quotations/types";

function egp(n: number, decimals = 0): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "pending")
    return <span className="text-xs text-warning">Unsaved changes</span>;
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary">
        <CheckIcon className="size-3" /> Saved
      </span>
    );
  if (status === "error")
    return <span className="text-xs text-destructive">Save failed</span>;
  return null;
}

function gpHealthClass(gpValueEgp: number, gpPct: number, targetPct = DEFAULT_GP_TARGET_PCT): string {
  return gpHealthTextClass({ gpValueEgp, gpPct, targetPct });
}

function deliverablesSummary(item: QuotationItemRow): string {
  if (!item.deliverables.length) return "—";
  return item.deliverables
    .map((d) => `${d.quantity}× ${d.type}`)
    .join(", ");
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
    "Handle",
    "Platform",
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
        item.handle ?? "",
        item.platform ?? "",
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
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => draftsFromItems(detail.items));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [globalCalcMode, setGlobalCalcMode] = useState<CalculationModePreference>("markup");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [rowSaveStatuses, setRowSaveStatuses] = useState<Record<string, AutosaveStatus>>({});
  const [notesSaveStatus, setNotesSaveStatus] = useState<AutosaveStatus>("idle");
  const [exportTemplate, setExportTemplate] = useState<QuotationTemplateVariant>("detailed");
  const [bulkPending, startBulkTransition] = useTransition();

  // Sync drafts when items are added/removed server-side (preserve in-flight edits).
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
    () => detail.items.map((item) => drafts[item.id]).filter(Boolean),
    [detail.items, drafts]
  );

  const totals = useMemo(() => computeLiveQuotationTotals(draftList), [draftList]);

  const workspaceSaveStatus = useMemo(
    () => aggregateAutosaveStatus([...Object.values(rowSaveStatuses), notesSaveStatus]),
    [rowSaveStatuses, notesSaveStatus]
  );

  const platformOptions = useMemo(() => {
    const set = new Set(detail.items.map((i) => i.platform).filter(Boolean) as string[]);
    return [...set].sort();
  }, [detail.items]);

  const countryOptions = useMemo(() => {
    const set = new Set(detail.items.map((i) => i.country_code).filter(Boolean) as string[]);
    return [...set].sort();
  }, [detail.items]);

  const filteredItems = useMemo(() => {
    const q = creatorSearch.trim().toLowerCase();
    return detail.items.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (countryFilter !== "all" && item.country_code !== countryFilter) return false;
      if (!q) return true;
      const hay = [item.creator_name, item.handle, item.platform]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [detail.items, creatorSearch, platformFilter, countryFilter]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const updateDraft = useCallback((id: string, patch: Partial<QuotationRowDraft>) => {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }, []);

  const setRowSaveStatus = useCallback((id: string, status: AutosaveStatus) => {
    setRowSaveStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

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

  return (
    <div className="thinkway-campaign-workspace flex h-full min-h-0 flex-col overflow-hidden">
      <QuotationSetupWizard detail={detail} options={formOptions} />
      <QuotationWorkspaceHeader
        detail={detail}
        promoteOptions={promoteOptions}
        totals={totals}
        saveStatus={workspaceSaveStatus}
        exportTemplate={exportTemplate}
        onExportTemplateChange={setExportTemplate}
      />

      <div
        className={cn(
          "thinkway-campaign-content min-h-0 flex-1 overflow-y-auto",
          glassFlyoutContentClass(selectedIds.size > 0)
        )}
      >
        <QuotationClientBrandPanel
          detail={detail}
          options={formOptions}
          disabled={!detail.canManage}
        />
        {detail.items.length === 0 ? (
          <EmptyState quotationId={detail.id} onAdded={() => router.refresh()} />
        ) : (
          <CampaignFlatSection
            title="Creators"
            description="Rate, calculation method, and computed margin per creator."
            flushBody
            actions={
              <AddCreatorsToQuotationButton
                quotationId={detail.id}
                onAdded={() => router.refresh()}
                label="+ Add creator"
              />
            }
          >
            <Toolbar
                creatorSearch={creatorSearch}
                onCreatorSearch={setCreatorSearch}
                platformFilter={platformFilter}
                onPlatformFilter={setPlatformFilter}
                platformOptions={platformOptions}
                countryFilter={countryFilter}
                onCountryFilter={setCountryFilter}
                countryOptions={countryOptions}
                globalCalcMode={globalCalcMode}
                onGlobalCalcMode={setGlobalCalcMode}
            />

            <QuotationCreatorsTotalsStrip
              totalCostEgp={totals.totalCostEgp}
              totalRevenueEgp={totals.totalRevenueEgp}
              totalGpValueEgp={totals.totalGpValueEgp}
              totalGpPct={totals.totalGpPct}
              gpTargetPct={detail.gp_target_pct}
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
              onRemove={() => {
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
              }}
              onDuplicate={() => {
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
              }}
              onExport={() =>
                exportSelectedCsv(detail.items, drafts, selectedIds, detail.name)
              }
            />

            <div className="overflow-x-auto">
              <Table className="thinkway-campaign-data-table">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 px-2">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all visible creators"
                      />
                    </TableHead>
                    <TableHead className="min-w-[160px]">Creator</TableHead>
                    <TableHead className="w-[100px]">Platform</TableHead>
                    <TableHead className="w-[88px] text-right">Followers</TableHead>
                    <TableHead className="w-[72px]">Country</TableHead>
                    <TableHead className="min-w-[120px]">Deliverables</TableHead>
                    <TableHead className="w-[96px]">Unit Cost</TableHead>
                    <TableHead className="w-[88px]">Currency</TableHead>
                    <TableHead className="min-w-[130px]">Calculation</TableHead>
                    <TableHead className="w-[120px] text-right">{QUOTATION_CLIENT_LABELS.clientCost}</TableHead>
                    <TableHead className="w-[100px] text-right">GP</TableHead>
                    <TableHead className="w-[88px] text-right">GP%</TableHead>
                    <TableHead className="w-[72px] text-right">AF%</TableHead>
                    <TableHead className="w-[100px] text-right">AF</TableHead>
                    <TableHead className="w-[110px] text-right">
                      {QUOTATION_CLIENT_LABELS.totalAgencyMargin}
                    </TableHead>
                    <TableHead className="w-[72px]">Status</TableHead>
                    <TableHead className="w-[56px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <CommercialRow
                      key={item.id}
                      quotationId={detail.id}
                      gpTargetPct={detail.gp_target_pct}
                      item={item}
                      draft={drafts[item.id]}
                      zebra={index % 2 === 1}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onDraftChange={updateDraft}
                      onSaveStatus={setRowSaveStatus}
                      onRemoved={() => router.refresh()}
                    />
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 z-10 bg-muted/95 font-medium backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="text-xs uppercase tracking-wide text-muted-foreground">
                      Totals ({draftList.length} creators)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {egp(totals.totalCostEgp)}
                    </TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right tabular-nums text-sm">
                      {egp(totals.totalRevenueEgp)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums text-sm",
                        gpHealthClass(
                          totals.totalGpValueEgp,
                          totals.totalGpPct,
                          detail.gp_target_pct
                        )
                      )}
                    >
                      {egp(totals.totalGpValueEgp)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums text-sm",
                        gpHealthClass(
                          totals.totalGpValueEgp,
                          totals.totalGpPct,
                          detail.gp_target_pct
                        )
                      )}
                    >
                      {totals.totalGpPct.toFixed(1)}%
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums text-sm">
                      {egp(totals.totalAfValueEgp)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-semibold">
                      {egp(totals.totalAgencyMarginEgp)}
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
              />
            </div>
          </CampaignFlatSection>
        )}

        <div className="thinkway-campaign-two-col thinkway-campaign-two-col--wide">
          <QuotationDocumentMetaPanel detail={detail} />
          <HeaderNotes detail={detail} onStatusChange={setNotesSaveStatus} />
        </div>

        <CampaignFlatSection
          title="Terms & conditions"
          description="Applies to this quotation unless amended in writing."
        >
          <QuotationTermsAccordion termsText={detail.terms} />
        </CampaignFlatSection>
      </div>
    </div>
  );
}

function EmptyState({
  quotationId,
  onAdded,
}: {
  quotationId: string;
  onAdded: () => void;
}) {
  return (
    <CampaignFlatSection title="Creators" description="Add creators to build this quotation.">
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-medium text-[var(--camp-text)]">No creators yet</p>
        <p className="mt-1 text-xs text-[var(--camp-text-3)]">
          Add creators from a shortlist, Discovery selection, campaign, or manual entry.
        </p>
        <div className="mt-4 flex justify-center">
          <AddCreatorsToQuotationButton quotationId={quotationId} onAdded={onAdded} />
        </div>
      </div>
    </CampaignFlatSection>
  );
}

function Toolbar({
  creatorSearch,
  onCreatorSearch,
  platformFilter,
  onPlatformFilter,
  platformOptions,
  countryFilter,
  onCountryFilter,
  countryOptions,
  globalCalcMode,
  onGlobalCalcMode,
}: {
  creatorSearch: string;
  onCreatorSearch: (v: string) => void;
  platformFilter: string;
  onPlatformFilter: (v: string) => void;
  platformOptions: string[];
  countryFilter: string;
  onCountryFilter: (v: string) => void;
  countryOptions: string[];
  globalCalcMode: CalculationModePreference;
  onGlobalCalcMode: (v: CalculationModePreference) => void;
}) {
  return (
    <div className="thinkway-campaign-grid-toolbar border-b px-4 py-3">
      <div className="thinkway-campaign-search-box">
        <SearchIcon className="thinkway-campaign-search-ico size-3" />
        <input
          type="text"
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
      <Select value={countryFilter} onValueChange={onCountryFilter}>
        <SelectTrigger className="thinkway-campaign-filter-select h-[30px] w-[120px] border-[var(--camp-border)] text-[11px] shadow-none">
          <SelectValue placeholder="Country · All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Country · All</SelectItem>
          {countryOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {countryFlag(c) ? `${countryFlag(c)} ${c}` : c}
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

function CommercialRow({
  quotationId,
  gpTargetPct,
  item,
  draft,
  zebra,
  selected,
  onToggleSelect,
  onDraftChange,
  onSaveStatus,
  onRemoved,
}: {
  quotationId: string;
  gpTargetPct: number;
  item: QuotationItemRow;
  draft: QuotationRowDraft | undefined;
  zebra: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onSaveStatus: (id: string, status: AutosaveStatus) => void;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const costRef = useRef<HTMLInputElement>(null);
  const revenueRef = useRef<HTMLInputElement>(null);
  const gpPctRef = useRef<HTMLInputElement>(null);

  const mode = draft?.mode ?? item.commercial_input_mode;
  const cost = draft?.cost ?? item.cost;
  const costCurrency = draft?.costCurrency ?? item.cost_currency;
  const gpPct = draft?.gpPct ?? item.gp_pct;
  const revenue = draft?.revenue ?? item.revenue;
  const gpValue = draft?.gpValue ?? item.gp_value;
  const afPct = draft?.afPct ?? item.af_pct;
  const fxRate = draft?.fxRateToEgp ?? item.fx_rate_to_egp;

  const computed = useMemo(
    () =>
      computeQuotationRowComputed({
        id: item.id,
        mode,
        cost,
        costCurrency,
        gpPct,
        revenue,
        gpValue,
        afPct,
        fxRateToEgp: fxRate,
      }),
    [item.id, mode, cost, costCurrency, gpPct, revenue, gpValue, afPct, fxRate]
  );

  const { status, schedule } = useDebouncedAutosave<{
    mode: CommercialInputMode;
    cost: number | null;
    cost_currency: string;
    gp_pct?: number | null;
    revenue?: number | null;
    gp_value?: number | null;
    af_pct?: number | null;
  }>(async (payload) => {
    const res = await updateQuotationItemCommercials({
      item_id: item.id,
      quotation_id: quotationId,
      ...payload,
    });
    if (res.ok && res.data?.fx_rate_to_egp != null) {
      onDraftChange(item.id, { fxRateToEgp: res.data.fx_rate_to_egp });
    }
    return res;
  });

  useEffect(() => {
    onSaveStatus(item.id, status);
  }, [item.id, status, onSaveStatus]);

  const triggerSave = useCallback(
    (patch: Partial<QuotationRowDraft>) => {
      const next = {
        mode: patch.mode ?? mode,
        cost: patch.cost ?? cost,
        costCurrency: patch.costCurrency ?? costCurrency,
        gpPct: patch.gpPct ?? gpPct,
        revenue: patch.revenue ?? revenue,
        gpValue: patch.gpValue ?? gpValue,
        afPct: patch.afPct ?? afPct,
        fxRateToEgp:
          patch.costCurrency && patch.costCurrency !== "EGP" && patch.costCurrency !== costCurrency
            ? 1
            : fxRate,
      };
      onDraftChange(item.id, next);
      schedule({
        mode: next.mode,
        cost: next.cost,
        cost_currency: next.costCurrency,
        gp_pct: next.gpPct,
        revenue: next.revenue,
        gp_value: next.gpValue,
        af_pct: next.afPct,
      });
    },
    [
      mode,
      cost,
      costCurrency,
      gpPct,
      revenue,
      gpValue,
      afPct,
      fxRate,
      item.id,
      onDraftChange,
      schedule,
    ]
  );

  function handleRemove() {
    startTransition(async () => {
      const res = await removeQuotationItem({ item_id: item.id, quotation_id: quotationId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Creator removed.");
      onRemoved();
    });
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  const flag = countryFlag(item.country_code);
  const gpClass = gpHealthClass(computed.gpValueEgp, computed.gpPct, gpTargetPct);

  return (
    <TableRow
      className={cn(
        "h-14 max-h-14 [&_td]:py-1.5",
        zebra && "bg-muted/30",
        selected && "bg-primary/5",
        "hover:bg-muted/50"
      )}
      onKeyDown={handleRowKeyDown}
    >
      <TableCell className="px-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${item.creator_name ?? item.handle ?? "creator"}`}
        />
      </TableCell>
      <TableCell className="max-w-[180px]">
        <CreatorIdentityCell
          source={creatorProfileSourceFromPlatformAccount(
            item.creator_name ?? item.handle ?? "Creator",
            item.platform ? { platform: item.platform, handle: item.handle ?? "" } : null
          )}
          size="sm"
          showAvatar
          showName
          showHandle
        />
      </TableCell>
      <TableCell>
        {item.platform ? (
          <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            <PlatformIcon platform={item.platform} size="xs" className="size-3.5 rounded-full" />
            <span className="truncate capitalize">{platformLabel(item.platform)}</span>
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {formatCreatorCount(item.followers)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {flag ? `${flag} ${item.country_code}` : item.country_code ?? "—"}
      </TableCell>
      <TableCell className="max-w-[120px] truncate text-[11px] text-muted-foreground">
        {deliverablesSummary(item)}
      </TableCell>
      <TableCell>
        <Input
          ref={costRef}
          className="h-8 w-[88px] text-xs"
          inputMode="decimal"
          value={String(cost || "")}
          onChange={(e) => triggerSave({ cost: parseNum(e.target.value) })}
        />
      </TableCell>
      <TableCell>
        <Select
          value={costCurrency}
          onValueChange={(v) => triggerSave({ costCurrency: v })}
        >
          <SelectTrigger className="h-8 w-[76px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMERCIAL_CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={mode}
          onValueChange={(v) => triggerSave({ mode: v as CommercialInputMode })}
        >
          <SelectTrigger className="h-8 min-w-[120px] text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(COMMERCIAL_INPUT_MODE_LABELS) as CommercialInputMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {COMMERCIAL_INPUT_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        {mode === "cost_revenue" ? (
          <Input
            ref={revenueRef}
            className="ml-auto h-8 w-[96px] text-xs"
            inputMode="decimal"
            value={String(revenue || "")}
            onChange={(e) => triggerSave({ revenue: parseNum(e.target.value) })}
          />
        ) : (
          <span className="tabular-nums text-xs">
            {formatDualCurrency({
              amount: computed.revenue,
              currency: costCurrency,
              egpAmount: computed.revenueEgp,
            })}
          </span>
        )}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums text-xs", gpClass)}>
        {mode === "cost_gp_value" ? (
          <Input
            className="ml-auto h-8 w-[88px] text-xs"
            inputMode="decimal"
            value={String(gpValue || "")}
            onChange={(e) => triggerSave({ gpValue: parseNum(e.target.value) })}
          />
        ) : (
          egp(computed.gpValueEgp)
        )}
      </TableCell>
      <TableCell className={cn("text-right text-xs", gpClass)}>
        {mode === "cost_gp_pct" || mode === "cost_markup_pct" ? (
          <div className="flex items-center justify-end gap-0.5">
            <Input
              ref={gpPctRef}
              className="h-8 w-[56px] text-xs"
              inputMode="decimal"
              value={String(gpPct || "")}
              onChange={(e) => triggerSave({ gpPct: parseNum(e.target.value) })}
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        ) : (
          <span className="tabular-nums">{computed.gpPct.toFixed(1)}%</span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs">
        <div className="flex items-center justify-end gap-0.5">
          <Input
            className="h-8 w-[56px] text-xs"
            inputMode="decimal"
            value={String(afPct || "")}
            onChange={(e) => triggerSave({ afPct: parseNum(e.target.value) })}
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {egp(computed.afValueEgp, 2)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs font-medium">
        {egp(computed.agencyMarginEgp, 2)}
      </TableCell>
      <TableCell>
        <SaveIndicator status={status} />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleRemove}
          disabled={pending}
          aria-label="Remove creator"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function HeaderNotes({
  detail,
  onStatusChange,
}: {
  detail: QuotationDetail;
  onStatusChange: (status: AutosaveStatus) => void;
}) {
  const [notes, setNotes] = useState(detail.notes ?? "");

  const { status, schedule } = useDebouncedAutosave<{
    notes?: string;
  }>(async (payload) => updateQuotationHeader({ id: detail.id, ...payload }));

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  return (
    <CampaignFlatSection
      title="Quotation notes"
      description="Internal & client-facing."
      actions={<SaveIndicator status={status} />}
    >
      <Textarea
        id="quotation-notes"
        rows={9}
        className="min-h-[220px] text-xs"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          schedule({ notes: e.target.value });
        }}
        placeholder="Internal or client-facing notes for this quotation…"
      />
    </CampaignFlatSection>
  );
}
