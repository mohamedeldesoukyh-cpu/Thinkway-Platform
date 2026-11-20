import { QuotationServiceDescription } from "./quotation-service-description";
import { moveQuotationService } from "@/lib/quotations/quotation-service-order";
import { QuotationEnrichmentProgress } from "./quotation-enrichment-progress";
import { quotationOptionLabel } from "@/lib/quotations/quotation-option-label";
import { useQuotationDirectRates } from "./quotation-direct-rates-context";
import { QuotationText } from "./quotation-design-locale";
import { isOtherService } from "@/lib/commercial/other-service";

import { useCallback, useEffect, useTransition, useState, useRef } from "react";
import { QuotationFavoriteButtons, useDeliverableFavorites } from "./quotation-deliverable-favorites";
import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import {
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

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
  onMove: (direction: -1 | 1) => void;
  onDropLine: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
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
  onMove, onDropLine, canMoveUp, canMoveDown,
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
  const directRates = useQuotationDirectRates();
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editorFocus, setEditorFocus] = useState<"deliverables" | "cost" | null>("deliverables");
  const [editorFocusRevision, setEditorFocusRevision] = useState(0);
  const editorBody = useRef<HTMLDivElement>(null);
  const setExpanded = (open: boolean) => onActivate(open ? item.id : null);
  const openEditor = (focus: "deliverables" | "cost" | null = null) => { setEditorFocus(focus); setEditorFocusRevision(value => value + 1); setExpanded(true); };
  useEffect(() => {
    if (!expanded || !editorFocus) return;
    const frame = requestAnimationFrame(() => {
      const section = editorBody.current?.querySelector<HTMLElement>(`[data-editor-section="${editorFocus}"]`);
      section?.scrollIntoView({ block: "start" });
      section?.querySelector<HTMLElement>('input,textarea,select,button')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded, editorFocus, editorFocusRevision]);
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
  const pendingLabel = manualSave.getLinePendingPayload(item.id)?.option_label;
  const selectedLabel = pendingLabel !== undefined ? pendingLabel : (item.option_label ?? null);
  const optionLabel = quotationOptionLabel({...item, option_label: selectedLabel});

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
  const editorSnapshot = useRef<{ description: string; deliverables: typeof lineFields.deliverableDrafts; draft: QuotationRowDraft } | null>(null);
  useEffect(() => {
    if (!expanded) { editorSnapshot.current = null; return; }
    if (!editorSnapshot.current) editorSnapshot.current = structuredClone({ description: lineFields.serviceDescription, deliverables: lineFields.deliverableDrafts, draft: resolved });
  }, [expanded, lineFields.serviceDescription, lineFields.deliverableDrafts, resolved]);
  function cancelEditor() {
    const saved = editorSnapshot.current;
    if (saved) {
      lineFields.saveDeliverables(saved.deliverables);
      lineFields.setServiceDescription(saved.description);
      onDraftChange(item.id, saved.draft);
      manualSave.registerLinePending(item.id, {
        commercial_source: "master", service_description: saved.description,
        deliverables: saved.deliverables, cost: saved.draft.cost, revenue: saved.draft.revenue,
        mode: saved.draft.mode, gp_pct: saved.draft.gpPct, gp_value: saved.draft.gpValue,
        af_pct: saved.draft.afPct, cost_currency: saved.draft.costCurrency,
        cost_fx_override: saved.draft.costFxOverride ?? null, revenue_fx_override: saved.draft.revenueFxOverride ?? null,
      });
    }
    setExpanded(false);
  }
  const favorites = useDeliverableFavorites();
  useEffect(() => favorites.register(item.id, (favorite) => {
    if (!canManage || isOtherService(item)) return false;
    const first = lineFields.deliverableDrafts[0];
    if (!first) return false;
    const synced = syncDeliverableFromTypeLines(favorite.lines, lineFields.platformSelectOptions.map(p => p.platform), first.platform || item.platform || "");
    if (synced.type_lines.some(line => !line.type)) {
      toast.error(`Favorite includes deliverables unavailable for ${name}. Choose a compatible selection.`);
      return false;
    }
    // Keep this line's prices and any additional separately priced packages.
    lineFields.saveDeliverables(lineFields.deliverableDrafts.map((entry, index) => index === 0 ? { ...entry, ...synced, service_description: favorite.description } : entry));
    lineFields.setServiceDescription(favorite.description);
    manualSave.registerLinePending(item.id, { service_description: favorite.description });
    return true;
  }), [favorites.register, item, name, canManage, lineFields, manualSave]);
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
  const rowCurrency = displayCurrency === "FOREIGN" ? resolved.costCurrency : displayCurrency || "EGP";
  const projected = computeQuotationDisplayTotals([resolved], rowCurrency, displayFxRateToEgp ?? 1, directRates);
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
      // A blank service copies creator identity only; preserve other staged edits.
      const res = await addQuotationItemOption({
        quotation_id: quotationId,
        item_id: item.id,
        blank_service: true,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Service added. Set deliverables and cost in the service panel.");
      if (res.data?.id) onActivate(res.data.id);
      // revalidatePath in the server action already refreshes this route.
    });
  }

  const renderCostDetails = (showPrice: boolean, embedded = false) => canManage && primary ? (
<QuotationDeliverableCostDetails
              embedded={embedded}
              triggerLabel={projected.cost > 0 ? "Edit cost" : "+ Add cost"}
                    displayCurrency={rowCurrency}
                    displayFxRateToEgp={displayCurrency === "FOREIGN" ? resolved.fxRateToEgp : displayFxRateToEgp}
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
      <div className={`q-row q-live-row ${selected ? "is-sel" : ""} ${dragOver ? "dropover" : ""} ${dragging ? "dragging" : ""}`} role="row" onDragOver={event => { if (canManage) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOver(true); } }} onDragLeave={() => setDragOver(false)} onDrop={event => { event.preventDefault(); setDragOver(false); const id = event.dataTransfer.getData("application/thinkway-quotation-line"); if (id) onDropLine(id); }} onClick={(event) => {
        if (event.defaultPrevented || !(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return;
        if (event.target.closest('button, a, input, textarea, select, label, [role="button"], [role="checkbox"], [role="switch"], [role="combobox"], [contenteditable="true"]')) return;
        if (window.getSelection()?.toString()) return;
        openEditor();
      }}>
        <div className="q-cell-drag" role="cell"><button type="button" className="qx-grip" draggable={canManage && !pending} disabled={!canManage || pending || (!canMoveUp && !canMoveDown)} aria-label={`Reorder service for ${name}. Use Alt plus Up or Down`} title="Drag to reorder · Alt + ↑ / ↓" onDragEnd={() => { setDragging(false); setDragOver(false); }} onDragStart={event => { setDragging(true); event.dataTransfer.setData("application/thinkway-quotation-line", item.id); event.dataTransfer.effectAllowed = "move"; }} onKeyDown={event => { if (event.altKey && ["ArrowUp","ArrowDown"].includes(event.key)) { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1); } }}>⠿</button></div>
        <div className="q-cell-select" role="cell"><input type="checkbox" className="q-ck" checked={selected} onChange={onToggleSelect} aria-label={`Select ${name}${optionCount > 1 ? ` ${optionLabel}` : ""}`} disabled={!canManage} /></div>
        <div className="q-cell-creator" role="cell">
          {showCreator && otherService && <div className="space-y-1"><Badge variant="outline">Others</Badge><div className="font-medium">{name}</div><a className="text-xs text-primary" href={`/vendors/${item.influencer_id}`}>View vendor</a></div>}
          {showCreator && !otherService && <DiscoverySuiteCreatorCell name={name} handleLabel={handleLabel} index={index}
            avatarUrl={item.creator_profile_source?.avatarUrl ?? item.profile_image_url}
            profileUrl={item.creator_profile_source?.profile_url ?? item.profile_url}
            countryCodes={quotationCreatorCountryCodes(item)}
            onOpen={onOpenCreator ? () => onOpenCreator(item) : undefined}>
            <div className="q-conn" title="Connected accounts">
              <QuotationEnrichmentProgress status={item.creator_profile_source?.enrichmentDisplayStatus} />
              <CreatorPlatformTiers accounts={quotationPlatformTierAccounts(item)} />
              {hasUgcCategory(item.creator_categories) ? (
                <Badge variant="outline" className="h-5 whitespace-nowrap border-violet-200 bg-violet-50 px-2 text-[9px] font-semibold text-violet-700" title="User-generated content creator">UGC</Badge>
              ) : null}
            </div>
          </DiscoverySuiteCreatorCell>}
          {canManage && !otherService ? <div className={`q-creator-service-tools${showCreator ? " q-creator-service-tools--first" : ""}`}>
            {showCreator && <button type="button" className="q-b q-b--sm" onClick={handleAddOption} disabled={pending} aria-label={`Add service line for ${name}`}>{pending ? "Adding service…" : "+ Add service"}</button>}
            <QuotationFavoriteButtons creatorName={name} allowedPlatforms={allowedCreatorPlatforms} itemIds={[item.id]} lines={primary ? deliverableTypeLines(primary) : []} description={lineFields.serviceDescription} disabled={pending} />
          </div> : null}

        </div>
        <div className="q-cell-platform" role="cell"><span className="q-mobile-label"><QuotationText>Quoted on</QuotationText></span><QuotationDeliverablePlatformIcons platforms={selectedPlatforms} allPlatforms={lineFields.deliverableDrafts.some(typeLinesIncludeAllPlatforms)} loading={lineFields.loadingPlatforms} /></div>
        <div className="q-cell-service" role="cell">
          <span className="q-mobile-label"><QuotationText>Service</QuotationText></span>
          <div className="q-dels">{lineFields.deliverableDrafts.flatMap(deliverableTypeLines).filter(line => line.type.trim()).map((line,index) => <span className={`q-del ${/boost/i.test(line.type) ? "q-del--bo" : /usage/i.test(line.type) ? "q-del--ur" : /event/i.test(line.type) ? "q-del--ev" : ""}`} key={`${line.type}:${index}`}>{formatTypeLinesSummary([line])}</span>)}</div>
          <QuotationServiceDescription value={lineFields.serviceDescription} derived={formatTypeLinesSummary(lineFields.deliverableDrafts.flatMap(deliverableTypeLines))} readOnly={!canManage} onChange={updateServiceDescription} />
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
        <div className="q-cell-option" role="cell">{canManage ? <select className="q-opt max-w-full cursor-pointer bg-transparent" aria-label={`Option label for ${name}`} value={selectedLabel ?? "option"} onChange={(event) => manualSave.registerLinePending(item.id, {option_label: event.target.value === "option" ? null : event.target.value})}>
<option value="option">Option {item.option_number ?? 1}/{optionCount}</option><option value="Additional Service">Additional Service</option><option value="Deliverables">Deliverables</option></select> : <span className="q-opt">{optionLabel}{!selectedLabel && optionCount > 1 ? `/${optionCount}` : ""}</span>}</div>
        <div className="q-cell-price q-price" role="cell"><span className="q-mobile-label"><QuotationText>Client price</QuotationText></span><b className={clientPrice === 0 ? "z" : undefined}>{clientPrice === 0 && !primary?.free_for_client ? "Not priced" : `${F(clientPrice)} ${rowCurrency}`}</b>{priceUnits > 1 && <span className="q-repeat-price">×{priceUnits} · Total {F(projected.clientCost)} {rowCurrency}</span>}{hideCostAndFees ? <u><QuotationText>AF included</QuotationText></u> : <u>{F(projected.revenue / priceUnits)} + {F(projected.af / priceUnits)} AF</u>}{originalPrice && <span className="orig">{originalPrice}</span>}{canManage && primary && <button type="button" className="qx-link" onClick={() => openEditor("cost")}>{projected.cost > 0 ? "Edit cost" : "+ Add cost"}</button>}{linePending && <span className="q-p q-p--wrn"><QuotationText>Unsaved</QuotationText></span>}</div>
        <div className="q-cell-status" role="cell"><span className={`qx-stat ${linePending ? "qx-stat--dirty" : ""}`} title={linePending ? "This service has changes waiting for Save" : "This service matches the saved quotation"}><i aria-hidden />{linePending ? "Unsaved changes" : "Saved"}</span></div>
        <div className="q-cell-actions q-acts" role="cell">
          <button type="button" className="qx-link qx-link--danger" disabled={!canManage || pending} aria-label={`Remove this service line for ${name}`} onClick={handleRemove}>Remove</button>
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
            <DropdownMenuItem disabled={!canMoveUp} onClick={() => onMove(-1)}>Move service up</DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveDown} onClick={() => onMove(1)}>Move service down</DropdownMenuItem>
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
      {expanded && <Sheet modal={false} open={expanded} onOpenChange={setExpanded}><SheetContent showOverlay={false} side="right" showCloseButton={false} className="tq-redesign q-service-sheet qx q-redesign-body" data-shortcut-pane id={`quotation-line-${item.id}`}><SheetTitle className="sr-only">Service details for {name}</SheetTitle><SheetDescription className="sr-only">Choose deliverables, quantities, duration and internal costs. Changes are staged until Save.</SheetDescription>
        <header className="qx-sh__h"><div className="q-service-heading"><b title={name}>{name}</b><span title={lineFields.serviceDescription || "New service"}> · {lineFields.serviceDescription || "New service"}</span></div><button type="button" className="q-b q-b--sm" data-shortcut-close onClick={() => setExpanded(false)}>Close</button></header><div className="q-exp qx-sh__b" ref={editorBody}>
        {otherService ? <section className="q-sec"><div className="q-sec__h"><b>Service description</b></div><textarea aria-label="Other service description" className="w-full rounded border p-2" rows={3} value={lineFields.serviceDescription} readOnly={!canManage} onChange={e => updateServiceDescription(e.target.value)} /><p className="q-help">Use Repeat on the row for multiple units.</p></section> : <section className="q-service-selection">          {lineFields.deliverableDrafts.map((deliverable) => (
            <QuotationDeliverableTypeLinesEditor
              workspaceDetails inlinePicker sectioned
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
          ))}</section>}
        {otherService ? <section className="q-sec"><div className="q-sec__h"><b>Vendor</b></div><div>{name}</div><p className="q-help">Other service · Included in quotation totals and campaign assignments.</p></section> : <section className="q-sec"><div className="q-sec__h"><b><QuotationText>Platforms in this line</QuotationText></b></div>
          <div className="q-kv"><span><QuotationText>Connected accounts</QuotationText></span><CreatorLinkedPlatformIcons platforms={item.creator_profile_source?.linkedPlatforms?.length ? item.creator_profile_source.linkedPlatforms : allowedCreatorPlatforms} /></div>
          <div className="q-kv"><span><QuotationText>Platforms in this line</QuotationText></span><QuotationDeliverablePlatformIcons platforms={selectedPlatforms} allPlatforms={lineFields.deliverableDrafts.some(typeLinesIncludeAllPlatforms)} /></div>
          <p className="q-help"><QuotationText>A creator may have accounts that are not part of this quoted package.</QuotationText></p>
        </section>}
        {!otherService && <section className="qx-panel"><div className="qx-panel__h"><h4>Service description</h4></div><div className="qx-panel__b"><textarea className="ta" aria-label="Package description" value={lineFields.serviceDescription} readOnly={!canManage} onChange={event => updateServiceDescription(event.target.value)} /><p className="q-help">Describe this package. The service chips remain available on the line.</p></div></section>}
        <section className="qx-panel qx-panel--int" data-editor-section="cost"><div className="qx-panel__h"><h4>Cost &amp; pricing</h4><span className="sp" /><span className="q-help">Internal — never shown to the client</span></div><div className="qx-panel__b">
          {renderCostDetails(false, true)}
          <div className="qx-qty"><span className="qx-qty__l">Client cost before agency fees</span><b>{rowCurrency} {F(projected.revenue)}</b></div>
          <div className="qx-qty"><span className="qx-qty__l">Agency fees (AF)</span><b>{rowCurrency} {F(projected.af)}</b></div>
          <div className="qx-qty"><span className="qx-qty__l">GP amount</span><b>{rowCurrency} {F(projected.margin)}</b></div>
          <div className="qx-qty"><span className="qx-qty__l">GP %</span><b>{projected.marginPct.toFixed(1)}%</b></div>
          <div className="qx-qty"><span className="qx-qty__l" title="Gross profit divided by base cost">Markup / cost margin %</span><b>{projected.cost > 0 ? `${(projected.margin / projected.cost * 100).toFixed(1)}%` : "—"}</b></div>
          <div className="qx-qty"><span className="qx-qty__l"><b>Client total incl. fees</b></span><b>{rowCurrency} {F(projected.clientCost)}</b></div>
        </div></section>
      </div><footer className="qx-sh__f"><button type="button" className="b b--pri" onClick={() => setExpanded(false)}>Apply to this line</button><button type="button" className="b" onClick={cancelEditor}>Cancel</button><span className="sp" /><span className="q-help">Staged for quotation Save</span></footer></SheetContent></Sheet>}
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
  foreignTotalsLabel?: string;
  financialFooter?: React.ReactNode;
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
  foreignTotalsLabel,
  financialFooter,
  canManage,
  showOriginalCurrency = false,
  hideCostAndFees = false,
  displayCurrency,
  displayFxRateToEgp,
}: Props) {
  const manualSave = useQuotationManualSave();
  const [activeId, setActiveId] = useState<string | null>(null);
  const groups = new Map<string, QuotationItemRow[]>();
  for (const item of items) { const key = quotationCreatorDuplicateKey(item); groups.set(key, [...(groups.get(key) ?? []), item]); }
  for (const group of groups.values()) group.sort((a,b) => (manualSave.getLinePendingPayload(a.id)?.sort_order ?? a.sort_order) - (manualSave.getLinePendingPayload(b.id)?.sort_order ?? b.sort_order));
  function moveLine(group: QuotationItemRow[], fromId: string, toId: string) {
    if (!canManage || manualSave.savePending || fromId === toId) return;
    const ordered = group.map(item => ({ id: item.id, sort_order: manualSave.getLinePendingPayload(item.id)?.sort_order ?? item.sort_order }));
    moveQuotationService(ordered,fromId,toId).forEach(item => manualSave.registerLinePending(item.id,{ sort_order: item.sort_order }));
  }
  const optionCounts = new Map<string, number>();
  for (const item of items) { const key = quotationCreatorDuplicateKey(item); optionCounts.set(key, (optionCounts.get(key) ?? 0) + 1); }
  return (
    <div className="q-grid" role="table" aria-label="Quotation creator lines">
      <div className="q-row is-head" role="row"><span role="columnheader" aria-label="Reorder service" />
        <span role="columnheader"><input type="checkbox" className="q-ck" checked={allSelected} ref={el => {if(el) el.indeterminate = indeterminate && !allSelected;}} onChange={event => onToggleSelectAll(event.target.checked)} aria-label="Select all lines" disabled={!canManage || items.length === 0} /></span>
        <span role="columnheader"><QuotationText>Creator</QuotationText></span><span role="columnheader"><QuotationText>Quoted on</QuotationText></span><span role="columnheader"><QuotationText>Service</QuotationText></span><span role="columnheader">Repeat</span><span role="columnheader"><QuotationText>Option</QuotationText></span><span role="columnheader" className="q-price"><QuotationText>Client price</QuotationText></span><span role="columnheader">Save status</span><span role="columnheader" className="q-price"><QuotationText>Actions</QuotationText></span>
      </div>
      <label className="q-mobile-select"><input type="checkbox" className="q-ck" checked={allSelected} ref={el=>{if(el)el.indeterminate=indeterminate&&!allSelected;}} onChange={event => onToggleSelectAll(event.target.checked)} disabled={!canManage || items.length === 0} /><QuotationText>Select all lines</QuotationText></label>
      {items.length === 0 && <div className="q-empty" role="status"><b>No lines match this filter</b><p>Try another creator name or username, or clear the search and filters.</p></div>}
      {Array.from(groups.entries()).sort((a,b) => Number(isOtherService(a[1][0])) - Number(isOtherService(b[1][0]))).map(([key, group], index) => <div key={key} className="q-creator-service-group" role="rowgroup">{isOtherService(group[0]) && <div className="border-b bg-muted px-4 py-2 text-sm font-semibold">Others</div>}{group.map((item, serviceIndex) => <QuotationPackLineRow canMoveUp={serviceIndex > 0} canMoveDown={serviceIndex < group.length - 1} onMove={direction => { const target = group[serviceIndex + direction]; if (target) moveLine(group,item.id,target.id); }} onDropLine={id => moveLine(group,id,item.id)} showCreator={serviceIndex === 0} expanded={activeId === item.id} onActivate={setActiveId} key={item.id} quotationId={quotationId} item={item} draft={drafts[item.id]} index={index} optionCount={optionCounts.get(quotationCreatorDuplicateKey(item)) ?? 1} selected={selectedIds.has(item.id)} onToggleSelect={() => onToggleSelect(item.id)} onDraftChange={onDraftChange} onRemoved={onRemoved} onLineChanged={onLineChanged} onOpenCreator={onOpenCreator} showOriginalCurrency={showOriginalCurrency} hideCostAndFees={hideCostAndFees} displayCurrency={displayCurrency} displayFxRateToEgp={displayFxRateToEgp} canManage={canManage} />)}<div className="qx-groupfoot"><span>{group[0].creator_profile_source?.displayName || group[0].creator_name || "Creator"}</span><em>{group.length} service line{group.length === 1 ? "" : "s"}</em></div></div>)}
      {financialFooter ?? <div className="q-grid-total">Quotation totals · {uniqueCreatorCount} creators · {items.length} <QuotationText>option lines</QuotationText> <b>{foreignTotalsLabel ?? `${F(totalClientCostEgp)} EGP`}</b></div>}
    </div>
  );
}
