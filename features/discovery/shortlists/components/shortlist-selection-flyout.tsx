"use client";

import {
  GlassSelectionFlyout,
  glassFlyoutContentClass,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";

import type { ShortlistListActionDef } from "../shortlist-list-actions";

type Props = {
  selectedCount: number;
  selectableCount: number;
  actions: ShortlistListActionDef[];
  busy?: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAction: (action: ShortlistListActionDef) => void;
};

export function ShortlistSelectionFlyout({
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
    variant: action.destructive ? "outline" : "primary",
    destructive: action.destructive,
    onClick: () => onAction(action),
  }));

  return (
    <GlassSelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="shortlist"
      actions={flyoutActions}
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      busy={busy}
      emptyActionsMessage={
        actions.length === 0 ? "No shared actions for this selection" : undefined
      }
      maxVisibleActions={3}
    />
  );
}

export { glassFlyoutContentClass as shortlistListFloatingBarContentClass };
