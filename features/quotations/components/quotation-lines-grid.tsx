import { QuotationText } from "./quotation-design-locale";
import { isOtherService } from "@/lib/commercial/other-service";

import { useCallback, useTransition, useState } from "react";
import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import {
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DiscoverySuiteCreatorCell,
  discoverySuiteHandleLabel,
} from "@/features/discovery/components/design-system";
import { QuotationDeliverableCostDetails } from "@/features/quotations/components/quotation-deliverable-cost-details";
import { QuotationDeliverableTypeLinesEditor } from "@/features/quotations/components/quotation-deliverable-type-lines";
import { QuotationDeliverablePlatformIcons } from "@/features/quotations/components/quotation-deliverable-platform-icons";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import { useQuotationLineFields } from "@/features/quotations/components/quotation-line-fields";
import {
  addQuotationItemOption,
  duplicateQuotationItems,
  removeQuotationItem,
} from "@/features/quotations/actions";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  computeQuotationDisplayTotals,
  computeQuotationRowClientCommercials,
  computeQuotationRowComputed,
  resolveQuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import { CreatorPlatformTiers } from "@/components/creator/creator-platform-tiers";
import { Badge } from "@/components/ui/badge";
import { hasUgcCategory } from "@/lib/creators/ugc-category";
import { quotationPlatformTierAccounts } from "@/lib/quotations/quotation-platform-tiers";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";
import { F } from "@/lib/discovery/suite/helpers";
import {
  deliverableTypeLines,
  formatTypeLinesSummary,
  optionNumberLabel,
  platformsFromSelectedPostTypes,
  selectedTypesFromTypeLines,
  syncDeliverableFromTypeLines,
  syncServiceDescriptionWithTypeLines,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import { quotationPackageRepeat, repeatQuotationPackage } from "@/lib/quotations/quotation-package-repeat";
import { formatDeliverableGpPct } from "@/lib/quotations/quotation-deliverable-commercial";


function quotationCreatorCountryCodes(item: QuotationItemRow): string[] | null {
  const fromSource = item.creator_profile_source?.countryCodes?.filter(Boolean);
  if (fromSource && fromSource.length > 0) return fromSource;
  const single =
    item.creator_profile_source?.countryCode?.trim() ||
    item.country_code?.trim() ||
    null;
  return single ? [single] : null;
}

type LineRowProps = {
  quotationId: string;
  item: QuotationItemRow;
  draft: QuotationRowDraft | undefined;
  index: number;
  optionCount: number;
  showCreator: boolean;
  expanded: boolean;
  onActivate: (id: string | null) => void;
  selected: boolean;
  onToggleSelect: () => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  onOpenCreator?: (item: QuotationItemRow) => void;
  canManage: boolean;
  showOriginalCurrency?: boolean;
  hideCostAndFees?: boolean;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};

function QuotationPackLineRow({
  quotationId,
  item,
  draft,
  index,
  optionCount,
  showCreator,
  expanded,
  onActivate,
  selected,
  onToggleSelect,
  onDraftChange,
  onRemoved,
  onLineChanged,
  onOpenCreator,
  canManage,
  showOriginalCurrency = false,
  hideCostAndFees = false,
  displayCurrency,
  displayFxRateToEgp,
}: LineRowProps) {
  const [pending, startTransition] = useTransition();
  const setExpanded = (open: boolean) => onActivate(open ? item.id : null);
  const confirmDelete = useConfirmDelete();
  const manualSave = useQuotationManualSave();
  const resolved = resolveQuotationRowDraft(item, draft);
  const otherService = isOtherService(item);
  const linePending = manualSave.isLinePending(item.id);
  const name =
    item.creator_profile_source?.displayName?.trim() ||
    item.creator_name?.trim() ||
    "Unknown";
  const handleLabel =
    discoverySuiteHandleLabel(
      item.creator_profile_source?.handle ?? item.handle
    ) ?? null;
  const optionLabel =
    optionNumberLabel(item.option_number) ?? `Option ${item.option_number}`;

  const syncCommercialsFromDeliverables = useCallback(
    (roll: {
      cost: number;
      revenue: number;
      gpPct: number;
      gpValue: number;
      costCurrency: string;
      afPct: number;
    }) => {
      onDraftChange(item.id, {
        mode: "cost_revenue",
        afPct: roll.afPct,
        cost: roll.cost,
        revenue: roll.revenue,
        gpPct: roll.gpPct,
        gpValue: roll.gpValue,
        costCurrency: roll.costCurrency,
      });
    },
    [item.id, onDraftChange]
  );

  const lineFields = useQuotationLineFields(
    item,
    syncCommercialsFromDeliverables,
    (payload) => manualSave.registerLinePending(item.id, payload),
    manualSave.isLinePending(item.id) ? "pending" : "idle",
    manualSave.isLinePending(item.id),
    manualSave.registerSaveFlush,
    {
      costCurrency: draft?.costCurrency,
      fxRateToEgp: draft?.fxRateToEgp,
    }
  );

  const primary = lineFields.deliverableDrafts[0];
  const allowedCreatorPlatforms = lineFields.platformSelectOptions.map((p) => p.platform);
  const selectedPlatforms = lineFields.deliverableDrafts.flatMap((deliverable) => {
    if (selectedTypesFromTypeLines(deliverableTypeLines(deliverable)).length === 0) return [];
    const fromTypes = platformsFromSelectedPostTypes(
      selectedTypesFromTypeLines(deliverableTypeLines(deliverable)),
      allowedCreatorPlatforms
    );
    if (fromTypes.length > 0) return fromTypes;
    return (deliverable.platform || item.platform || "")
      .split(",")
      .map((platform) => platform.trim())
      .filter(Boolean);
  });
  const clientCommercials = computeQuotationRowClientCommercials(resolved);
  const rowCurrency = displayCurrency || "EGP";
  const projected = computeQuotationDisplayTotals([resolved], rowCurrency, displayFxRateToEgp ?? 1);
  const repeat = quotationPackageRepeat(lineFields.deliverableDrafts);
  const priceUnits = repeat ?? 1;
  const clientPrice = projected.clientCost / priceUnits;
  const originalCurrency = (resolved.costCurrency || "EGP").trim().toUpperCase();
  const originalPrice = showOriginalCurrency && originalCurrency !== rowCurrency
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(clientCommercials.clientCost / priceUnits)} ${originalCurrency}`
    : null;

  function updateServiceDescription(description: string) {
    lineFields.setServiceDescription(description);
    manualSave.registerLinePending(item.id, { service_description: description });
  }

  function applyDeliverable(key: string, next: QuotationDeliverable) {
    if (next.cost_currency) {
      onDraftChange(item.id, { costCurrency: next.cost_currency });
    }
    lineFields.saveDeliverables(
      lineFields.deliverableDrafts.map((d) =>
        d.key === key ? { ...d, ...next } : d
      )
    );
  }

  function handleRemove() {
    void (async () => {
      const ok = await confirmDelete(
        `Remove ${name} · ${optionLabel} from this quotation? This cannot be undone.`,
        "Remove line?"
      );
      if (!ok) return;
      startTransition(async () => {
        const res = await removeQuotationItem({
          item_id: item.id,
          quotation_id: quotationId,
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success("Line removed.");
        onRemoved();
      });
    })();
  }

  function handleDuplicate() {
    startTransition(async () => {
      const res = await duplicateQuotationItems({
        quotation_id: quotationId,
        item_ids: [item.id],
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Line duplicated.");
      onLineChanged();
    });
  }

  function handleAddOption() {
    startTransition(async () => {
      if (manualSave.hasUnsavedChanges && !(await manualSave.saveAll())) return;
      const res = await addQuotationItemOption({
        quotation_id: quotationId,
        item_id: item.id,
        blank_service: true,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Service added. Set deliverables and cost below.");
      if (res.data?.id) onActivate(res.data.id);
      onLineChanged();
    });
  }

  const renderCostDetails = (showPrice: boolean) => canManage && primary ? (
<QuotationDeliverableCostDetails
              triggerLabel="+ Add cost"
                    displayCurrency={displayCurrency}
                    displayFxRateToEgp={displayFxRateToEgp}
                    onFxChange={patch => {
                      onDraftChange(item.id, patch);
                      manualSave.registerLinePending(item.id, {
                        ...(patch.costFxOverride !== undefined ? { cost_fx_override: patch.costFxOverride } : {}),
                        ...(patch.revenueFxOverride !== undefined ? { revenue_fx_override: patch.revenueFxOverride } : {}),
                      });
                    }}
              deliverable={primary}
              item={item}
              draft={draft}
              priceLabel={showPrice ? `${F(clientPrice)} ${rowCurrency}` : undefined}
              priceSecondaryLabel={originalPrice}
              gpPctLabel={formatDeliverableGpPct(
                primary,
                draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1
              )}
              onApply={(next) => applyDeliverable(primary.key, next)}
              onLiveChange={(next) => applyDeliverable(primary.key, next)}
              priceLayout="stacked"
            />
  ) : null;

  return (
    <div className={`q-line-group ${selected ? "is-sel" : ""}`}>
      <div className={`q-row q-live-row ${selected ? "is-sel" : ""}`} role="row" onClick={(event) => {
        if (event.defaultPrevented || !(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return;
        if (event.target.closest('button, a, input, textarea, select, label, [role="button"], [role="checkbox"], [role="switch"], [role="combobox"], [contenteditable="true"]')) return;
        if (window.getSelection()?.toString()) return;
        setExpanded(true);
      }}>
        <div className="q-cell-select" role="cell"><input type="checkbox" className="q-ck" checked={selected} onChange={onToggleSelect} aria-label={`Select ${name}${optionCount > 1 ? ` ${optionLabel}` : ""}`} disabled={!canManage} /></div>
        <div className="q-cell-creator" role="cell">
          {showCreator && otherService && <div className="space-y-1"><Badge variant="outline">Others</Badge><div className="font-medium">{name}</div><a className="text-xs text-primary" href={`/vendors/${item.influencer_id}`}>View vendor</a></div>}
          {showCreator && !otherService && <DiscoverySuiteCreatorCell name={name} handleLabel={handleLabel} index={index}
            avatarUrl={item.creator_profile_source?.avatarUrl ?? item.profile_image_url}
            profileUrl={item.creator_profile_source?.profile_url ?? item.profile_url}
            countryCodes={quotationCreatorCountryCodes(item)}
            onOpen={onOpenCreator ? () => onOpenCreator(item) : undefined}>
            <div className="q-conn" title="Connected accounts">
              <CreatorPlatformTiers accounts={quotationPlatformTierAccounts(item)} />
              {hasUgcCategory(item.creator_categories) ? (
                <Badge variant="outline" className="h-5 whitespace-nowrap border-violet-200 bg-violet-50 px-2 text-[9px] font-semibold text-violet-700" title="User-generated content creator">UGC</Badge>
              ) : null}
            </div>
          </DiscoverySuiteCreatorCell>}
          {canManage && showCreator && !otherService ? <button type="button" className="q-b q-b--sm mt-2" onClick={handleAddOption} disabled={pending} aria-label={`Add service line for ${name}`}>+ Add service</button> : null}
        </div>
        <div className="q-cell-platform" role="cell"><span className="q-mobile-label"><QuotationText>Quoted on</QuotationText></span><QuotationDeliverablePlatformIcons platforms={selectedPlatforms} allPlatforms={lineFields.deliverableDrafts.some(typeLinesIncludeAllPlatforms)} loading={lineFields.loadingPlatforms} /></div>
        <div className="q-cell-service" role="cell">
          <span className="q-mobile-label"><QuotationText>Service</QuotationText></span>
          <textarea rows={1} className="q-desc" value={lineFields.serviceDescription} readOnly={!canManage} placeholder="Click to add deliverables and cost" onFocus={() => setExpanded(true)} aria-label="Service description" onChange={(event) => { if (canManage) updateServiceDescription(event.target.value); }} />
          <div className="q-dels">{lineFields.deliverableDrafts.flatMap(deliverableTypeLines).filter(line => line.type.trim()).map((line,index) => <span className={`q-del ${/boost/i.test(line.type) ? "q-del--bo" : /usage/i.test(line.type) ? "q-del--ur" : /event/i.test(line.type) ? "q-del--ev" : ""}`} key={`${line.type}:${index}`}>{formatTypeLinesSummary([line])}</span>)}</div>
        </div>
        <div className="q-cell-repeat" role="cell">
          <span className="q-mobile-label">Repeat</span>
          <span className="q-repeat-control"><span aria-hidden="true">×</span><input type="number" min={1} step={1} key={repeat ?? "mixed"} defaultValue={repeat ?? ""}
            placeholder="Mixed" aria-label={`Repeat package for ${name}`} disabled={!canManage || pending || !primary}
            onBlur={(event) => {
              const value = Number(event.currentTarget.value);
              if (!Number.isSafeInteger(value) || value < 1) { event.currentTarget.value = repeat == null ? "" : String(repeat); return; }
              if (value !== repeat) lineFields.saveDeliverables(repeatQuotationPackage(lineFields.deliverableDrafts, value, { ...resolved, revenue: computeQuotationRowComputed(resolved).revenue }));
            }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span>
        </div>
        <div className="q-cell-option" role="cell">{optionCount > 1 && <span className="q-opt">{optionLabel}/{optionCount}</span>}</div>
        <div className="q-cell-price q-price" role="cell"><span className="q-mobile-label"><QuotationText>Client price</QuotationText></span><b className={clientPrice === 0 ? "z" : undefined}>{F(clientPrice)} {rowCurrency}</b>{priceUnits > 1 && <span className="q-repeat-price">×{priceUnits} · Total {F(projected.clientCost)} {rowCurrency}</span>}{hideCostAndFees ? <u><QuotationText>AF included</QuotationText></u> : <u>{F(projected.revenue / priceUnits)} + {F(projected.af / priceUnits)} AF</u>}{originalPrice && <span className="orig">{originalPrice}</span>}{renderCostDetails(false)}{linePending && <span className="q-p q-p--wrn"><QuotationText>Unsaved</QuotationText></span>}</div>
        <div className="q-cell-status" role="cell"><span className="q-p"><QuotationText>Draft</QuotationText></span></div>
        <div className="q-cell-actions q-acts" role="cell">
          <button type="button" className="q-b q-b--sm" aria-label={`${expanded ? "Collapse" : "Expand"} line for ${name}`} aria-expanded={expanded} aria-controls={`quotation-line-${item.id}`} onClick={() => setExpanded(true)}>⋯</button>
                  <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="q-b q-b--sm q-b--icon"
              aria-label="More actions"
              disabled={!canManage || pending}
            >
              ⋮
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!otherService && <DropdownMenuItem onClick={() => onOpenCreator?.(item)}><QuotationText>View creator profile</QuotationText></DropdownMenuItem>}
            <DropdownMenuItem onClick={handleDuplicate}>
              <CopyIcon className="mr-2 size-3.5" />
              <QuotationText>Duplicate line</QuotationText></DropdownMenuItem>
            {!otherService && <DropdownMenuItem onClick={handleAddOption}>
              <PlusIcon className="mr-2 size-3.5" />
              <QuotationText>Add service line</QuotationText></DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleRemove}
            >
              <Trash2Icon className="mr-2 size-3.5" />
              <QuotationText>Remove</QuotationText></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          {!otherService && <button type="button" className="q-b q-b--sm q-mobile-action" onClick={() => onOpenCreator?.(item)}><QuotationText>Profile</QuotationText></button>}
          <button type="button" className="q-b q-b--sm q-mobile-action" onClick={handleDuplicate} disabled={!canManage || pending}><QuotationText>Duplicate</QuotationText></button>
          <button type="button" className="q-b q-b--sm q-b--danger q-mobile-action" aria-label="Remove line" onClick={handleRemove} disabled={!canManage || pending}><QuotationText>Delete</QuotationText></button>
        </div>
      </div>
      {expanded && createPortal(<div className="tq-redesign" style={{ minHeight: 0 }}><section id={`quotation-line-${item.id}`} className="q-bottom-editor" data-shortcut-pane aria-label={`Edit service for ${name}`}>
        <header className="q-bottom-editor__header"><div className="q-bottom-editor__title"><b title={name}>{name}</b><span title={lineFields.serviceDescription || "New service"}> · {lineFields.serviceDescription || "New service"}</span></div><button type="button" className="q-b q-b--sm" data-shortcut-close onClick={() => setExpanded(false)}>Close</button></header><div className="q-exp">
        {otherService ? <section className="q-sec"><div className="q-sec__h"><b>Service description</b></div><textarea aria-label="Other service description" className="w-full rounded border p-2" rows={3} value={lineFields.serviceDescription} readOnly={!canManage} onChange={e => updateServiceDescription(e.target.value)} /><p className="q-help">Use Repeat on the row for multiple units.</p></section> : <section className="q-sec"><div className="q-sec__h"><b><QuotationText>Quantity &amp; Duration</QuotationText></b></div>          {lineFields.deliverableDrafts.map((deliverable) => (
            <QuotationDeliverableTypeLinesEditor
              workspaceDetails
              key={deliverable.key}
              lines={deliverableTypeLines(deliverable)}
              allowedPlatforms={allowedCreatorPlatforms}
              disabled={!canManage}
              onChange={(lines) => {
                const previousLines = deliverableTypeLines(deliverable);
                const synced = syncDeliverableFromTypeLines(
                  lines,
                  allowedCreatorPlatforms,
                  deliverable.platform || item.platform || ""
                );
                const previousRowLines = lineFields.deliverableDrafts.flatMap(deliverableTypeLines);
                const nextRowLines = lineFields.deliverableDrafts.flatMap((entry) =>
                  entry.key === deliverable.key ? synced.type_lines : deliverableTypeLines(entry)
                );
                updateServiceDescription(syncServiceDescriptionWithTypeLines(
                  lineFields.serviceDescription,
                  previousRowLines,
                  nextRowLines
                ));
                applyDeliverable(deliverable.key, {
                  ...deliverable,
                  ...synced,
                  service_description: syncServiceDescriptionWithTypeLines(
                    deliverable.service_description,
                    previousLines,
                    synced.type_lines
                  ),
                });
              }}
            />
          ))}<p className="q-help">Duration controls appear only for services that use one.</p></section>}
        {otherService ? <section className="q-sec"><div className="q-sec__h"><b>Vendor</b></div><div>{name}</div><p className="q-help">Other service · Included in quotation totals and campaign assignments.</p></section> : <section className="q-sec"><div className="q-sec__h"><b><QuotationText>Platforms in this line</QuotationText></b></div>
          <div className="q-kv"><span><QuotationText>Connected accounts</QuotationText></span><CreatorLinkedPlatformIcons platforms={item.creator_profile_source?.linkedPlatforms?.length ? item.creator_profile_source.linkedPlatforms : allowedCreatorPlatforms} /></div>
          <div className="q-kv"><span><QuotationText>Platforms in this line</QuotationText></span><QuotationDeliverablePlatformIcons platforms={selectedPlatforms} allPlatforms={lineFields.deliverableDrafts.some(typeLinesIncludeAllPlatforms)} /></div>
          <p className="q-help"><QuotationText>A creator may have accounts that are not part of this quoted package.</QuotationText></p>
        </section>}
        <section className="q-sec q-sec--priv"><div className="q-sec__h"><b><QuotationText>Cost detail</QuotationText></b><span className="q-sp" /><span className="q-p q-p--wrn"><QuotationText>Internal — never shown to the client</QuotationText></span></div>
          <div className="q-kv"><span>Base cost (internal creator / vendor cost)</span><b>{rowCurrency} {F(projected.cost)}</b></div>
          <div className="q-kv"><span><QuotationText>Client cost before agency fees</QuotationText></span><b>{rowCurrency} {F(projected.revenue)}</b></div>
          <div className="q-kv"><span><QuotationText>Agency fees (AF)</QuotationText></span><b>{rowCurrency} {F(projected.af)}</b></div>
          <div className="q-kv"><span><QuotationText>GP amount</QuotationText></span><b>{rowCurrency} {F(projected.margin)}</b></div>
          <div className="q-kv"><span><QuotationText>GP %</QuotationText></span><b>{projected.marginPct.toFixed(1)}%</b></div>
                  {primary ? (
          <div className="q-inline-cost-editor">
            {linePending ? (
              <>
                <span className="tw-dot warn" aria-hidden style={{ width: 8, height: 8, margin: 0 }} />
                <span className="tw-p p-y" style={{ fontSize: 9, padding: "1px 5px" }}>
                  <QuotationText>Draft</QuotationText></span>
              </>
            ) : null}
            {renderCostDetails(true)}
          </div>
        ) : (
          <span className="tw-v inline-flex items-center gap-1.5">
            {linePending ? (
              <>
                <span className="tw-dot warn" aria-hidden style={{ width: 8, height: 8, margin: 0 }} />
                <span className="tw-p p-y" style={{ fontSize: 9, padding: "1px 5px" }}>
                  <QuotationText>Draft</QuotationText></span>
              </>
            ) : null}
            <span className="inline-flex flex-col items-end">
              <span>{F(clientPrice)} {rowCurrency}</span>
              {originalPrice ? <span className="text-[11px] font-normal text-muted-foreground">{originalPrice}</span> : null}
            </span>
          </span>
        )}
          <div className="q-kv"><span><QuotationText>Margin %</QuotationText></span><b>{projected.marginPct.toFixed(1)}%</b></div>
        </section>
      </div></section></div>, document.body)}
    </div>
  );
}

type Props = {
  quotationId: string;
  items: QuotationItemRow[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  selectedIds: Set<string>;
  allSelected: boolean;
  indeterminate: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  onOpenCreator?: (item: QuotationItemRow) => void;
  uniqueCreatorCount: number;
  totalClientCostEgp: number;
  canManage: boolean;
  showOriginalCurrency?: boolean;
  hideCostAndFees?: boolean;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};

export function QuotationLinesGrid({
  quotationId,
  items,
  drafts,
  selectedIds,
  allSelected,
  indeterminate,
  onToggleSelect,
  onToggleSelectAll,
  onDraftChange,
  onRemoved,
  onLineChanged,
  onOpenCreator,
  uniqueCreatorCount,
  totalClientCostEgp,
  canManage,
  showOriginalCurrency = false,
  hideCostAndFees = false,
  displayCurrency,
  displayFxRateToEgp,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const groups = new Map<string, QuotationItemRow[]>();
  for (const item of items) { const key = quotationCreatorDuplicateKey(item); groups.set(key, [...(groups.get(key) ?? []), item]); }
  const optionCounts = new Map<string, number>();
  for (const item of items) { const key = quotationCreatorDuplicateKey(item); optionCounts.set(key, (optionCounts.get(key) ?? 0) + 1); }
  return (
    <div className="q-grid" style={{ paddingBottom: activeId ? "min(320px, 35vh)" : undefined }} role="table" aria-label="Quotation creator lines">
      <div className="q-row is-head" role="row">
        <span role="columnheader"><input type="checkbox" className="q-ck" checked={allSelected} ref={el => {if(el) el.indeterminate = indeterminate && !allSelected;}} onChange={event => onToggleSelectAll(event.target.checked)} aria-label="Select all lines" disabled={!canManage || items.length === 0} /></span>
        <span role="columnheader"><QuotationText>Creator</QuotationText></span><span role="columnheader"><QuotationText>Quoted on</QuotationText></span><span role="columnheader"><QuotationText>Service</QuotationText></span><span role="columnheader">Repeat</span><span role="columnheader"><QuotationText>Option</QuotationText></span><span role="columnheader" className="q-price"><QuotationText>Client price</QuotationText></span><span role="columnheader"><QuotationText>Status</QuotationText></span><span role="columnheader" className="q-price"><QuotationText>Actions</QuotationText></span>
      </div>
      <label className="q-mobile-select"><input type="checkbox" className="q-ck" checked={allSelected} ref={el=>{if(el)el.indeterminate=indeterminate&&!allSelected;}} onChange={event => onToggleSelectAll(event.target.checked)} disabled={!canManage || items.length === 0} /><QuotationText>Select all lines</QuotationText></label>
      {items.length === 0 && <div className="q-empty" role="status"><b>No lines match this filter</b><p>Try another creator name or username, or clear the search and filters.</p></div>}
      {Array.from(groups.entries()).sort((a,b) => Number(isOtherService(a[1][0])) - Number(isOtherService(b[1][0]))).map(([key, group], index) => <div key={key} className="q-creator-service-group" role="rowgroup">{isOtherService(group[0]) && <div className="border-b bg-muted px-4 py-2 text-sm font-semibold">Others</div>}{group.map((item, serviceIndex) => <QuotationPackLineRow showCreator={serviceIndex === 0} expanded={activeId === item.id} onActivate={setActiveId} key={item.id} quotationId={quotationId} item={item} draft={drafts[item.id]} index={index} optionCount={optionCounts.get(quotationCreatorDuplicateKey(item)) ?? 1} selected={selectedIds.has(item.id)} onToggleSelect={() => onToggleSelect(item.id)} onDraftChange={onDraftChange} onRemoved={onRemoved} onLineChanged={onLineChanged} onOpenCreator={onOpenCreator} showOriginalCurrency={showOriginalCurrency} hideCostAndFees={hideCostAndFees} displayCurrency={displayCurrency} displayFxRateToEgp={displayFxRateToEgp} canManage={canManage} />)}</div>)}
      <div className="q-grid-total">Quotation totals · {uniqueCreatorCount} creators · {items.length} <QuotationText>option lines</QuotationText> <b>{F(totalClientCostEgp)} EGP</b></div>
    </div>
  );
}
