"use client";

import { useCallback, useMemo } from "react";

import { QuotationCollapseContentHeaderRow } from "@/features/quotations/components/quotation-collapse-content-header-row";
import { QuotationCollapsePackagePricingRow } from "@/features/quotations/components/quotation-collapse-package-pricing-row";
import { QuotationCreatorGroupRows } from "@/features/quotations/components/quotation-creator-group-rows";
import type { QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";
import {
  collapsePackageLeaderItem,
  collapsePackageOptionNumber,
  countCollapsePackageSiblings,
  siblingCollapsePackageMemberIds,
} from "@/lib/quotations/quotation-collapse-package";
import type { QuotationWorkspaceCreatorGroup } from "@/lib/quotations/quotation-workspace-sort";

type Props = {
  quotationId: string;
  shortlistId: string | null;
  label: string;
  allItems: QuotationItemRow[];
  creatorGroups: QuotationWorkspaceCreatorGroup[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  groupIndex: number;
  optionContextByItemId: Map<string, QuotationItemOptionContext>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  onOpenCreator?: (item: QuotationItemRow) => void;
  focusItemId?: string | null;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};

/** Collapse content block: shared Collap header + one line group per creator. */
export function QuotationCollapseContentGroupRows({
  quotationId,
  shortlistId,
  label,
  allItems,
  creatorGroups,
  drafts,
  groupIndex,
  optionContextByItemId,
  selectedIds,
  onToggleSelect,
  onDraftChange,
  onRemoved,
  onLineChanged,
  onOpenCreator,
  focusItemId,
  displayCurrency,
  displayFxRateToEgp,
}: Props) {
  const groupItems = useMemo(
    () => creatorGroups.flatMap((group) => group.items),
    [creatorGroups]
  );
  const creatorCount = groupItems.length;
  const packageLeader = useMemo(() => collapsePackageLeaderItem(groupItems), [groupItems]);
  const packageOptionNumber = useMemo(
    () => collapsePackageOptionNumber(allItems, groupItems),
    [allItems, groupItems]
  );
  const packageSiblingCount = useMemo(
    () => countCollapsePackageSiblings(allItems, groupItems),
    [allItems, groupItems]
  );
  const allSiblingPackageMemberIds = useMemo(
    () => siblingCollapsePackageMemberIds(allItems, groupItems),
    [allItems, groupItems]
  );
  const showPackageOptionLabel = packageSiblingCount > 1;
  const packageFocus =
    focusItemId && groupItems.some((item) => item.id === focusItemId)
      ? packageLeader.id
      : focusItemId;

  const onToggleSelectGroup = useCallback(
    (itemIds: string[]) => {
      const allSelected = itemIds.every((id) => selectedIds.has(id));
      for (const id of itemIds) {
        const isSelected = selectedIds.has(id);
        if (allSelected && isSelected) onToggleSelect(id);
        if (!allSelected && !isSelected) onToggleSelect(id);
      }
    },
    [onToggleSelect, selectedIds]
  );

  return (
    <>
      <QuotationCollapseContentHeaderRow
        label={label}
        creatorCount={creatorCount}
        optionNumber={showPackageOptionLabel ? packageOptionNumber : undefined}
        isFirstGroup={groupIndex === 0}
      />
      <QuotationCollapsePackagePricingRow
        quotationId={quotationId}
        groupItems={groupItems}
        drafts={drafts}
        selectedIds={selectedIds}
        onToggleSelectGroup={onToggleSelectGroup}
        onDraftChange={onDraftChange}
        onRemoved={onRemoved}
        onLineChanged={onLineChanged}
        autoOpenEditors={packageFocus === packageLeader.id}
        packageOptionNumber={packageOptionNumber}
        showPackageOptionLabel={showPackageOptionLabel}
        packageSiblingCount={packageSiblingCount}
        siblingPackageMemberIds={allSiblingPackageMemberIds}
        displayCurrency={displayCurrency}
        displayFxRateToEgp={displayFxRateToEgp}
      />
      {creatorGroups.map((group, nestedIndex) => (
        <QuotationCreatorGroupRows
          key={`${group.creatorKey}-collapse-${nestedIndex}`}
          quotationId={quotationId}
          shortlistId={shortlistId}
          items={group.items}
          drafts={drafts}
          groupIndex={groupIndex + nestedIndex + 1}
          optionContextByItemId={optionContextByItemId}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onDraftChange={onDraftChange}
          onRemoved={onRemoved}
          onLineChanged={onLineChanged}
          onOpenCreator={onOpenCreator}
          focusItemId={focusItemId}
          collapsePackageMode
          displayCurrency={displayCurrency}
          displayFxRateToEgp={displayFxRateToEgp}
        />
      ))}
    </>
  );
}
