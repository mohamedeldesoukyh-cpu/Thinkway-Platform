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
import Link from "next/link";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  PercentIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  QUOTATION_STATUS_LABELS,
} from "@/features/quotations/constants";
import { AddCreatorsToQuotationButton } from "@/features/quotations/components/add-creators-to-quotation-modal";
import { buildExportHref } from "@/features/quotations/components/quotation-preview-downloads";
import { QuotationKpiStrip } from "@/features/quotations/components/quotation-kpi-strip";
import { OnboardingStatusBadge } from "@/features/clients/components/onboarding-status-badge";
import { isClientOnboardingStatus } from "@/lib/clients/onboarding-status";
import { QuotationLifecyclePanel } from "@/features/quotations/components/quotation-lifecycle-panel";
import { QuotationClientBrandPanel } from "@/features/quotations/components/quotation-client-brand-panel";
import { QuotationDocumentMetaPanel } from "@/features/quotations/components/quotation-document-meta-panel";
import { QuotationSetupWizard } from "@/features/quotations/components/quotation-setup-wizard";
import { gpHealthTextClass } from "@/features/quotations/quotation-gp-health";
import { formatQuotationTermsText } from "@/features/quotations/quotation-default-terms";
import { formatValidityLabel } from "@/features/quotations/quotation-validity";
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
import {
  QUOTATION_TEMPLATE_OPTIONS,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
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

  const exportHref = useCallback(
    (format: string, download = true) =>
      buildExportHref(detail.id, format, exportTemplate, { download }),
    [detail.id, exportTemplate]
  );

  const previewHref = useMemo(() => {
    const params = new URLSearchParams();
    if (exportTemplate === "lump-sum") {
      params.set("template", "lump-sum");
    }
    const query = params.toString();
    return `/discovery/quotations/${detail.id}/preview${query ? `?${query}` : ""}`;
  }, [detail.id, exportTemplate]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <QuotationSetupWizard detail={detail} options={formOptions} />
      <div className="shrink-0 border-b border-border bg-background px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-semibold tracking-tight">{detail.name}</h1>
              <Badge variant="secondary">{QUOTATION_STATUS_LABELS[detail.status]}</Badge>
              {detail.is_expired ? (
                <Badge variant="destructive">Expired</Badge>
              ) : (
                <Badge variant="outline">{formatValidityLabel(detail.validity_date)}</Badge>
              )}
              {!detail.is_temporary_client &&
              detail.client_onboarding_status &&
              isClientOnboardingStatus(detail.client_onboarding_status) ? (
                <OnboardingStatusBadge status={detail.client_onboarding_status} />
              ) : null}
              <SaveIndicator status={workspaceSaveStatus} />
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {detail.serial_number ?? "QT-PENDING"} ·{" "}
              {[detail.client_name, detail.brand_name, detail.campaign_name]
                .filter(Boolean)
                .join(" · ") || "No client linked"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddCreatorsToQuotationButton
              quotationId={detail.id}
              onAdded={() => router.refresh()}
            />
            <div
              className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
              role="tablist"
              aria-label="Export template"
            >
              {QUOTATION_TEMPLATE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={exportTemplate === option.id}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    exportTemplate === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setExportTemplate(option.id)}
                >
                  {option.label}
                  <span className="ml-1.5 hidden text-[10px] font-normal text-muted-foreground sm:inline">
                    · {option.hint}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={previewHref} target="_blank" rel="noreferrer">
                <FileTextIcon className="size-4" /> Preview
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("excel")}>
                <FileSpreadsheetIcon className="size-4" /> Excel
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("word")}>
                <DownloadIcon className="size-4" /> Word
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("pdf")}>
                <DownloadIcon className="size-4" /> PDF
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <QuotationKpiStrip
            creatorCount={detail.items.length}
            estimatedReach={detail.estimated_reach}
            estimatedEngagementRate={detail.estimated_engagement_rate}
            totalCostEgp={totals.totalCostEgp}
            totalRevenueEgp={totals.totalRevenueEgp}
            totalGpValueEgp={totals.totalGpValueEgp}
            totalGpPct={totals.totalGpPct}
            totalAfEgp={totals.totalAfValueEgp}
            totalAgencyMarginEgp={totals.totalAgencyMarginEgp}
            gpTargetPct={detail.gp_target_pct}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <QuotationLifecyclePanel detail={detail} promoteOptions={promoteOptions} />
        <QuotationClientBrandPanel
          detail={detail}
          options={formOptions}
          disabled={!detail.canManage}
        />
        {detail.items.length === 0 ? (
          <EmptyState quotationId={detail.id} onAdded={() => router.refresh()} />
        ) : (
          <>
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

            {selectedIds.size > 0 ? (
              <BulkToolbar
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
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
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
          </>
        )}

        <QuotationDocumentMetaPanel detail={detail} />
        <HeaderNotes detail={detail} onStatusChange={setNotesSaveStatus} />
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
    <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium">No creators yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Add creators from a shortlist, Discovery selection, campaign, or manual entry.
      </p>
      <div className="mt-4 flex justify-center">
        <AddCreatorsToQuotationButton quotationId={quotationId} onAdded={onAdded} />
      </div>
    </div>
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
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[180px] flex-1">
        <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search creators…"
          value={creatorSearch}
          onChange={(e) => onCreatorSearch(e.target.value)}
        />
      </div>
      <Select value={platformFilter} onValueChange={onPlatformFilter}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          {platformOptions.map((p) => (
            <SelectItem key={p} value={p}>
              {platformLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={countryFilter} onValueChange={onCountryFilter}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All countries</SelectItem>
          {countryOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {countryFlag(c) ? `${countryFlag(c)} ${c}` : c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Default calculation
        </Label>
        <Select
          value={globalCalcMode}
          onValueChange={(v) => onGlobalCalcMode(v as CalculationModePreference)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CALCULATION_MODE_LABELS) as CalculationModePreference[]).map((m) => (
              <SelectItem key={m} value={m}>
                {CALCULATION_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function BulkToolbar({
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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <div className="flex items-center gap-1">
        <Input
          className="h-8 w-16"
          inputMode="decimal"
          value={bulkPct}
          onChange={(e) => setBulkPct(e.target.value)}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            const pct = parseNum(bulkPct);
            if (globalCalcMode === "markup") onApplyMarkupPct(pct);
            else onApplyGpPct(pct);
          }}
        >
          <PercentIcon className="size-3.5" />
          Apply {globalCalcMode === "markup" ? "Markup" : "GP Margin"}%
        </Button>
      </div>
      <Select onValueChange={onChangeCurrency}>
        <SelectTrigger className="h-8 w-[110px]">
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
      <Button variant="outline" size="sm" disabled={pending} onClick={onDuplicate}>
        <CopyIcon className="size-3.5" /> Duplicate
      </Button>
      <Button variant="outline" size="sm" onClick={onExport}>
        <DownloadIcon className="size-3.5" /> Export
      </Button>
      <Button variant="destructive" size="sm" disabled={pending} onClick={onRemove}>
        <Trash2Icon className="size-3.5" /> Remove
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={onClear}>
        <XIcon className="size-4" />
      </Button>
    </div>
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
  const [terms, setTerms] = useState(detail.terms ?? formatQuotationTermsText());

  const { status, schedule } = useDebouncedAutosave<{
    notes?: string;
    terms?: string;
  }>(async (payload) => updateQuotationHeader({ id: detail.id, ...payload }));

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="quotation-notes">Quotation notes</Label>
          <SaveIndicator status={status} />
        </div>
        <Textarea
          id="quotation-notes"
          rows={5}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            schedule({ notes: e.target.value, terms });
          }}
          placeholder="Internal or client-facing notes for this quotation…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="quotation-terms">Terms &amp; conditions</Label>
        <Textarea
          id="quotation-terms"
          rows={5}
          value={terms}
          onChange={(e) => {
            setTerms(e.target.value);
            schedule({ notes, terms: e.target.value });
          }}
          placeholder="Payment terms, validity, usage rights…"
        />
      </div>
    </div>
  );
}
