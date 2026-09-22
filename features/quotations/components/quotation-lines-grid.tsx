"use client";

import { useCallback, useTransition } from "react";
import {
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DiscoverySuiteCell,
  DiscoverySuiteCreatorCell,
  DiscoverySuiteGrid,
  DiscoverySuiteRow,
  discoverySuiteHandleLabel,
} from "@/features/discovery/components/design-system";
import { DISCOVERY_GRID_MIN_W } from "@/features/discovery/components/design-system/discovery-suite-cols";
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
  computeQuotationRowComputed,
  computeQuotationRowClientCommercials,
  resolveQuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { F } from "@/lib/discovery/suite/helpers";
import {
  deliverableTypeLines,
  optionNumberLabel,
  platformsFromSelectedPostTypes,
  selectedTypesFromTypeLines,
  syncDeliverableFromTypeLines,
  syncServiceDescriptionWithTypeLines,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import { formatDeliverableGpPct } from "@/lib/quotations/quotation-deliverable-commercial";

const QUOTATION_MIN_W = DISCOVERY_GRID_MIN_W.quotation ?? 1400;

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
  selected: boolean;
  onToggleSelect: () => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  onOpenCreator?: (item: QuotationItemRow) => void;
  canManage: boolean;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};

function QuotationPackLineRow({
  quotationId,
  item,
  draft,
  index,
  selected,
  onToggleSelect,
  onDraftChange,
  onRemoved,
  onLineChanged,
  onOpenCreator,
  canManage,
  displayCurrency,
  displayFxRateToEgp,
}: LineRowProps) {
  const [pending, startTransition] = useTransition();
  const confirmDelete = useConfirmDelete();
  const manualSave = useQuotationManualSave();
  const resolved = resolveQuotationRowDraft(item, draft);
  const computed = computeQuotationRowComputed(resolved);
  const zeroCost = !(Number(resolved.cost) > 0) && !(Number(computed.costEgp) > 0);
  const linePending = manualSave.isLinePending(item.id);
  const tier = resolveCreatorTierLabel({ followers: item.followers });
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
    }) => {
      onDraftChange(item.id, {
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
  const clientPrice = clientCommercials.clientCostEgp;
  const originalCurrency = (resolved.costCurrency || "EGP").trim().toUpperCase();
  const originalPrice = originalCurrency !== "EGP"
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(clientCommercials.clientCost)} ${originalCurrency}`
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
      const res = await addQuotationItemOption({
        quotation_id: quotationId,
        item_id: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Option added.");
      onLineChanged();
    });
  }

  return (
    <DiscoverySuiteRow selected={selected} warn={zeroCost && !selected}>
      <DiscoverySuiteCell>
        <input
          type="checkbox"
          className="tw-ck"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${name} ${optionLabel}`}
          disabled={!canManage}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="tw-p p-b">{optionLabel}</span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <DiscoverySuiteCreatorCell
          name={name}
          handleLabel={handleLabel}
          index={index}
          avatarUrl={
            item.creator_profile_source?.avatarUrl ?? item.profile_image_url
          }
          profileUrl={
            item.creator_profile_source?.profile_url ?? item.profile_url
          }
          countryCodes={quotationCreatorCountryCodes(item)}
          onOpen={onOpenCreator ? () => onOpenCreator(item) : undefined}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="tw-p p-v">{tier}</span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <input
          className="tw-in"
          value={lineFields.serviceDescription}
          readOnly={!canManage}
          aria-label="Service description"
          onChange={(event) => {
            if (!canManage) return;
            updateServiceDescription(event.target.value);
          }}
          title={lineFields.serviceDescription || undefined}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <QuotationDeliverablePlatformIcons
          platforms={selectedPlatforms}
          allPlatforms={lineFields.deliverableDrafts.some(typeLinesIncludeAllPlatforms)}
          loading={lineFields.loadingPlatforms}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <div className="min-w-0 space-y-2">
          {lineFields.deliverableDrafts.map((deliverable) => (
            <QuotationDeliverableTypeLinesEditor
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
          ))}
        </div>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell align="end">
        {primary ? (
          <span className="inline-flex items-center gap-1.5">
            {linePending ? (
              <>
                <span className="tw-dot warn" aria-hidden style={{ width: 8, height: 8, margin: 0 }} />
                <span className="tw-p p-y" style={{ fontSize: 9, padding: "1px 5px" }}>
                  Draft
                </span>
              </>
            ) : null}
            <QuotationDeliverableCostDetails
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
              priceLabel={`${F(clientPrice)} EGP`}
              priceSecondaryLabel={originalPrice}
              gpPctLabel={formatDeliverableGpPct(
                primary,
                draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1
              )}
              onApply={(next) => applyDeliverable(primary.key, next)}
              onLiveChange={(next) => applyDeliverable(primary.key, next)}
              priceLayout="stacked"
            />
          </span>
        ) : (
          <span className="tw-v inline-flex items-center gap-1.5">
            {linePending ? (
              <>
                <span className="tw-dot warn" aria-hidden style={{ width: 8, height: 8, margin: 0 }} />
                <span className="tw-p p-y" style={{ fontSize: 9, padding: "1px 5px" }}>
                  Draft
                </span>
              </>
            ) : null}
            <span className="inline-flex flex-col items-end">
              <span>{F(clientPrice)} EGP</span>
              {originalPrice ? <span className="text-[11px] font-normal text-muted-foreground">{originalPrice}</span> : null}
            </span>
          </span>
        )}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="tw-p p-n">Draft</span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-act" align="end">
        <button
          type="button"
          className="tw-x"
          aria-label="Add option"
          disabled={!canManage || pending}
          onClick={handleAddOption}
        >
          +
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="tw-x"
              aria-label="More actions"
              disabled={!canManage || pending}
            >
              ⋯
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleDuplicate}>
              <CopyIcon className="mr-2 size-3.5" />
              Duplicate line
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddOption}>
              <PlusIcon className="mr-2 size-3.5" />
              Add option
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleRemove}
            >
              <Trash2Icon className="mr-2 size-3.5" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          className="tw-x"
          aria-label="Remove line"
          disabled={!canManage || pending}
          onClick={handleRemove}
        >
          🗑
        </button>
      </DiscoverySuiteCell>
    </DiscoverySuiteRow>
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
  displayCurrency,
  displayFxRateToEgp,
}: Props) {
  const header = (
    <>
      <DiscoverySuiteCell>
        <input
          type="checkbox"
          className="tw-ck"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate && !allSelected;
          }}
          onChange={(event) => onToggleSelectAll(event.target.checked)}
          aria-label="Select all lines"
          disabled={!canManage || items.length === 0}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Option</DiscoverySuiteCell>
      <DiscoverySuiteCell>Creator</DiscoverySuiteCell>
      <DiscoverySuiteCell>Tier</DiscoverySuiteCell>
      <DiscoverySuiteCell>Service description</DiscoverySuiteCell>
      <DiscoverySuiteCell>Platform</DiscoverySuiteCell>
      <DiscoverySuiteCell>Type</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Price
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Status</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Act
      </DiscoverySuiteCell>
    </>
  );

  const footer = (
    <>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell>
        Totals · {uniqueCreatorCount} creators · {items.length} option lines
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell className="tw-v" align="end">
        {F(totalClientCostEgp)} EGP
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
    </>
  );

  return (
    <DiscoverySuiteGrid
      cols="quotation"
      minWidth={QUOTATION_MIN_W}
      framed={false}
      header={header}
      footer={footer}
    >
      {items.map((item, index) => (
        <QuotationPackLineRow
          key={item.id}
          quotationId={quotationId}
          item={item}
          draft={drafts[item.id]}
          index={index}
          selected={selectedIds.has(item.id)}
          onToggleSelect={() => onToggleSelect(item.id)}
          onDraftChange={onDraftChange}
          onRemoved={onRemoved}
          onLineChanged={onLineChanged}
          onOpenCreator={onOpenCreator}
          displayCurrency={displayCurrency}
          displayFxRateToEgp={displayFxRateToEgp}
          canManage={canManage}
        />
      ))}
    </DiscoverySuiteGrid>
  );
}
