"use client";

import {
  GlassSelectionFlyout,
  glassFlyoutContentClass,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";

import type { QuotationListActionDef } from "../quotation-list-actions";

type Props = {
  selectedCount: number;
  selectableCount: number;
  actions: QuotationListActionDef[];
  busy?: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAction: (action: QuotationListActionDef) => void;
};

export function QuotationSelectionFlyout({
  selectedCount,
  selectableCount,
  actions,
  busy,
  onSelectAll,
  onClearSelection,
  onAction,
}: Props) {
  const flyoutActions: GlassFlyoutAction[] = actions.map((action) => ({
    id: action.key,
    label: action.label,
    variant: "outline",
    destructive: action.destructive,
    onClick: () => onAction(action),
  }));

  return (
    <GlassSelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="quotation"
      actions={flyoutActions}
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      busy={busy}
      emptyActionsMessage={
        actions.length === 0 ? "No shared actions for this selection" : undefined
      }
      maxVisibleActions={2}
    />
  );
}

export { glassFlyoutContentClass as quotationListFloatingBarContentClass };
